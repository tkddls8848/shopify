import { readFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";

import { createAdminApiClient } from "@shopify/admin-api-client";

import { repositoryRoot } from "./paths.js";
import type { ProductSetInput } from "./transform.js";

export const SHOPIFY_API_VERSION = "2026-07";
export const SOURCE_NAMESPACE = "sourcing";
export const SOURCE_KEY = "source_key";

interface GraphqlError {
  message?: string;
}

interface GraphqlResult<T> {
  data?: T;
  errors?: GraphqlError[];
  extensions?: {
    cost?: {
      actualQueryCost?: number;
      throttleStatus?: { currentlyAvailable?: number; restoreRate?: number };
    };
  };
}

export interface GraphqlTransport {
  request<T>(query: string, options?: { variables?: Record<string, unknown> }): Promise<GraphqlResult<T>>;
}

type Sleep = (milliseconds: number) => Promise<void>;

const defaultSleep: Sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

function mimeType(path: string): string {
  const byExtension: Record<string, string> = {
    ".avif": "image/avif",
    ".gif": "image/gif",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
  };
  return byExtension[extname(path).toLowerCase()] ?? "application/octet-stream";
}

function assertUserErrors(errors: Array<{ code?: string; field?: string[]; message: string }> | undefined): void {
  if (!errors?.length) return;
  throw new Error(errors.map((error) => `${error.field?.join(".") ?? "mutation"}: ${error.message}`).join("; "));
}

export class ShopifyGateway {
  constructor(
    private readonly transport: GraphqlTransport,
    private readonly sleep: Sleep = defaultSleep,
    private readonly uploadFetch: typeof fetch = fetch,
  ) {}

  static fromEnvironment(): ShopifyGateway {
    const storeDomain = process.env.SHOPIFY_STORE_DOMAIN?.replace(/^https?:\/\//u, "").replace(/\/$/u, "");
    const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    if (!storeDomain || !accessToken) {
      throw new Error("SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_ACCESS_TOKEN are required for push");
    }
    const client = createAdminApiClient({
      storeDomain,
      apiVersion: SHOPIFY_API_VERSION,
      accessToken,
    });
    return new ShopifyGateway(client as unknown as GraphqlTransport);
  }

  private async request<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const result = await this.transport.request<T>(query, variables ? { variables } : undefined);
    if (result.errors?.length) {
      throw new Error(result.errors.map((error) => error.message ?? "GraphQL request failed").join("; "));
    }
    if (result.data === undefined) throw new Error("Shopify returned no data");

    const cost = result.extensions?.cost;
    const available = cost?.throttleStatus?.currentlyAvailable;
    const restoreRate = cost?.throttleStatus?.restoreRate;
    const desired = Math.max((cost?.actualQueryCost ?? 0) * 2, 50);
    if (available !== undefined && restoreRate && available < desired) {
      await this.sleep(Math.ceil(((desired - available) / restoreRate) * 1000));
    }
    return result.data;
  }

  async ensureSourceDefinition(): Promise<void> {
    const data = await this.request<{
      metafieldDefinitionCreate: {
        createdDefinition: { id: string } | null;
        userErrors: Array<{ code?: string; field?: string[]; message: string }>;
      };
    }>(
      `mutation EnsureSourceDefinition($definition: MetafieldDefinitionInput!) {
        metafieldDefinitionCreate(definition: $definition) {
          createdDefinition { id }
          userErrors { code field message }
        }
      }`,
      {
        definition: {
          name: "Sourcing source key",
          namespace: SOURCE_NAMESPACE,
          key: SOURCE_KEY,
          description: "Stable <supplier>:<sourceId> identifier used by the Morrow lister",
          type: "id",
          ownerType: "PRODUCT",
          pin: true,
        },
      },
    );
    const errors = data.metafieldDefinitionCreate.userErrors;
    const onlyAlreadyExists = errors.length > 0 && errors.every(
      (error) => error.code === "TAKEN" || /already|taken|exists/iu.test(error.message),
    );
    if (errors.length && !onlyAlreadyExists) assertUserErrors(errors);
  }

  async findProduct(sourceValue: string): Promise<{ id: string; title: string } | null> {
    const data = await this.request<{
      productByIdentifier: { id: string; title: string } | null;
    }>(
      `query FindProductBySource($identifier: ProductIdentifierInput!) {
        productByIdentifier(identifier: $identifier) { id title }
      }`,
      {
        identifier: {
          customId: { namespace: SOURCE_NAMESPACE, key: SOURCE_KEY, value: sourceValue },
        },
      },
    );
    return data.productByIdentifier;
  }

  async firstLocationId(): Promise<string> {
    const data = await this.request<{ locations: { nodes: Array<{ id: string }> } }>(
      `query FirstLocation { locations(first: 1) { nodes { id } } }`,
    );
    const id = data.locations.nodes[0]?.id;
    if (!id) throw new Error("Shopify store has no location for tracked inventory");
    return id;
  }

  async stageLocalImage(localPath: string): Promise<string> {
    const absolutePath = resolve(repositoryRoot(), localPath);
    const bytes = await readFile(absolutePath);
    const filename = basename(absolutePath);
    const type = mimeType(absolutePath);
    const data = await this.request<{
      stagedUploadsCreate: {
        stagedTargets: Array<{
          url: string;
          resourceUrl: string;
          parameters: Array<{ name: string; value: string }>;
        }>;
        userErrors: Array<{ field?: string[]; message: string }>;
      };
    }>(
      `mutation StageProductImage($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets { url resourceUrl parameters { name value } }
          userErrors { field message }
        }
      }`,
      {
        input: [{ filename, mimeType: type, resource: "PRODUCT_IMAGE", httpMethod: "POST" }],
      },
    );
    assertUserErrors(data.stagedUploadsCreate.userErrors);
    const target = data.stagedUploadsCreate.stagedTargets[0];
    if (!target) throw new Error(`Shopify did not return a staged upload target for ${filename}`);
    const form = new FormData();
    for (const parameter of target.parameters) form.append(parameter.name, parameter.value);
    form.append("file", new Blob([bytes], { type }), filename);
    const response = await this.uploadFetch(target.url, { method: "POST", body: form });
    if (!response.ok) throw new Error(`staged image upload failed with HTTP ${response.status}`);
    return target.resourceUrl;
  }

  async upsertProduct(
    sourceValue: string,
    input: ProductSetInput,
  ): Promise<{ id: string; title: string; status: string }> {
    const data = await this.request<{
      productSet: {
        product: { id: string; title: string; status: string } | null;
        userErrors: Array<{ code?: string; field?: string[]; message: string }>;
      };
    }>(
      `mutation UpsertSourcedProduct($input: ProductSetInput!, $identifier: ProductSetIdentifiers) {
        productSet(synchronous: true, input: $input, identifier: $identifier) {
          product { id title status }
          userErrors { code field message }
        }
      }`,
      {
        input,
        identifier: {
          customId: { namespace: SOURCE_NAMESPACE, key: SOURCE_KEY, value: sourceValue },
        },
      },
    );
    assertUserErrors(data.productSet.userErrors);
    if (!data.productSet.product) throw new Error("productSet returned no product");
    return data.productSet.product;
  }
}
