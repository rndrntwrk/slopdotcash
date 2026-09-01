# Slop Delegate project policy v1

This document defines the reviewed, immutable opt-in by which a Slop project permits work to be delegated through Delegate. It does not give Delegate authority over GitHub, Slop Score, maintainer acceptance, private traces, wallets, funding, or settlement.

## Authority and location

A participating target repository stores one policy document at:

```text
.github/slop-delegate.json
```

The repository's reviewed Slop `project.json` uses schema version `2` and binds the exact policy bytes through a commit SHA, SHA-256 digest, immutable GitHub blob URL, policy revision, activation time, and lifecycle state. A schema-v1 project has no Delegate field and remains semantically unchanged.

The binding is evidence that Slop reviewers accepted a particular policy revision. It is not proof that Delegate is available, that work is reserved, that a worker will complete it, that a contribution will be merged, or that money will be paid.

## Binding

```json
{
  "state": "active",
  "policyRevision": "2026-09-01.1",
  "activatedAt": "2026-09-01T00:00:00.000Z",
  "proof": {
    "commitSha": "<40 lowercase hex characters>",
    "fileSha256": "<64 lowercase hex characters>",
    "url": "https://github.com/OWNER/REPOSITORY/blob/<commit>/.github/slop-delegate.json"
  }
}
```

Allowed states are:

- `active`: new delegations may be published subject to the bound policy;
- `paused`: no new delegation may be published or leased, while existing records remain auditable and may be wound down according to their contract;
- `revoked`: terminal project opt-out. Existing public history remains available, but no new Delegate operation is authorized.

`null` is an explicit schema-v2 non-activation value. Removing a historic non-null binding is forbidden; use a reviewed successor with `state: "revoked"`.

## Successor transitions

A policy mutation is append-only through Git history. A successor must:

1. use a new `policyRevision`;
2. activate strictly after the prior binding;
3. point to a new immutable commit, digest, and URL;
4. follow one of `active → paused`, `paused → active`, `active → revoked`, or `paused → revoked`;
5. never transition out of `revoked`.

An unchanged binding may be carried forward byte-for-byte. Editing a historic revision in place, reusing a proof for new semantics, deleting the binding, or using a mutable URL fails closed.

## Policy object

The bound policy contains exactly these top-level fields:

```text
schemaVersion
projectId
repositoryId
integrationBranch
visibility
delegatableSources
leasePolicy
acceptancePolicy
rewardPolicy
contextPolicy
securityPolicy
```

### Identity

- `schemaVersion` is `"1"`.
- `projectId` equals the Slop project ID.
- `repositoryId` identifies one registered project repository.
- `integrationBranch` equals the registered integration branch.
- `visibility` is `"public"` in this protocol version.

The Delegate control plane must independently verify these joins before publishing a Delegation Contract. Slop manifest validation establishes structure and immutable provenance; it does not replace live GitHub verification.

### Delegatable sources

The non-empty, duplicate-free `delegatableSources` array may contain:

- `agent_checkpoint`;
- `greenfield_goal`;
- `github_issue`;
- `github_pull_request`;
- `project_selected`.

A source class permits intake; it does not guarantee that a particular source is safe, bounded, unclaimed, or eligible.

### Lease policy

`leasePolicy.mode` is `delegate_only_exclusive`. Exclusivity applies only to the Delegate contract and never assigns or reserves a GitHub issue or pull request.

- `defaultSeconds`: 300–86,400;
- `maximumSeconds`: 300–604,800 and not less than the default;
- `heartbeatSeconds`: 30–3,600 and shorter than the default lease;
- `graceSeconds`: 0–3,600 and not greater than the default lease.

### Acceptance policy

- `authority` is `github_maintainer`;
- `requiresTechnicalPass` is `true`;
- `requiresExactHead` is `true`;
- `requiresMerge` is project-selected.

Delegate technical verification and GitHub acceptance are separate keys. Technical success cannot fabricate maintainer acceptance. When merge is required, the accepted exact head must be reachable from the configured integration branch according to live GitHub evidence.

### Reward policy

The enabled reward modes are an explicit subset of `slop_pool` and `fixed_usdc`, and `defaultMode` must be enabled.

`slop_pool` preserves Slop's existing projected monthly-pool semantics. Delegation, estimates, leases, token usage, or worker identity do not alter Score v2.

`fixed_usdc` is disabled unless its nested record is fully configured. When disabled, network, mint, and maximum amount are `null`. When enabled, the mode must be listed and the policy must bind a supported Solana network, USDC mint, and positive integer maximum in minor units. Enabling a mode does not prove funding or settlement.

### Context policy

- `maximumBytes`: 1–104,857,600;
- `allowUncommittedPatch`: explicit boolean;
- `allowPrivateTraceReuse`: always `false`;
- `retentionDays`: 1–365.

Slop private trace bodies are never handoff context. Delegate constructs a separate minimized Continuation Package, locally reviewed before upload, encrypted to its intended recipient, and governed by an independent retention and access contract.

### Security policy

- `networkDefault` is `deny` or `restricted`;
- `requireSecretScan` is `true`;
- `allowBinaries` is `false` in v1.

These are minimums, not guarantees. The local connector and execution runtime must fail closed when they cannot enforce the policy.

## Validation and drift

Slop validates exact keys, canonical timestamps, numeric bounds, immutable GitHub URLs, repository identity, commit and digest syntax, privacy invariants, and successor transitions. The Delegate control plane separately fetches and hashes the policy at its immutable URL before use.

Any unknown field, unsupported enum, impossible bound, future activation, repository mismatch, mutable URL, private-trace reuse, or inconsistent fixed-reward state is invalid.
