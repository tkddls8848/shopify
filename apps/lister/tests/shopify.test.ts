import { describe, expect, it, vi } from "vitest";

import type { GraphqlTransport } from "../src/shopify.js";
import { ShopifyGateway } from "../src/shopify.js";

function transportWith(...responses: unknown[]): { transport: GraphqlTransport; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn(async () => responses.shift());
  return { transport: { request } as unknown as GraphqlTransport, request };
}

describe("Shopify gateway", () => {
  it("looks up an existing product and upserts by the same custom ID", async () => {
    const { transport, request } = transportWith(
      { data: { productByIdentifier: { id: "gid://shopify/Product/1", title: "old" } } },
      {
        data: {
          productSet: {
            product: { id: "gid://shopify/Product/1", title: "new", status: "DRAFT" },
            userErrors: [],
          },
        },
      },
    );
    const gateway = new ShopifyGateway(transport);
    expect(await gateway.findProduct("demo:one")).toMatchObject({ id: "gid://shopify/Product/1" });
    const input = {
      title: "new",
      descriptionHtml: "",
      status: "DRAFT" as const,
      tags: [],
      metafields: [{ namespace: "sourcing", key: "source_key", value: "demo:one" }],
      productOptions: [],
      variants: [{ optionValues: [], price: "3000", inventoryItem: { tracked: false } }],
      files: [],
    };
    expect(await gateway.upsertProduct("demo:one", input)).toMatchObject({ title: "new" });
    expect(request.mock.calls[0]?.[1]).toMatchObject({
      variables: { identifier: { customId: { value: "demo:one" } } },
    });
    expect(request.mock.calls[1]?.[1]).toMatchObject({
      variables: { identifier: { customId: { value: "demo:one" } } },
    });
  });

  it("waits proactively when GraphQL cost budget is low", async () => {
    const sleep = vi.fn(async () => undefined);
    const { transport } = transportWith({
      data: { locations: { nodes: [{ id: "gid://shopify/Location/1" }] } },
      extensions: {
        cost: { actualQueryCost: 40, throttleStatus: { currentlyAvailable: 20, restoreRate: 20 } },
      },
    });
    const gateway = new ShopifyGateway(transport, sleep);
    expect(await gateway.firstLocationId()).toBe("gid://shopify/Location/1");
    expect(sleep).toHaveBeenCalledWith(3000);
  });

  it("treats an existing metafield definition as success", async () => {
    const { transport } = transportWith({
      data: {
        metafieldDefinitionCreate: {
          createdDefinition: null,
          userErrors: [{ code: "TAKEN", message: "Key is already taken" }],
        },
      },
    });
    await expect(new ShopifyGateway(transport).ensureSourceDefinition()).resolves.toBeUndefined();
  });

  it("stages and uploads local images", async () => {
    const { transport } = transportWith({
      data: {
        stagedUploadsCreate: {
          stagedTargets: [
            {
              url: "https://upload.example/target",
              resourceUrl: "https://cdn.example/staged.svg",
              parameters: [{ name: "key", value: "value" }],
            },
          ],
          userErrors: [],
        },
      },
    });
    const upload = vi.fn(async () => new Response(null, { status: 204 }));
    const gateway = new ShopifyGateway(transport, async () => undefined, upload as typeof fetch);
    await expect(gateway.stageLocalImage("apps/lister/tests/fixtures/image.svg")).resolves.toBe(
      "https://cdn.example/staged.svg",
    );
    expect(upload).toHaveBeenCalledOnce();
  });
});
