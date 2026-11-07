/** Types for vercel-build-plan.mjs, so tests can import it. */
export declare const MIGRATION_URL_SOURCES: string[];
export declare const RUNTIME_URL_SOURCES: string[];
export declare const DATABASE_VARIABLES: string[];
export type VercelBuildPlan =
  | { ok: false; error: string }
  | { ok: true; target: string; migrate: boolean; steps: { cmd: string; env?: Record<string, string> }[]; notes: string[] };
export declare function planVercelBuild(env: Record<string, string | undefined>): VercelBuildPlan;
