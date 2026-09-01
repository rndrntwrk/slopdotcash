# Delegate × Slop integration source audit

## Audit identity

- Upstream repository: `SlopDotCash/slopdotcash`
- Audited branch: `develop`
- Audited commit: `18a4c4c6fe67574b164274ae5b743e4e1ce95ff5`
- Captured at: `2026-09-01T14:40:55.000Z`
- Implementation branch: `rndrntwrk/slopdotcash:delegate/slop-extension-v0.1`
- Package manager: `bun@1.3.14`
- Project schema revision: `1`
- Contribution receipt marker: `slop-contribution-attribution:v1`
- Scoring contract: `scoring-v2`
- Private trace contract: `private-trace-v1`

The audited upstream commit was the current `develop` head when implementation began. The Delegate branch was created directly from those bytes. The manifest in `slop-baseline.json` binds every authority-bearing source listed below to its SHA-256 digest.

## Authority boundaries preserved by Delegate

1. GitHub remains authoritative for repository identity, issue and pull-request state, exact commits, review state, merges, assignment, and maintainer decisions.
2. `projects/*/project.json` remains Slop's sole project inventory. Delegate may consume a reviewed opt-in binding in a later task, but cannot create a second project registry.
3. Existing Slop contribution receipts remain the attribution boundary. Delegate lineage is additive and cannot reinterpret provider, model, client, actor, or run identity.
4. Slop Score v2 remains unchanged. Delegation, estimates, leases, token usage, and prices do not create score.
5. Slop private trace bodies are not continuation packages. They remain permanently private, write-only to contributors, and unavailable to Delegate workers.
6. Slop funding and settlement records remain append-only evidence. Delegate cannot claim custody, payment authority, or settlement success from a proposed or unsigned transaction.
7. A Delegate lease is an operational execution right inside Delegate only. It never assigns or reserves GitHub work.
8. Maintainer acceptance remains necessary for a public-code outcome even when Delegate technical verification passes.

## Bound sources

| Source | Why it is authority-bearing | SHA-256 |
| --- | --- | --- |
| `AGENTS.md` | Repository-wide product, authority, privacy, scoring, and deployment rules | `4ec1026512eb5c00301ad2183c012fe08420d20c0319c963005d2ee1bbbdc00f` |
| `CLAUDE.md` | Required byte-identical agent instructions | `4ec1026512eb5c00301ad2183c012fe08420d20c0319c963005d2ee1bbbdc00f` |
| `package.json` | Pinned toolchain and canonical verification commands | `6af1143d0ec2e50c253cac55500eed4f46d195f7305289d6064bc06ef9d7ff04` |
| `src/lib/project-schema.mjs` | Project-manifest validation and schema-v1 compatibility boundary | `a1f9b4f138756c7854da3f405b7cf08d9d2200e6fe2b24d8849f0cec65c0e21c` |
| `scripts/sync-project-registry.mjs` | Canonical project-registry generation | `a46ff5efe2a7cfb04d779947b4dd765723173d1dd8268853105bc9de2407041c` |
| `src/lib/run-receipts.ts` | Signed contribution receipt parsing and validation | `e151d524e39ae1ead004999336272f9b1089650f6ff5c45b881a4059dd562769` |
| `src/lib/review-records.ts` | Review evidence and review-record interpretation | `13667ea583e9a3906a33d474089e3b9b189f462bbc3de33815eae4b088539071` |
| `src/lib/score-records.ts` | Human-ratified score records and work-unit grouping | `62414ee61c2ff25e58cd01af65621cbd51a6764e337c787ec4dc93d2cbe59077` |
| `protocol/scoring-v2.md` | Canonical outcome-scoring policy | `ec4dd6154c580f835e15b8555126a9ed5524978a54ef9e8d8acc0f79d53d5901` |
| `protocol/private-trace-v1.md` | Trace consent, minimization, retention, access, and integrity policy | `a58553c2ac463fe77db110757a30c757320f1249a98eb1f377657ae0fb70ea08` |
| `backend/trace/README.md` | Private trace storage and authenticated API boundary | `ea7de656fc78fee81409b603b354b6d988571a0b9e730fdff723d13a54a1b3a9` |
| `src/lib/project-view.ts` | Browser-safe project projection consumed by the Slop UI | `e9daa716e06c5657845d0e3ec3aca3d08466a1ad163a9c8cf7856de636d59926` |

## Baseline verification

The baseline contract is tested by `scripts/delegate-baseline.test.mjs`. The test:

- checks the manifest's exact top-level keys and canonical revision labels;
- checks the required source list and order;
- recomputes every SHA-256 digest from repository bytes;
- rejects missing or altered sources; and
- independently asserts that `AGENTS.md` and `CLAUDE.md` remain byte-identical.

The repository's existing verification gates remain authoritative:

```bash
bun install --frozen-lockfile
bun run verify
bun run test:e2e
```

## Drift procedure

Any later change to a bound source must fail the baseline test until a human reviews the drift. Updating a digest is not a mechanical fix. The reviewer must determine whether the change affects:

- project authority or schema compatibility;
- private trace consent, content, access, or retention;
- receipt identity or signature semantics;
- score grouping or reward eligibility;
- public projection safety;
- settlement claims; or
- deployment trust.

After review, update this audit and the manifest in the same change, record the reason, rerun the complete Slop verification suite, and preserve the old commit in review history.

## Deliberate non-authorities

The baseline does not make Delegate authoritative over GitHub, project enrollment, Slop score, Slop trace bytes, maintainer acceptance, wallets, or settlement. Delegate's later control plane may own dynamic delegation records, but only within those explicit boundaries.
