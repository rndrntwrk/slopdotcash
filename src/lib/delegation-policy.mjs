/** Validates immutable Delegate project policy and Slop manifest bindings. */

const POLICY_KEYS = [
  "acceptancePolicy",
  "contextPolicy",
  "delegatableSources",
  "integrationBranch",
  "leasePolicy",
  "projectId",
  "repositoryId",
  "rewardPolicy",
  "schemaVersion",
  "securityPolicy",
  "visibility",
];

const DELEGATABLE_SOURCES = new Set([
  "agent_checkpoint",
  "github_issue",
  "github_pull_request",
  "greenfield_goal",
  "project_selected",
]);

const REWARD_MODES = new Set(["slop_pool", "fixed_usdc"]);
const DELEGATE_STATES = new Set(["active", "paused", "revoked"]);
const ALLOWED_TRANSITIONS = new Map([
  ["active", new Set(["paused", "revoked"])],
  ["paused", new Set(["active", "revoked"])],
  ["revoked", new Set()],
]);

function record(value, field) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
  return value;
}

function exactKeys(value, keys, field) {
  if (Object.keys(value).sort().join("\0") !== [...keys].sort().join("\0")) {
    throw new TypeError(`${field} has unexpected or missing fields`);
  }
}

function text(value, field, { max = 500, min = 1, pattern } = {}) {
  if (
    typeof value !== "string" ||
    value.length < min ||
    value.length > max ||
    (pattern && !pattern.test(value))
  ) {
    throw new TypeError(`${field} is invalid`);
  }
  return value;
}

function integer(value, field, { min, max }) {
  if (
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new TypeError(`${field} is invalid`);
  }
  return value;
}

function timestamp(value, field, { rejectFuture = false } = {}) {
  const result = text(value, field, {
    pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u,
  });
  if (
    !Number.isFinite(Date.parse(result)) ||
    new Date(result).toISOString() !== result
  ) {
    throw new TypeError(`${field} is invalid`);
  }
  if (rejectFuture && Date.parse(result) > Date.now()) {
    throw new TypeError(`${field} cannot be in the future`);
  }
  return result;
}

function digest(value, field) {
  return text(value, field, { pattern: /^[0-9a-f]{64}$/u });
}

function commit(value, field) {
  return text(value, field, { pattern: /^[0-9a-f]{40}$/u });
}

function repositoryId(value, field) {
  return text(value, field, {
    max: 201,
    pattern: /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u,
  });
}

function repositoryIdentities(repository) {
  const value = record(repository, "repository");
  const id = repositoryId(value.id, "repository.id");
  const aliases = value.aliases ?? [];
  if (!Array.isArray(aliases) || aliases.length > 10) {
    throw new TypeError("repository.aliases must contain at most 10 entries");
  }
  return [
    id,
    ...aliases.map((alias, index) =>
      repositoryId(alias, `repository.aliases[${index}]`),
    ),
  ];
}

function immutablePolicyUrl(value, field, repository, commitSha) {
  const result = text(value, field, { max: 500 });
  let parsed;
  try {
    parsed = new URL(result);
  } catch (error) {
    throw new TypeError(`${field} is not a URL`, { cause: error });
  }
  if (
    parsed.origin !== "https://github.com" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    !repositoryIdentities(repository).some(
      (identity) =>
        parsed.pathname.toLowerCase() ===
        `/${identity}/blob/${commitSha}/.github/slop-delegate.json`.toLowerCase(),
    )
  ) {
    throw new TypeError(
      `${field} must bind the repository, commit, and .github/slop-delegate.json`,
    );
  }
  return result;
}

function uniqueEnumArray(value, field, allowed, { max }) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > max ||
    new Set(value).size !== value.length
  ) {
    throw new TypeError(`${field} must contain unique supported values`);
  }
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== "string" || !allowed.has(entry)) {
      throw new TypeError(`${field}[${index}] is unsupported`);
    }
  }
  return value;
}

function validateLeasePolicy(value) {
  const field = "delegatePolicy.leasePolicy";
  const policy = record(value, field);
  exactKeys(
    policy,
    [
      "defaultSeconds",
      "graceSeconds",
      "heartbeatSeconds",
      "maximumSeconds",
      "mode",
    ],
    field,
  );
  if (policy.mode !== "delegate_only_exclusive") {
    throw new TypeError(`${field}.mode is unsupported`);
  }
  const defaultSeconds = integer(policy.defaultSeconds, `${field}.defaultSeconds`, {
    min: 300,
    max: 86_400,
  });
  const maximumSeconds = integer(policy.maximumSeconds, `${field}.maximumSeconds`, {
    min: 300,
    max: 604_800,
  });
  const heartbeatSeconds = integer(
    policy.heartbeatSeconds,
    `${field}.heartbeatSeconds`,
    { min: 30, max: 3_600 },
  );
  const graceSeconds = integer(policy.graceSeconds, `${field}.graceSeconds`, {
    min: 0,
    max: 3_600,
  });
  if (defaultSeconds > maximumSeconds) {
    throw new TypeError(`${field}.defaultSeconds cannot exceed maximumSeconds`);
  }
  if (heartbeatSeconds >= defaultSeconds) {
    throw new TypeError(`${field}.heartbeatSeconds must be shorter than defaultSeconds`);
  }
  if (graceSeconds > defaultSeconds) {
    throw new TypeError(`${field}.graceSeconds cannot exceed defaultSeconds`);
  }
  return policy;
}

function validateAcceptancePolicy(value) {
  const field = "delegatePolicy.acceptancePolicy";
  const policy = record(value, field);
  exactKeys(
    policy,
    ["authority", "requiresExactHead", "requiresMerge", "requiresTechnicalPass"],
    field,
  );
  if (
    policy.authority !== "github_maintainer" ||
    policy.requiresTechnicalPass !== true ||
    policy.requiresExactHead !== true ||
    typeof policy.requiresMerge !== "boolean"
  ) {
    throw new TypeError(`${field} is inconsistent`);
  }
  return policy;
}

function canonicalMinor(value, field) {
  return text(value, field, { pattern: /^(?:0|[1-9]\d*)$/u });
}

function validateRewardPolicy(value) {
  const field = "delegatePolicy.rewardPolicy";
  const policy = record(value, field);
  exactKeys(policy, ["defaultMode", "fixedUsdc", "modes"], field);
  const modes = uniqueEnumArray(policy.modes, `${field}.modes`, REWARD_MODES, {
    max: REWARD_MODES.size,
  });
  if (typeof policy.defaultMode !== "string" || !modes.includes(policy.defaultMode)) {
    throw new TypeError(`${field}.defaultMode must be enabled in modes`);
  }
  const fixed = record(policy.fixedUsdc, `${field}.fixedUsdc`);
  exactKeys(fixed, ["enabled", "maximumMinor", "mint", "network"], `${field}.fixedUsdc`);
  if (typeof fixed.enabled !== "boolean") {
    throw new TypeError(`${field}.fixedUsdc.enabled is invalid`);
  }
  if (fixed.enabled) {
    if (!modes.includes("fixed_usdc")) {
      throw new TypeError(`${field}.fixedUsdc requires the fixed_usdc mode`);
    }
    text(fixed.network, `${field}.fixedUsdc.network`, {
      max: 100,
      pattern: /^solana:(?:devnet|mainnet)$/u,
    });
    text(fixed.mint, `${field}.fixedUsdc.mint`, {
      max: 64,
      pattern: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/u,
    });
    const maximumMinor = canonicalMinor(
      fixed.maximumMinor,
      `${field}.fixedUsdc.maximumMinor`,
    );
    if (maximumMinor === "0") {
      throw new TypeError(`${field}.fixedUsdc.maximumMinor must be positive`);
    }
  } else if (
    modes.includes("fixed_usdc") ||
    fixed.network !== null ||
    fixed.mint !== null ||
    fixed.maximumMinor !== null
  ) {
    throw new TypeError(`${field}.fixedUsdc disabled state is inconsistent`);
  }
  return policy;
}

function validateContextPolicy(value) {
  const field = "delegatePolicy.contextPolicy";
  const policy = record(value, field);
  exactKeys(
    policy,
    [
      "allowPrivateTraceReuse",
      "allowUncommittedPatch",
      "maximumBytes",
      "retentionDays",
    ],
    field,
  );
  integer(policy.maximumBytes, `${field}.maximumBytes`, {
    min: 1,
    max: 104_857_600,
  });
  integer(policy.retentionDays, `${field}.retentionDays`, {
    min: 1,
    max: 365,
  });
  if (
    typeof policy.allowUncommittedPatch !== "boolean" ||
    policy.allowPrivateTraceReuse !== false
  ) {
    throw new TypeError(
      `${field}.allowPrivateTraceReuse must remain false and patch policy must be explicit`,
    );
  }
  return policy;
}

function validateSecurityPolicy(value) {
  const field = "delegatePolicy.securityPolicy";
  const policy = record(value, field);
  exactKeys(policy, ["allowBinaries", "networkDefault", "requireSecretScan"], field);
  if (
    !["deny", "restricted"].includes(policy.networkDefault) ||
    policy.requireSecretScan !== true ||
    policy.allowBinaries !== false
  ) {
    throw new TypeError(`${field} is inconsistent`);
  }
  return policy;
}

/** Validates the immutable policy stored in a target repository. */
export function assertDelegatePolicy(value) {
  const field = "delegatePolicy";
  const policy = record(value, field);
  exactKeys(policy, POLICY_KEYS, field);
  if (policy.schemaVersion !== "1") {
    throw new TypeError(`${field}.schemaVersion is unsupported`);
  }
  text(policy.projectId, `${field}.projectId`, {
    max: 48,
    pattern: /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/u,
  });
  repositoryId(policy.repositoryId, `${field}.repositoryId`);
  text(policy.integrationBranch, `${field}.integrationBranch`, {
    max: 255,
    pattern: /^(?!.*(?:\.\.|\s|~|\^|:|\?|\*|\[|\\))[A-Za-z0-9._/-]+$/u,
  });
  if (policy.visibility !== "public") {
    throw new TypeError(`${field}.visibility is unsupported`);
  }
  uniqueEnumArray(
    policy.delegatableSources,
    `${field}.delegatableSources`,
    DELEGATABLE_SOURCES,
    { max: DELEGATABLE_SOURCES.size },
  );
  validateLeasePolicy(policy.leasePolicy);
  validateAcceptancePolicy(policy.acceptancePolicy);
  validateRewardPolicy(policy.rewardPolicy);
  validateContextPolicy(policy.contextPolicy);
  validateSecurityPolicy(policy.securityPolicy);
  return policy;
}

/** Validates one Slop manifest binding to an immutable Delegate policy. */
export function assertDelegateBinding(value, repository) {
  if (value === null) return null;
  const field = "project.delegate";
  const binding = record(value, field);
  exactKeys(binding, ["activatedAt", "policyRevision", "proof", "state"], field);
  if (!DELEGATE_STATES.has(binding.state)) {
    throw new TypeError(`${field}.state is unsupported`);
  }
  text(binding.policyRevision, `${field}.policyRevision`, {
    max: 80,
    pattern: /^[a-z0-9][a-z0-9._-]*$/u,
  });
  timestamp(binding.activatedAt, `${field}.activatedAt`, { rejectFuture: true });
  const proof = record(binding.proof, `${field}.proof`);
  exactKeys(proof, ["commitSha", "fileSha256", "url"], `${field}.proof`);
  const commitSha = commit(proof.commitSha, `${field}.proof.commitSha`);
  digest(proof.fileSha256, `${field}.proof.fileSha256`);
  immutablePolicyUrl(proof.url, `${field}.proof.url`, repository, commitSha);
  return binding;
}

/** Validates append-only policy evolution observed between two Git revisions. */
export function assertDelegateBindingTransition(previous, next, repository) {
  const before = assertDelegateBinding(previous, repository);
  const after = assertDelegateBinding(next, repository);
  if (before === null) return after;
  if (after === null) {
    throw new TypeError("project.delegate binding cannot be removed; revoke it explicitly");
  }
  if (JSON.stringify(before) === JSON.stringify(after)) return after;
  if (before.state === "revoked") {
    throw new TypeError("project.delegate revoked state is terminal");
  }
  if (!ALLOWED_TRANSITIONS.get(before.state)?.has(after.state)) {
    throw new TypeError(
      `project.delegate transition ${before.state}->${after.state} is unsupported`,
    );
  }
  if (after.policyRevision === before.policyRevision) {
    throw new TypeError("project.delegate changes require a successor policyRevision");
  }
  if (Date.parse(after.activatedAt) <= Date.parse(before.activatedAt)) {
    throw new TypeError(
      "project.delegate successor activatedAt must be after the historic binding",
    );
  }
  if (
    after.proof.commitSha === before.proof.commitSha ||
    after.proof.fileSha256 === before.proof.fileSha256 ||
    after.proof.url === before.proof.url
  ) {
    throw new TypeError("project.delegate successor requires a new immutable proof");
  }
  return after;
}
