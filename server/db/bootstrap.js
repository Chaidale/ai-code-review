import { createHttpError } from "../lib/errors.js";
import { pool, verifyDatabaseConnection } from "./client.js";

const SCHEMA_STATEMENTS = [
  `
    create table if not exists projects (
      id text primary key,
      name text not null,
      slug text not null unique,
      status text not null default 'active',
      repository_provider text not null default 'github',
      repository_owner text,
      repository_name text,
      default_branch text not null default 'main',
      default_environment text not null default 'prod',
      default_analysis_type text not null default 'pr-monitoring',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `,
  `
    create unique index if not exists projects_repository_key
    on projects (repository_provider, repository_owner, repository_name)
    where repository_owner is not null and repository_name is not null
  `,
  `
    create table if not exists pull_requests (
      id text primary key,
      project_id text not null references projects(id) on delete cascade,
      repository_provider text not null default 'github',
      repository_owner text not null,
      repository_name text not null,
      pr_number integer not null,
      title text,
      author text,
      url text not null,
      head_sha text,
      base_sha text,
      status text not null default 'open',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (project_id, pr_number)
    )
  `,
  `
    create table if not exists analysis_runs (
      id text primary key,
      project_id text not null references projects(id) on delete cascade,
      pull_request_id text references pull_requests(id) on delete set null,
      type text not null,
      title text not null,
      trigger_source text not null default 'manual',
      status text not null default 'completed',
      summary text,
      source_json jsonb,
      metadata_json jsonb,
      output_json jsonb,
      started_at timestamptz not null default now(),
      finished_at timestamptz,
      error_message text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `,
  `
    create table if not exists analysis_inputs (
      id text primary key,
      analysis_run_id text not null unique references analysis_runs(id) on delete cascade,
      pr_url text,
      diff_snapshot text,
      sentry_issue_url text,
      sentry_summary text,
      performance_summary text,
      input_json jsonb,
      created_at timestamptz not null default now()
    )
  `,
  `
    create table if not exists analysis_results (
      id text primary key,
      analysis_run_id text not null unique references analysis_runs(id) on delete cascade,
      overall_risk text,
      error_risk text,
      performance_risk text,
      merge_advice text,
      summary_markdown text,
      result_json jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `,
  `
    create index if not exists projects_created_at_idx
    on projects (created_at desc)
  `,
  `
    create index if not exists pull_requests_project_id_idx
    on pull_requests (project_id)
  `,
  `
    create index if not exists pull_requests_created_at_idx
    on pull_requests (created_at desc)
  `,
  `
    create index if not exists analysis_runs_project_id_idx
    on analysis_runs (project_id)
  `,
  `
    create index if not exists analysis_runs_type_idx
    on analysis_runs (type)
  `,
  `
    create index if not exists analysis_runs_created_at_idx
    on analysis_runs (created_at desc)
  `,
  `
    create index if not exists analysis_results_overall_risk_idx
    on analysis_results (overall_risk)
  `,
];

const databaseState = {
  ready: false,
  initializing: null,
  lastError: null,
  lastAttemptAt: null,
  initializedAt: null,
};

function normalizeErrorMessage(error) {
  return error?.message || "未知错误";
}

function buildDatabaseUnavailableError(error) {
  return createHttpError(503, "PostgreSQL 未就绪，请先启动本地数据库，再刷新页面重试。推荐命令：docker compose up -d postgres", {
    exposeError: true,
    details: {
      databaseReady: false,
      databaseError: normalizeErrorMessage(error),
    },
    cause: error,
  });
}

async function initializeDatabaseSchema() {
  await verifyDatabaseConnection();

  const client = await pool.connect();

  try {
    await client.query("begin");

    for (const statement of SCHEMA_STATEMENTS) {
      await client.query(statement);
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export function isDatabaseReady() {
  return databaseState.ready;
}

export function getDatabaseState() {
  return {
    ready: databaseState.ready,
    initializing: Boolean(databaseState.initializing),
    lastError: databaseState.lastError ? normalizeErrorMessage(databaseState.lastError) : "",
    lastAttemptAt: databaseState.lastAttemptAt,
    initializedAt: databaseState.initializedAt,
  };
}

export async function ensureDatabaseSchema({
  allowUnavailable = false,
} = {}) {
  if (databaseState.ready) {
    return true;
  }

  if (!databaseState.initializing) {
    databaseState.lastAttemptAt = new Date().toISOString();
    databaseState.initializing = initializeDatabaseSchema()
      .then(() => {
        databaseState.ready = true;
        databaseState.lastError = null;
        databaseState.initializedAt = new Date().toISOString();
        return true;
      })
      .catch((error) => {
        databaseState.ready = false;
        databaseState.lastError = error;
        throw error;
      })
      .finally(() => {
        databaseState.initializing = null;
      });
  }

  try {
    await databaseState.initializing;
    return true;
  } catch (error) {
    if (allowUnavailable) {
      return false;
    }

    throw buildDatabaseUnavailableError(error);
  }
}

export function startDatabaseInitialization() {
  return ensureDatabaseSchema({ allowUnavailable: true })
    .then((ready) => {
      if (ready) {
        console.log("PostgreSQL schema ready");
      } else {
        console.warn("PostgreSQL not ready yet; database-backed APIs will return 503 until it becomes available.");
      }
    })
    .catch((error) => {
      console.warn("PostgreSQL initialization warning:", normalizeErrorMessage(error));
    });
}
