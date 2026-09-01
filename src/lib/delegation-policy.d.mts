/** Types for immutable Delegate policy and Slop project bindings. */

import type { ProjectRepository } from "./projects.mjs";

export type DelegateBindingState = "active" | "paused" | "revoked";
export type DelegateSource =
  | "agent_checkpoint"
  | "github_issue"
  | "github_pull_request"
  | "greenfield_goal"
  | "project_selected";
export type DelegateRewardMode = "slop_pool" | "fixed_usdc";

export interface DelegateBinding {
  readonly state: DelegateBindingState;
  readonly policyRevision: string;
  readonly activatedAt: string;
  readonly proof: {
    readonly commitSha: string;
    readonly fileSha256: string;
    readonly url: string;
  };
}

export interface DelegateProjectPolicy {
  readonly schemaVersion: "1";
  readonly projectId: string;
  readonly repositoryId: string;
  readonly integrationBranch: string;
  readonly visibility: "public";
  readonly delegatableSources: readonly DelegateSource[];
  readonly leasePolicy: {
    readonly mode: "delegate_only_exclusive";
    readonly defaultSeconds: number;
    readonly maximumSeconds: number;
    readonly heartbeatSeconds: number;
    readonly graceSeconds: number;
  };
  readonly acceptancePolicy: {
    readonly authority: "github_maintainer";
    readonly requiresTechnicalPass: true;
    readonly requiresExactHead: true;
    readonly requiresMerge: boolean;
  };
  readonly rewardPolicy: {
    readonly modes: readonly DelegateRewardMode[];
    readonly defaultMode: DelegateRewardMode;
    readonly fixedUsdc: {
      readonly enabled: boolean;
      readonly network: string | null;
      readonly mint: string | null;
      readonly maximumMinor: string | null;
    };
  };
  readonly contextPolicy: {
    readonly maximumBytes: number;
    readonly allowUncommittedPatch: boolean;
    readonly allowPrivateTraceReuse: false;
    readonly retentionDays: number;
  };
  readonly securityPolicy: {
    readonly networkDefault: "deny" | "restricted";
    readonly requireSecretScan: true;
    readonly allowBinaries: false;
  };
}

export declare function assertDelegatePolicy(
  value: unknown,
): DelegateProjectPolicy;
export declare function assertDelegateBinding(
  value: unknown,
  repository: ProjectRepository,
): DelegateBinding | null;
export declare function assertDelegateBindingTransition(
  previous: unknown,
  next: unknown,
  repository: ProjectRepository,
): DelegateBinding | null;
