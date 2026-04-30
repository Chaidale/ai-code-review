import { randomUUID } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  analysisInputs,
  analysisResults,
  analysisRuns,
  projects,
  pullRequests,
} from "../../db/schema.js";
import { normalizeStructuredResult } from "./structured-result.js";

function normalizeTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toSerializableData(value) {
  return value == null ? null : JSON.parse(JSON.stringify(value));
}

function toIsoString(value) {
  if (!value) {
    return null;
  }

  const parsedDate = value instanceof Date ? value : new Date(value);

  return Number.isNaN(parsedDate.getTime()) ? String(value) : parsedDate.toISOString();
}

function buildAnalysisProject(row) {
  if (!row.projectId) {
    return null;
  }

  const repositoryOwner = normalizeTrimmedString(row.projectRepositoryOwner);
  const repositoryName = normalizeTrimmedString(row.projectRepositoryName);

  return {
    id: row.projectId,
    name: row.projectName,
    slug: row.projectSlug,
    status: row.projectStatus,
    repository: {
      provider: row.projectRepositoryProvider,
      owner: repositoryOwner || null,
      name: repositoryName || null,
      fullName: repositoryOwner && repositoryName ? `${repositoryOwner}/${repositoryName}` : "",
    },
  };
}

function buildPullRequestReference(row) {
  if (!row.prUrl && !row.prOwner && !row.prRepo) {
    return null;
  }

  return {
    id: row.prId || null,
    owner: row.prOwner || null,
    repo: row.prRepo || null,
    prNumber: row.prNumber ?? null,
    url: row.prUrl || row.inputsPrUrl || null,
    title: row.prTitle || null,
    author: row.prAuthor || null,
    status: row.prStatus || null,
    headSha: row.prHeadSha || null,
    baseSha: row.prBaseSha || null,
  };
}

function buildStructuredResult(row) {
  return normalizeStructuredResult(row.resultJson, {
    overallRisk: row.resultOverallRisk,
    errorRisk: row.resultErrorRisk,
    performanceRisk: row.resultPerformanceRisk,
    mergeAdvice: row.resultMergeAdvice,
  });
}

function serializeAnalysisSummary(row) {
  const structuredResult = buildStructuredResult(row);

  return {
    id: row.runId,
    type: row.type,
    title: row.title,
    status: row.status,
    createdAt: toIsoString(row.createdAt),
    project: buildAnalysisProject(row),
    pr: buildPullRequestReference(row),
    source: toSerializableData(row.sourceJson),
    overallRisk: structuredResult?.overallRisk ?? null,
    mergeAdvice: structuredResult?.mergeAdvice ?? null,
    summary: structuredResult?.summary || row.summary || "",
  };
}

function serializeAnalysisDetail(row) {
  const structuredResult = buildStructuredResult(row);

  return {
    id: row.runId,
    type: row.type,
    title: row.title,
    status: row.status,
    project: buildAnalysisProject(row),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    startedAt: toIsoString(row.startedAt),
    finishedAt: toIsoString(row.finishedAt),
    errorMessage: row.errorMessage || null,
    pr: buildPullRequestReference(row),
    source: toSerializableData(row.sourceJson),
    summary: structuredResult?.summary || row.summary || "",
    resultMarkdown: row.resultMarkdown || "",
    structuredResult,
    metadata: toSerializableData(row.metadataJson),
    inputs: toSerializableData(row.inputJson),
    output: toSerializableData(row.outputJson),
  };
}

function getAnalysisSelectShape() {
  return {
    runId: analysisRuns.id,
    type: analysisRuns.type,
    title: analysisRuns.title,
    status: analysisRuns.status,
    summary: analysisRuns.summary,
    sourceJson: analysisRuns.sourceJson,
    metadataJson: analysisRuns.metadataJson,
    outputJson: analysisRuns.outputJson,
    startedAt: analysisRuns.startedAt,
    finishedAt: analysisRuns.finishedAt,
    errorMessage: analysisRuns.errorMessage,
    createdAt: analysisRuns.createdAt,
    updatedAt: analysisRuns.updatedAt,
    projectId: projects.id,
    projectName: projects.name,
    projectSlug: projects.slug,
    projectStatus: projects.status,
    projectRepositoryProvider: projects.repositoryProvider,
    projectRepositoryOwner: projects.repositoryOwner,
    projectRepositoryName: projects.repositoryName,
    prId: pullRequests.id,
    prOwner: pullRequests.repositoryOwner,
    prRepo: pullRequests.repositoryName,
    prNumber: pullRequests.prNumber,
    prUrl: pullRequests.url,
    prTitle: pullRequests.title,
    prAuthor: pullRequests.author,
    prStatus: pullRequests.status,
    prHeadSha: pullRequests.headSha,
    prBaseSha: pullRequests.baseSha,
    inputsPrUrl: analysisInputs.prUrl,
    inputJson: analysisInputs.inputJson,
    resultOverallRisk: analysisResults.overallRisk,
    resultErrorRisk: analysisResults.errorRisk,
    resultPerformanceRisk: analysisResults.performanceRisk,
    resultMergeAdvice: analysisResults.mergeAdvice,
    resultMarkdown: analysisResults.summaryMarkdown,
    resultJson: analysisResults.resultJson,
  };
}

async function upsertPullRequestRecord(tx, projectId, pr) {
  const owner = normalizeTrimmedString(pr?.owner);
  const repo = normalizeTrimmedString(pr?.repo);
  const prNumber = Number(pr?.prNumber);

  if (!owner || !repo || !Number.isInteger(prNumber) || prNumber <= 0) {
    return null;
  }

  const now = new Date();
  const recordId = randomUUID();
  const values = {
    id: recordId,
    projectId,
    repositoryProvider: "github",
    repositoryOwner: owner,
    repositoryName: repo,
    prNumber,
    title: normalizeTrimmedString(pr?.title) || null,
    author: normalizeTrimmedString(pr?.author) || null,
    url: normalizeTrimmedString(pr?.url),
    headSha: normalizeTrimmedString(pr?.headSha) || null,
    baseSha: normalizeTrimmedString(pr?.baseSha) || null,
    status: normalizeTrimmedString(pr?.status) || "open",
    createdAt: now,
    updatedAt: now,
  };
  const [pullRequestRecord] = await tx.insert(pullRequests).values(values).onConflictDoUpdate({
    target: [pullRequests.projectId, pullRequests.prNumber],
    set: {
      repositoryOwner: values.repositoryOwner,
      repositoryName: values.repositoryName,
      title: values.title,
      author: values.author,
      url: values.url,
      headSha: values.headSha,
      baseSha: values.baseSha,
      status: values.status,
      updatedAt: now,
    },
  }).returning({
    id: pullRequests.id,
  });

  return pullRequestRecord?.id || null;
}

export async function createAnalysisRecord({
  projectId,
  type,
  title,
  pr = null,
  triggerSource = "manual",
  source = null,
  summary = "",
  resultMarkdown = "",
  structuredResult = null,
  metadata = null,
  inputs = null,
  output = null,
} = {}) {
  const normalizedProjectId = normalizeTrimmedString(projectId);

  if (!normalizedProjectId) {
    throw new Error("createAnalysisRecord requires projectId");
  }

  const now = new Date();
  const analysisRunId = randomUUID();
  const normalizedInputs = toSerializableData(inputs) ?? {};
  const normalizedOutput = toSerializableData(output);
  const normalizedStructuredResult = normalizeStructuredResult(toSerializableData(structuredResult));
  const diffSnapshot = normalizeTrimmedString(normalizedInputs.diffSnapshot);
  const sentryIssueSummary = normalizeTrimmedString(
    normalizedInputs.sentryIssueSummary ?? normalizedInputs.sentrySummary,
  );

  await db.transaction(async (tx) => {
    const pullRequestId = await upsertPullRequestRecord(tx, normalizedProjectId, pr);

    await tx.insert(analysisRuns).values({
      id: analysisRunId,
      projectId: normalizedProjectId,
      pullRequestId,
      type,
      title,
      triggerSource: normalizeTrimmedString(triggerSource) || "manual",
      status: "completed",
      summary: summary || "",
      sourceJson: toSerializableData(source),
      metadataJson: toSerializableData(metadata),
      outputJson: normalizedOutput,
      startedAt: now,
      finishedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(analysisInputs).values({
      id: randomUUID(),
      analysisRunId,
      prUrl: normalizeTrimmedString(normalizedInputs.prUrl ?? pr?.url),
      diffSnapshot: diffSnapshot || null,
      sentryIssueUrl: normalizeTrimmedString(normalizedInputs.sentryIssueUrl),
      sentrySummary: sentryIssueSummary || null,
      performanceSummary: normalizeTrimmedString(normalizedInputs.performanceSummary) || null,
      inputJson: normalizedInputs,
      createdAt: now,
    });

    await tx.insert(analysisResults).values({
      id: randomUUID(),
      analysisRunId,
      overallRisk: normalizedStructuredResult?.overallRisk?.level ?? null,
      errorRisk: normalizedStructuredResult?.errorRisk?.level ?? null,
      performanceRisk: normalizedStructuredResult?.performanceRisk?.level ?? null,
      mergeAdvice: normalizedStructuredResult?.mergeAdvice?.decision ?? null,
      summaryMarkdown: resultMarkdown || "",
      resultJson: normalizedStructuredResult,
      createdAt: now,
      updatedAt: now,
    });
  });

  return getAnalysisRecordById(analysisRunId);
}

export async function listAnalysisRecords({
  limit = 10,
  type = "",
  projectId = "",
} = {}) {
  const normalizedLimit = Number.isInteger(limit)
    ? limit
    : Math.max(parseInt(limit, 10) || 10, 1);
  const normalizedType = normalizeTrimmedString(type);
  const normalizedProjectId = normalizeTrimmedString(projectId);
  const conditions = [];

  if (normalizedType) {
    conditions.push(eq(analysisRuns.type, normalizedType));
  }

  if (normalizedProjectId) {
    conditions.push(eq(analysisRuns.projectId, normalizedProjectId));
  }

  let query = db.select(getAnalysisSelectShape())
    .from(analysisRuns)
    .innerJoin(projects, eq(projects.id, analysisRuns.projectId))
    .leftJoin(pullRequests, eq(pullRequests.id, analysisRuns.pullRequestId))
    .leftJoin(analysisInputs, eq(analysisInputs.analysisRunId, analysisRuns.id))
    .leftJoin(analysisResults, eq(analysisResults.analysisRunId, analysisRuns.id));

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const rows = await query.orderBy(desc(analysisRuns.createdAt)).limit(Math.min(normalizedLimit, 100));

  return rows.map(serializeAnalysisSummary);
}

export async function listProjectAnalysisRecords(projectId, options = {}) {
  return listAnalysisRecords({
    ...options,
    projectId,
  });
}

export async function getAnalysisRecordById(analysisId) {
  const normalizedAnalysisId = normalizeTrimmedString(analysisId);

  if (!normalizedAnalysisId) {
    return null;
  }

  const [row] = await db.select(getAnalysisSelectShape())
    .from(analysisRuns)
    .innerJoin(projects, eq(projects.id, analysisRuns.projectId))
    .leftJoin(pullRequests, eq(pullRequests.id, analysisRuns.pullRequestId))
    .leftJoin(analysisInputs, eq(analysisInputs.analysisRunId, analysisRuns.id))
    .leftJoin(analysisResults, eq(analysisResults.analysisRunId, analysisRuns.id))
    .where(eq(analysisRuns.id, normalizedAnalysisId))
    .limit(1);

  return row ? serializeAnalysisDetail(row) : null;
}
