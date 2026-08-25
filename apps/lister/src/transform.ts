import sanitizeHtml from "sanitize-html";

import type { Rules } from "./rules.js";
import type { SourcedProduct } from "./schema.js";

export const SHOPIFY_OPTION_LIMIT = 3;
export const SHOPIFY_VARIANT_LIMIT = 2048;

function startsWithPath(path: string[], prefix: string[]): boolean {
  return prefix.every((part, index) => path[index] === part);
}

function multiplierFor(product: SourcedProduct, rules: Rules): number {
  const category = product.sourceCategory ?? [];
  const matching = rules.categoryOverrides
    .filter((override) => startsWithPath(category, override.sourcePrefix))
    .sort((a, b) => b.sourcePrefix.length - a.sourcePrefix.length)[0];
  return matching?.multiplier ?? rules.defaultMultiplier;
}

export function calculateRetailPrice(wholesalePrice: number, multiplier: number, rules: Rules): number {
  const markedUp = wholesalePrice * multiplier + rules.fixedFee;
  const withMarginFloor = Math.max(markedUp, wholesalePrice + rules.minimumMargin);
  return Math.ceil(withMarginFloor / rules.rounding) * rules.rounding;
}

export function sanitizeDescription(html: string | null | undefined, rules: Rules): string {
  return sanitizeHtml(html ?? "", {
    allowedTags: rules.description.allowedTags,
    allowedAttributes: rules.description.allowedAttributes,
    allowedSchemes: ["http", "https"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
  });
}

export function sourceKey(product: SourcedProduct): string {
  return `${product.source.site}:${product.source.sourceId}`;
}

export interface TransformOptions {
  publish?: boolean;
  locationId?: string;
  imageSources?: string[];
}

export interface ProductSetInput {
  title: string;
  descriptionHtml: string;
  vendor?: string;
  status: "ACTIVE" | "DRAFT";
  tags: string[];
  category?: string;
  metafields: Array<{ namespace: string; key: string; value: string }>;
  productOptions: Array<{
    name: string;
    position: number;
    values: Array<{ name: string }>;
  }>;
  variants: Array<{
    optionValues: Array<{ optionName: string; name: string }>;
    price: string;
    compareAtPrice?: string;
    sku?: string;
    barcode?: string;
    inventoryItem: { tracked: boolean };
    inventoryQuantities?: Array<{ locationId: string; name: "available"; quantity: number }>;
  }>;
  files: Array<{ originalSource: string; alt?: string; contentType: "IMAGE" }>;
}

export function assertShopifyCompatibility(product: SourcedProduct, rules: Rules): void {
  const options = product.options ?? [];
  if (options.length > SHOPIFY_OPTION_LIMIT) {
    throw new Error(`Shopify supports at most ${SHOPIFY_OPTION_LIMIT} options; received ${options.length}`);
  }
  if (product.variants.length > SHOPIFY_VARIANT_LIMIT) {
    throw new Error(`Shopify supports at most ${SHOPIFY_VARIANT_LIMIT} variants; received ${product.variants.length}`);
  }
  const optionNames = new Set(options.map((option) => option.name));
  if (optionNames.size !== options.length) throw new Error("option names must be unique");
  const combinations = new Set<string>();
  for (const [index, variant] of product.variants.entries()) {
    if (variant.optionValues.length !== options.length) {
      throw new Error(`variant ${index + 1} has ${variant.optionValues.length} values for ${options.length} options`);
    }
    variant.optionValues.forEach((value, optionIndex) => {
      if (!options[optionIndex]?.values.includes(value)) {
        throw new Error(`variant ${index + 1} contains unknown option value ${value}`);
      }
    });
    const combination = JSON.stringify(variant.optionValues);
    if (combinations.has(combination)) throw new Error(`duplicate variant option combination at variant ${index + 1}`);
    combinations.add(combination);
    if (!rules.supportedCurrencies.includes(variant.currency)) {
      throw new Error(`unsupported currency ${variant.currency}`);
    }
  }
}

export function transformProduct(
  product: SourcedProduct,
  rules: Rules,
  options: TransformOptions = {},
): ProductSetInput {
  assertShopifyCompatibility(product, rules);
  const sourceCategory = product.sourceCategory ?? [];
  const categoryMapping = rules.categoryMappings
    .filter((mapping) => startsWithPath(sourceCategory, mapping.sourcePrefix))
    .sort((a, b) => b.sourcePrefix.length - a.sourcePrefix.length)[0];
  const multiplier = multiplierFor(product, rules);
  const productOptions = product.options ?? [];

  const input: ProductSetInput = {
    title: product.title,
    descriptionHtml: sanitizeDescription(product.descriptionHtml, rules),
    status: options.publish ? "ACTIVE" : "DRAFT",
    tags: [...new Set([...(categoryMapping?.tags ?? []), `source:${product.source.site}`])],
    metafields: [{ namespace: "sourcing", key: "source_key", value: sourceKey(product) }],
    productOptions: productOptions.map((option, index) => ({
      name: option.name,
      position: index + 1,
      values: option.values.map((name) => ({ name })),
    })),
    variants: product.variants.map((variant) => {
      const transformed: ProductSetInput["variants"][number] = {
        optionValues: variant.optionValues.map((name, index) => ({
          optionName: productOptions[index]!.name,
          name,
        })),
        price: String(calculateRetailPrice(variant.wholesalePrice, multiplier, rules)),
        inventoryItem: { tracked: variant.stock != null },
      };
      if (variant.listPrice != null) transformed.compareAtPrice = String(variant.listPrice);
      if (variant.sourceSku) transformed.sku = variant.sourceSku;
      if (variant.barcode) transformed.barcode = variant.barcode;
      if (variant.stock != null && options.locationId) {
        transformed.inventoryQuantities = [
          { locationId: options.locationId, name: "available", quantity: variant.stock },
        ];
      }
      return transformed;
    }),
    files: product.images
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((image, index) => {
        const file: ProductSetInput["files"][number] = {
          originalSource: options.imageSources?.[index] ?? image.sourceUrl,
          contentType: "IMAGE",
        };
        if (image.alt) file.alt = image.alt;
        return file;
      }),
  };
  if (product.brand) input.vendor = product.brand;
  if (categoryMapping?.productCategoryId) input.category = categoryMapping.productCategoryId;
  return input;
}

export interface PlanItem {
  sourceKey: string;
  title: string;
  action: "CREATE_OR_UPDATE" | "SKIP";
  prices: number[];
  variants: number;
  warnings: string[];
  error?: string;
}

export function planProduct(product: SourcedProduct, rules: Rules): PlanItem {
  try {
    assertShopifyCompatibility(product, rules);
    const multiplier = multiplierFor(product, rules);
    return {
      sourceKey: sourceKey(product),
      title: product.title,
      action: "CREATE_OR_UPDATE",
      prices: product.variants.map((variant) => calculateRetailPrice(variant.wholesalePrice, multiplier, rules)),
      variants: product.variants.length,
      warnings: product.warnings ?? [],
    };
  } catch (error) {
    return {
      sourceKey: sourceKey(product),
      title: product.title,
      action: "SKIP",
      prices: [],
      variants: product.variants.length,
      warnings: product.warnings ?? [],
      error: (error as Error).message,
    };
  }
}
