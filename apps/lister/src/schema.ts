import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import type { FormatsPlugin } from "ajv-formats";
import { z } from "zod";

import { repositoryRoot } from "./paths.js";

const addFormats = createRequire(import.meta.url)("ajv-formats") as FormatsPlugin;

const sourceSchema = z.strictObject({
  site: z.string(),
  sourceId: z.string(),
  url: z.url(),
  scrapedAt: z.iso.datetime({ offset: true }),
  adapterVersion: z.string().nullable().optional(),
});

const optionSchema = z.strictObject({
  name: z.string(),
  values: z.array(z.string()).min(1),
});

const variantSchema = z.strictObject({
  sourceSku: z.string().nullable().optional(),
  optionValues: z.array(z.string()),
  wholesalePrice: z.number().nonnegative(),
  listPrice: z.number().nonnegative().nullable().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  stock: z.number().int().nonnegative().nullable().optional(),
  barcode: z.string().nullable().optional(),
});

const imageSchema = z.strictObject({
  sourceUrl: z.url(),
  localPath: z.string().nullable().optional(),
  position: z.number().int().nonnegative(),
  role: z.enum(["main", "gallery", "detail"]).optional(),
  alt: z.string().nullable().optional(),
});

const supplySchema = z.strictObject({
  moq: z.number().int().min(1).nullable().optional(),
  shippingFeeText: z.string().nullable().optional(),
  leadTimeDays: z.number().int().nonnegative().nullable().optional(),
  origin: z.string().nullable().optional(),
  sellerName: z.string().nullable().optional(),
});

export const sourcedProductSchema = z.strictObject({
  schemaVersion: z.literal(1),
  source: sourceSchema,
  title: z.string().min(1),
  descriptionHtml: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  sourceCategory: z.array(z.string()).optional(),
  options: z.array(optionSchema).optional(),
  variants: z.array(variantSchema).min(1),
  images: z.array(imageSchema),
  supply: supplySchema.nullable().optional(),
  warnings: z.array(z.string()).optional(),
});

export type SourcedProduct = z.infer<typeof sourcedProductSchema>;

export interface ValidationIssue {
  line: number;
  errors: string[];
}

export interface ValidationResult {
  records: SourcedProduct[];
  errors: ValidationIssue[];
}

let contractValidator: ((data: unknown) => boolean) & { errors?: ErrorObject[] | null };

async function getContractValidator() {
  if (contractValidator) return contractValidator;
  const schema = JSON.parse(
    await readFile(join(repositoryRoot(), "contracts", "product.schema.json"), "utf8"),
  ) as object;
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  contractValidator = ajv.compile(schema);
  return contractValidator;
}

function formatAjvErrors(errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map((error) => `schema ${error.instancePath || "/"} ${error.message ?? "is invalid"}`);
}

export async function validateJsonl(path: string): Promise<ValidationResult> {
  const content = await readFile(path, "utf8");
  const validateContract = await getContractValidator();
  const records: SourcedProduct[] = [];
  const errors: ValidationIssue[] = [];
  for (const [index, line] of content.split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch (error) {
      errors.push({ line: index + 1, errors: [`JSON ${(error as Error).message}`] });
      continue;
    }

    const contractValid = validateContract(value);
    const contractErrors = contractValid ? [] : formatAjvErrors(validateContract.errors);
    const zodResult = sourcedProductSchema.safeParse(value);
    const zodErrors = zodResult.success
      ? []
      : zodResult.error.issues.map((issue) => `zod /${issue.path.join("/")} ${issue.message}`);
    if (!contractValid || !zodResult.success) {
      errors.push({ line: index + 1, errors: [...contractErrors, ...zodErrors] });
      continue;
    }
    records.push(zodResult.data);
  }
  return { records, errors };
}
