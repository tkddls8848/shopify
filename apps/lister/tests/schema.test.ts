import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { validateJsonl } from "../src/schema.js";
import { product } from "./helpers.js";

describe("JSONL validation", () => {
  it("accepts the committed sample through JSON Schema and Zod", async () => {
    const result = await validateJsonl(join(process.cwd(), "samples", "products.jsonl"));
    expect(result.errors).toEqual([]);
    expect(result.records).toHaveLength(3);
  });

  it("reports malformed JSON and unknown schema versions with line numbers", async () => {
    const path = join(process.cwd(), ".invalid-test.jsonl");
    await writeFile(path, `${JSON.stringify({ ...product(), schemaVersion: 2 })}\n{bad`, "utf8");
    try {
      const result = await validateJsonl(path);
      expect(result.records).toHaveLength(0);
      expect(result.errors.map((error) => error.line)).toEqual([1, 2]);
    } finally {
      const { unlink } = await import("node:fs/promises");
      await unlink(path);
    }
  });
});
