import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function ancestors(start: string): string[] {
  const result: string[] = [];
  let cursor = resolve(start);
  while (true) {
    result.push(cursor);
    const parent = dirname(cursor);
    if (parent === cursor) return result;
    cursor = parent;
  }
}

export function repositoryRoot(): string {
  const starts = [process.cwd(), dirname(fileURLToPath(import.meta.url))];
  for (const start of starts) {
    for (const candidate of ancestors(start)) {
      if (existsSync(join(candidate, "contracts", "product.schema.json"))) return candidate;
    }
  }
  throw new Error("could not locate repository root containing contracts/product.schema.json");
}

export function listerRoot(): string {
  const direct = join(repositoryRoot(), "apps", "lister");
  if (existsSync(join(direct, "package.json"))) return direct;
  for (const candidate of ancestors(process.cwd())) {
    const packagePath = join(candidate, "package.json");
    if (!existsSync(packagePath)) continue;
    const manifest = JSON.parse(readFileSync(packagePath, "utf8")) as { name?: string };
    if (manifest.name === "@morrow/lister") return candidate;
  }
  throw new Error("could not locate apps/lister");
}
