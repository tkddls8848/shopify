import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import { listerRoot } from "./paths.js";

const prefixSchema = z.array(z.string());

export const rulesSchema = z.strictObject({
  defaultMultiplier: z.number().positive(),
  fixedFee: z.number().nonnegative(),
  minimumMargin: z.number().nonnegative(),
  rounding: z.number().positive(),
  supportedCurrencies: z.array(z.string().regex(/^[A-Z]{3}$/)).min(1),
  categoryOverrides: z.array(
    z.strictObject({ sourcePrefix: prefixSchema, multiplier: z.number().positive() }),
  ),
  categoryMappings: z.array(
    z.strictObject({
      sourcePrefix: prefixSchema,
      tags: z.array(z.string()),
      productCategoryId: z.string().optional(),
    }),
  ),
  description: z.strictObject({
    allowedTags: z.array(z.string()),
    allowedAttributes: z.record(z.string(), z.array(z.string())),
  }),
});

export type Rules = z.infer<typeof rulesSchema>;

export async function loadRules(path = join(listerRoot(), "config", "rules.json")): Promise<Rules> {
  return rulesSchema.parse(JSON.parse(await readFile(path, "utf8")));
}
