#!/usr/bin/env node
import { Command } from "commander";

import { readReport, createReport, writeReport } from "./report.js";
import { loadRules } from "./rules.js";
import { validateJsonl } from "./schema.js";
import { SHOPIFY_API_VERSION, ShopifyGateway } from "./shopify.js";
import { planProduct, sourceKey, transformProduct } from "./transform.js";

function printValidation(errors: Awaited<ReturnType<typeof validateJsonl>>["errors"]): void {
  for (const issue of errors) {
    console.error(`line ${issue.line}:`);
    for (const error of issue.errors) console.error(`  - ${error}`);
  }
}

const program = new Command();
program.name("lister").description("Validate, plan, and idempotently upsert sourced products to Shopify");

program
  .command("validate")
  .argument("<path.jsonl>")
  .action(async (path: string) => {
    const result = await validateJsonl(path);
    printValidation(result.errors);
    console.log(JSON.stringify({ valid: result.records.length, invalid: result.errors.length }, null, 2));
    if (result.errors.length) process.exitCode = 1;
  });

program
  .command("plan")
  .argument("<path.jsonl>")
  .action(async (path: string) => {
    const [validation, rules] = await Promise.all([validateJsonl(path), loadRules()]);
    printValidation(validation.errors);
    if (validation.errors.length) {
      process.exitCode = 1;
      return;
    }
    const plan = validation.records.map((product) => planProduct(product, rules));
    console.table(
      plan.map((item) => ({
        sourceKey: item.sourceKey,
        action: item.action,
        title: item.title,
        priceRange: item.prices.length
          ? `${Math.min(...item.prices).toLocaleString("ko-KR")}–${Math.max(...item.prices).toLocaleString("ko-KR")}`
          : "-",
        variants: item.variants,
        warnings: item.warnings.join(", "),
        error: item.error ?? "",
      })),
    );
    if (plan.some((item) => item.action === "SKIP")) process.exitCode = 1;
  });

program
  .command("push")
  .argument("<path.jsonl>")
  .option("--publish", "create products as ACTIVE instead of DRAFT", false)
  .option("--limit <count>", "maximum number of valid products", (value) => Number.parseInt(value, 10))
  .action(async (path: string, options: { publish: boolean; limit?: number }) => {
    const [validation, rules] = await Promise.all([validateJsonl(path), loadRules()]);
    printValidation(validation.errors);
    if (validation.errors.length) {
      console.error("push aborted before any Shopify write because input validation failed");
      process.exitCode = 1;
      return;
    }
    if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1)) {
      throw new Error("--limit must be a positive integer");
    }

    const products = validation.records.slice(0, options.limit);
    const gateway = ShopifyGateway.fromEnvironment();
    const report = createReport(options.publish, SHOPIFY_API_VERSION);
    await gateway.ensureSourceDefinition();
    const configuredLocation = process.env.SHOPIFY_LOCATION_ID;
    const needsLocation = products.some((product) => product.variants.some((variant) => variant.stock != null));
    const locationId = configuredLocation ?? (needsLocation ? await gateway.firstLocationId() : undefined);

    for (const product of products) {
      const key = sourceKey(product);
      try {
        const existing = await gateway.findProduct(key);
        const imageSources: string[] = [];
        for (const image of product.images.slice().sort((a, b) => a.position - b.position)) {
          imageSources.push(image.localPath ? await gateway.stageLocalImage(image.localPath) : image.sourceUrl);
        }
        const input = transformProduct(product, rules, {
          publish: options.publish,
          ...(locationId ? { locationId } : {}),
          imageSources,
        });
        const uploaded = await gateway.upsertProduct(key, input);
        report.results.push({
          sourceKey: key,
          action: existing ? "UPDATE" : "CREATE",
          productId: uploaded.id,
          title: uploaded.title,
        });
      } catch (error) {
        report.results.push({
          sourceKey: key,
          action: "FAILED",
          title: product.title,
          error: (error as Error).message,
        });
      }
    }
    report.finishedAt = new Date().toISOString();
    const reportPath = await writeReport(report);
    console.log(JSON.stringify({ runId: report.runId, reportPath, results: report.results }, null, 2));
    if (report.results.some((result) => result.action === "FAILED")) process.exitCode = 1;
  });

program
  .command("report")
  .argument("<runId>")
  .action(async (runId: string) => {
    console.log(JSON.stringify(await readReport(runId), null, 2));
  });

program.parseAsync().catch((error: unknown) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
