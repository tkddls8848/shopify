import type { Rules } from "../src/rules.js";
import type { SourcedProduct } from "../src/schema.js";

export const rules: Rules = {
  defaultMultiplier: 1.8,
  fixedFee: 0,
  minimumMargin: 2000,
  rounding: 100,
  supportedCurrencies: ["KRW"],
  categoryOverrides: [{ sourcePrefix: ["패션"], multiplier: 2 }],
  categoryMappings: [{ sourcePrefix: ["패션"], tags: ["fashion"] }],
  description: {
    allowedTags: ["p", "strong", "a", "img"],
    allowedAttributes: { a: ["href"], img: ["src", "alt"] },
  },
};

export function product(overrides: Partial<SourcedProduct> = {}): SourcedProduct {
  return {
    schemaVersion: 1,
    source: {
      site: "demo",
      sourceId: "one",
      url: "https://supplier.example/products/one",
      scrapedAt: "2026-08-26T00:00:00Z",
    },
    title: "테스트 상품",
    descriptionHtml: '<p>설명<script>alert(1)</script><a href="javascript:bad">bad</a></p>',
    brand: "테스트 브랜드",
    sourceCategory: ["패션", "상의"],
    options: [],
    variants: [
      {
        sourceSku: "ONE",
        optionValues: [],
        wholesalePrice: 1000,
        currency: "KRW",
        stock: null,
      },
    ],
    images: [],
    warnings: [],
    ...overrides,
  };
}
