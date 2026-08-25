import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { listerRoot } from "./paths.js";

export interface PushResult {
  sourceKey: string;
  action: "CREATE" | "UPDATE" | "FAILED";
  productId?: string;
  title: string;
  error?: string;
}

export interface PushReport {
  runId: string;
  startedAt: string;
  finishedAt?: string;
  publish: boolean;
  apiVersion: string;
  results: PushResult[];
}

export function createReport(publish: boolean, apiVersion: string): PushReport {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/gu, "").slice(0, 14);
  return {
    runId: `${timestamp}-${randomUUID().slice(0, 8)}`,
    startedAt: new Date().toISOString(),
    publish,
    apiVersion,
    results: [],
  };
}

export async function writeReport(report: PushReport): Promise<string> {
  const root = join(listerRoot(), "runs");
  await mkdir(root, { recursive: true });
  const path = join(root, `${report.runId}.json`);
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await rename(temporary, path);
  return path;
}

export async function readReport(runId: string): Promise<PushReport> {
  if (!/^[a-zA-Z0-9-]+$/u.test(runId)) throw new Error("invalid runId");
  return JSON.parse(await readFile(join(listerRoot(), "runs", `${runId}.json`), "utf8")) as PushReport;
}
