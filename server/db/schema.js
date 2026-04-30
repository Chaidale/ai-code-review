import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  status: text("status").notNull().default("active"),
  repositoryProvider: text("repository_provider").notNull().default("github"),
  repositoryOwner: text("repository_owner"),
  repositoryName: text("repository_name"),
  defaultBranch: text("default_branch").notNull().default("main"),
  defaultEnvironment: text("default_environment").notNull().default("prod"),
  defaultAnalysisType: text("default_analysis_type").notNull().default("pr-monitoring"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("projects_slug_key").on(table.slug),
  uniqueIndex("projects_repository_key").on(
    table.repositoryProvider,
    table.repositoryOwner,
    table.repositoryName,
  ),
  index("projects_created_at_idx").on(table.createdAt),
]);

export const pullRequests = pgTable("pull_requests", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, {
    onDelete: "cascade",
  }),
  repositoryProvider: text("repository_provider").notNull().default("github"),
  repositoryOwner: text("repository_owner").notNull(),
  repositoryName: text("repository_name").notNull(),
  prNumber: integer("pr_number").notNull(),
  title: text("title"),
  author: text("author"),
  url: text("url").notNull(),
  headSha: text("head_sha"),
  baseSha: text("base_sha"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("pull_requests_project_number_key").on(table.projectId, table.prNumber),
  index("pull_requests_project_id_idx").on(table.projectId),
  index("pull_requests_created_at_idx").on(table.createdAt),
]);

export const analysisRuns = pgTable("analysis_runs", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, {
    onDelete: "cascade",
  }),
  pullRequestId: text("pull_request_id").references(() => pullRequests.id, {
    onDelete: "set null",
  }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  triggerSource: text("trigger_source").notNull().default("manual"),
  status: text("status").notNull().default("completed"),
  summary: text("summary"),
  sourceJson: jsonb("source_json"),
  metadataJson: jsonb("metadata_json"),
  outputJson: jsonb("output_json"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("analysis_runs_project_id_idx").on(table.projectId),
  index("analysis_runs_type_idx").on(table.type),
  index("analysis_runs_created_at_idx").on(table.createdAt),
]);

export const analysisInputs = pgTable("analysis_inputs", {
  id: text("id").primaryKey(),
  analysisRunId: text("analysis_run_id").notNull().references(() => analysisRuns.id, {
    onDelete: "cascade",
  }),
  prUrl: text("pr_url"),
  diffSnapshot: text("diff_snapshot"),
  sentryIssueUrl: text("sentry_issue_url"),
  sentrySummary: text("sentry_summary"),
  performanceSummary: text("performance_summary"),
  inputJson: jsonb("input_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("analysis_inputs_run_id_key").on(table.analysisRunId),
]);

export const analysisResults = pgTable("analysis_results", {
  id: text("id").primaryKey(),
  analysisRunId: text("analysis_run_id").notNull().references(() => analysisRuns.id, {
    onDelete: "cascade",
  }),
  overallRisk: text("overall_risk"),
  errorRisk: text("error_risk"),
  performanceRisk: text("performance_risk"),
  mergeAdvice: text("merge_advice"),
  summaryMarkdown: text("summary_markdown"),
  resultJson: jsonb("result_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("analysis_results_run_id_key").on(table.analysisRunId),
  index("analysis_results_overall_risk_idx").on(table.overallRisk),
]);
