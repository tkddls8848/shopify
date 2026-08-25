import { describe, expect, it } from "vitest";

import {
  calculateRetailPrice,
  planProduct,
  sanitizeDescription,
  transformProduct,
} from "../src/transform.js";
import { product, rules } from "./helpers.js";

describe("product transformation", () => {
  it("applies markup, margin floor, and rounding", () => {
    expect(calculateRetailPrice(1000, 1.2, rules)).toBe(3000);
    expect(calculateRetailPrice(8900, 2, rules)).toBe(17800);
  });

  it("sanitizes scripts and unsafe URL schemes", () => {
    const cleaned = sanitizeDescription(product().descriptionHtml, rules);
    expect(cleaned).not.toContain("script");
    expect(cleaned).not.toContain("javascript:");
    expect(cleaned).toContain("<p>");
  });

  it("maps null stock to untracked and zero stock to tracked zero", () => {
    const input = transformProduct(
      product({
        variants: [
          { sourceSku: "UNKNOWN", optionValues: [], wholesalePrice: 1000, currency: "KRW", stock: null },
        ],
      }),
      rules,
      { locationId: "gid://shopify/Location/1" },
    );
    expect(input.status).toBe("DRAFT");
    expect(input.variants[0]?.inventoryItem.tracked).toBe(false);
    expect(input.variants[0]?.inventoryQuantities).toBeUndefined();

    const soldOut = transformProduct(
      product({
        variants: [
          { sourceSku: "ZERO", optionValues: [], wholesalePrice: 1000, currency: "KRW", stock: 0 },
        ],
      }),
      rules,
      { locationId: "gid://shopify/Location/1" },
    );
    expect(soldOut.variants[0]?.inventoryItem.tracked).toBe(true);
    expect(soldOut.variants[0]?.inventoryQuantities?.[0]?.quantity).toBe(0);
  });

  it("refuses silent truncation when option limits are exceeded", () => {
    const unsafe = product({
      options: ["A", "B", "C", "D"].map((name) => ({ name, values: ["x"] })),
      variants: [
        { optionValues: ["x", "x", "x", "x"], wholesalePrice: 1, currency: "KRW", stock: 1 },
      ],
    });
    expect(planProduct(unsafe, rules)).toMatchObject({ action: "SKIP" });
    expect(() => transformProduct(unsafe, rules)).toThrow(/at most 3 options/u);
  });
});
