import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");
const MANIFEST_PATH = resolve(ROOT, "docs/delegate/slop-baseline.json");
const SHA256_RE = /^[a-f0-9]{64}$/;
const COMMIT_RE = /^[a-f0-9]{40}$/;

const REQUIRED_SOURCE_PATHS = [
  "AGENTS.md",
  "CLAUDE.md",
  "package.json",
  "src/lib/project-schema.mjs",
  "scripts/sync-project-registry.mjs",
  "src/lib/run-receipts.ts",
  "src/lib/review-records.ts",
  "src/lib/score-records.ts",
  "protocol/scoring-v2.md",
  "protocol/private-trace-v1.md",
  "backend/trace/README.md",
  "src/lib/project-view.ts",
];

async function sha256(path) {
  const bytes = await readFile(resolve(ROOT, path));
  return createHash("sha256").update(bytes).digest("hex");
}

async function readManifest() {
  const raw = await readFile(MANIFEST_PATH, "utf8");
  const value = JSON.parse(raw);
  expect(Object.keys(value).sort()).toEqual([
    "capturedAt",
    "packageManager",
    "privateTraceRevision",
    "projectSchemaRevision",
    "receiptMarker",
    "scoreRuleRevision",
    "sourceCommit",
    "sources",
    "verificationCommands",
  ]);
  return value;
}

describe("Delegate integration baseline", () => {
  it("pins every authority-bearing Slop source by path and SHA-256", async () => {
    const manifest = await readManifest();

    expect(manifest.sourceCommit).toMatch(COMMIT_RE);
    expect(manifest.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(manifest.packageManager).toBe("bun@1.3.14");
    expect(manifest.projectSchemaRevision).toBe("1");
    expect(manifest.receiptMarker).toBe("slop-contribution-attribution:v1");
    expect(manifest.scoreRuleRevision).toBe("scoring-v2");
    expect(manifest.privateTraceRevision).toBe("private-trace-v1");
    expect(manifest.verificationCommands).toEqual([
      "bun install --frozen-lockfile",
      "bun run verify",
      "bun run test:e2e",
    ]);

    const sourcePaths = manifest.sources.map((source) => source.path);
    expect(sourcePaths).toEqual(REQUIRED_SOURCE_PATHS);

    for (const source of manifest.sources) {
      expect(Object.keys(source).sort()).toEqual(["path", "sha256"]);
      expect(source.sha256).toMatch(SHA256_RE);
      await expect(sha256(source.path)).resolves.toBe(source.sha256);
    }
  });

  it("keeps AGENTS.md and CLAUDE.md byte-identical", async () => {
    await expect(readFile(resolve(ROOT, "AGENTS.md"))).resolves.toEqual(
      await readFile(resolve(ROOT, "CLAUDE.md")),
    );
  });
});
