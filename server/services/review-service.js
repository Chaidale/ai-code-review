import {
  MAX_CODE_REVIEW_CHARS,
  ANALYSIS_HISTORY_LIMIT,
  MAX_MONITORING_SUMMARY_CHARS,
  MAX_FILE_DIFF_CHARS,
  MAX_CROSS_FILE_DIFF_CHARS,
  MAX_PR_FILES,
  MAX_TOTAL_DIFF_CHARS,
  CODE_REVIEW_MAX_TOKENS,
  PR_MONITORING_REVIEW_MAX_TOKENS,
  PR_REVIEW_MAX_TOKENS,
  GITHUB_COMMENT_MAX_TOKENS,
  REVIEW_CACHE_TTL_MS,
  DEFAULT_SENTRY_AUTH_TOKEN,
} from "../config.js";
import { askAI } from "../lib/ai.js";
import { buildMonitoringStructuredResult } from "../lib/analysis-results.js";
import {
  createAnalysisRecord,
  getAnalysisRecordById,
  listAnalysisRecords,
} from "../lib/analysis-store.js";
import { resolveProjectForPullRequest } from "../modules/projects/service.js";
import {
  fetchPullRequestDiff,
  parseGitHubPrUrl,
  publishPullRequestComment,
  splitDiffByFile,
} from "../lib/diff.js";
import { createHttpError } from "../lib/errors.js";
import {
  buildCodeReviewPrompt,
  buildGitHubReviewCommentPrompt,
  buildPullRequestMonitoringPrompt,
  buildPullRequestReviewPrompt,
} from "../lib/prompts.js";
import { fetchSentryIssueSummary } from "../lib/sentry.js";

function normalizeTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }

  return false;
}

function truncateText(text, maxChars, suffix) {
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars)}\n\n${suffix}`;
}

function appendMonitoringNoteBlock(title, content) {
  const normalizedContent = normalizeTrimmedString(content);

  if (!normalizedContent) {
    return "";
  }

  return `${title}\n${normalizedContent}`;
}

function extractPlainTextPreview(value, maxLength = 180) {
  const normalizedValue = normalizeTrimmedString(value).replace(/\s+/g, " ");

  if (normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, maxLength)}...`;
}

function buildPullRequestReference(prInfo, prUrl) {
  return {
    owner: prInfo.owner,
    repo: prInfo.repo,
    prNumber: prInfo.prNumber,
    url: prUrl,
  };
}

function buildPullRequestAnalysisTitle(prInfo, suffix) {
  return `${prInfo.owner}/${prInfo.repo}#${prInfo.prNumber} · ${suffix}`;
}

function buildDiffSnapshot(files) {
  return Array.isArray(files)
    ? files
      .map((file) => `### ${file.fileName}\n${file.diff}`)
      .join("\n\n")
    : "";
}

const reviewCache = new Map();

async function getOrCreateCachedResult(cacheKey, producer) {
  const now = Date.now();
  const cachedEntry = reviewCache.get(cacheKey);

  if (cachedEntry && cachedEntry.expiresAt > now) {
    return cachedEntry.promise;
  }

  const promise = producer().catch((error) => {
    reviewCache.delete(cacheKey);
    throw error;
  });

  reviewCache.set(cacheKey, {
    expiresAt: now + REVIEW_CACHE_TTL_MS,
    promise,
  });

  return promise;
}

function buildPullRequestResult({
  prInfo,
  totalFileCount,
  skippedBinaryFiles,
  omittedTextFileCount,
  truncatedFileCount,
  analyzedFileCount,
  reviewResult,
  githubReviewComment,
  githubReviewPublished,
  githubReviewPublishError,
}) {
  const sections = [
    "# GitHub PR Code Review 结果",
    "",
    `PR：**${prInfo.owner}/${prInfo.repo}#${prInfo.prNumber}**`,
    "",
    `本次 PR 共修改 **${totalFileCount}** 个文件，本次分析了 **${analyzedFileCount}** 个文本文件。`,
    "",
  ];

  if (skippedBinaryFiles > 0) {
    sections.push(`> 已跳过 ${skippedBinaryFiles} 个二进制文件。`, "");
  }

  if (omittedTextFileCount > 0) {
    sections.push(`> 还有 ${omittedTextFileCount} 个文本文件未纳入分析，以避免超出当前 diff 长度限制。`, "");
  }

  if (truncatedFileCount > 0) {
    sections.push(`> 有 ${truncatedFileCount} 个文件的 diff 已按行截断，结论可能不如完整 diff 准确。`, "");
  }

  if (githubReviewPublished) {
    sections.push("> AI 评论已成功发布到 GitHub PR。", "");
  }

  if (githubReviewPublishError) {
    sections.push(`> GitHub PR 评论发布失败：${githubReviewPublishError}`, "");
  }

  sections.push("---", "");
  sections.push(reviewResult, "");

  return {
    result: sections.join("\n"),
    fileCount: totalFileCount,
    analyzedFileCount,
    skippedBinaryFileCount: skippedBinaryFiles,
    githubReviewPublished,
    githubReviewComment,
    githubReviewPublishError,
  };
}

function buildPullRequestMonitoringResult({
  prInfo,
  totalFileCount,
  skippedBinaryFiles,
  omittedTextFileCount,
  truncatedFileCount,
  analyzedFileCount,
  sentryIssueUrl,
  sentryIssueSummary,
  performanceSummary,
  sentryIssueFetched,
  sentryIssueFetchWarning,
  analysisResult,
}) {
  const hasSentryIssueUrl = Boolean(sentryIssueUrl);
  const hasSentryIssueSummary = Boolean(sentryIssueSummary);
  const hasPerformanceSummary = Boolean(performanceSummary);
  const sections = [
    "# PR 与监控风险分析结果",
    "",
    `PR：**${prInfo.owner}/${prInfo.repo}#${prInfo.prNumber}**`,
    "",
    `本次 PR 共修改 **${totalFileCount}** 个文件，本次分析了 **${analyzedFileCount}** 个文本文件。`,
    "",
    `Sentry Issue URL：**${hasSentryIssueUrl ? "已提供" : "未提供"}**`,
    "",
    `错误摘要：**${hasSentryIssueSummary ? "已提供" : "未提供"}**`,
    "",
    `性能摘要：**${hasPerformanceSummary ? "已提供" : "未提供"}**`,
    "",
  ];

  if (hasSentryIssueUrl) {
    sections.push(`Sentry 自动抓取：**${sentryIssueFetched ? "成功" : "未执行"}**`, "");
  }

  if (skippedBinaryFiles > 0) {
    sections.push(`> 已跳过 ${skippedBinaryFiles} 个二进制文件。`, "");
  }

  if (omittedTextFileCount > 0) {
    sections.push(`> 还有 ${omittedTextFileCount} 个文本文件未纳入分析，以避免超出当前 diff 长度限制。`, "");
  }

  if (truncatedFileCount > 0) {
    sections.push(`> 有 ${truncatedFileCount} 个文件的 diff 已按行截断，结论可能不如完整 diff 准确。`, "");
  }

  if (sentryIssueFetchWarning) {
    sections.push(`> Sentry latest event 抓取警告：${sentryIssueFetchWarning}`, "");
  }

  sections.push("---", "");
  sections.push(analysisResult, "");

  return {
    result: sections.join("\n"),
    fileCount: totalFileCount,
    analyzedFileCount,
    skippedBinaryFileCount: skippedBinaryFiles,
    hasSentryIssueSummary,
    hasPerformanceSummary,
  };
}

async function resolveSentryIssueSummary({
  sentryIssueUrl = "",
  sentryIssueSummary = "",
  sentryAuthToken = "",
} = {}) {
  const normalizedSentryIssueUrl = normalizeTrimmedString(sentryIssueUrl);
  const normalizedSentryIssueSummary = normalizeTrimmedString(sentryIssueSummary);

  if (!normalizedSentryIssueUrl) {
    return {
      combinedSentryIssueSummary: normalizedSentryIssueSummary,
      sentryIssueFetched: false,
      sentryIssueFetchWarning: null,
    };
  }

  const normalizedSentryAuthToken = normalizeTrimmedString(sentryAuthToken) || DEFAULT_SENTRY_AUTH_TOKEN;

  if (!normalizedSentryAuthToken) {
    throw createHttpError(400, "使用 Sentry Issue URL 自动抓取时必须提供 SENTRY_AUTH_TOKEN", {
      exposeError: false,
    });
  }

  const sentryCacheKey = JSON.stringify({
    type: "sentry-issue-summary",
    sentryIssueUrl: normalizedSentryIssueUrl,
  });
  const sentryIssueResult = await getOrCreateCachedResult(sentryCacheKey, () => fetchSentryIssueSummary({
    issueUrl: normalizedSentryIssueUrl,
    authToken: normalizedSentryAuthToken,
  }));
  const combinedSentryIssueSummary = [
    sentryIssueResult.summary,
    appendMonitoringNoteBlock("手工补充说明：", normalizedSentryIssueSummary),
  ].filter(Boolean).join("\n\n");

  return {
    combinedSentryIssueSummary,
    sentryIssueFetched: true,
    sentryIssueFetchWarning: sentryIssueResult.latestEventFetchError,
  };
}

async function loadPullRequestContext({
  prUrl = "",
  deepseekApiKey = "",
  githubToken = "",
} = {}) {
  const normalizedPrUrl = normalizeTrimmedString(prUrl);
  const normalizedDeepseekApiKey = normalizeTrimmedString(deepseekApiKey);
  const normalizedGithubToken = normalizeTrimmedString(githubToken);

  if (!normalizedPrUrl) {
    throw createHttpError(400, "PR 链接不能为空", { exposeError: false });
  }

  if (!normalizedDeepseekApiKey) {
    throw createHttpError(400, "DEEPSEEK_API_KEY 不能为空", { exposeError: false });
  }

  const prInfo = parseGitHubPrUrl(normalizedPrUrl);

  if (!prInfo) {
    throw createHttpError(400, "PR 链接格式不正确，例如：https://github.com/user/repo/pull/123", {
      exposeError: false,
    });
  }

  const diff = await fetchPullRequestDiff(prInfo, {
    githubToken: normalizedGithubToken,
  });
  const splitResult = splitDiffByFile(diff, {
    maxFiles: MAX_PR_FILES,
    maxTotalChars: MAX_TOTAL_DIFF_CHARS,
    maxFileChars: MAX_FILE_DIFF_CHARS,
    contextChars: MAX_CROSS_FILE_DIFF_CHARS,
  });

  if (splitResult.files.length === 0) {
    throw createHttpError(
      400,
      splitResult.skippedBinaryFiles > 0
        ? "该 PR 只包含二进制文件，暂不支持分析"
        : "该 PR 没有可分析的文本 diff",
      { exposeError: false },
    );
  }

  return {
    normalizedPrUrl,
    normalizedDeepseekApiKey,
    normalizedGithubToken,
    prInfo,
    ...splitResult,
  };
}

export async function reviewCode({ code = "", framework = "Vue", deepseekApiKey = "" } = {}) {
  const normalizedCode = normalizeTrimmedString(code);
  const normalizedDeepseekApiKey = normalizeTrimmedString(deepseekApiKey);

  if (!normalizedCode) {
    throw createHttpError(400, "code 不能为空", { exposeError: false });
  }

  if (!normalizedDeepseekApiKey) {
    throw createHttpError(400, "DEEPSEEK_API_KEY 不能为空", { exposeError: false });
  }

  const truncatedCode = truncateText(
    normalizedCode,
    MAX_CODE_REVIEW_CHARS,
    "[代码内容过长，已截断]",
  );
  const cacheKey = JSON.stringify({
    type: "code-review",
    framework,
    code: truncatedCode,
  });

  const result = await getOrCreateCachedResult(cacheKey, () => askAI(buildCodeReviewPrompt({
    framework,
    code: truncatedCode,
  }), {
    apiKey: normalizedDeepseekApiKey,
    maxTokens: CODE_REVIEW_MAX_TOKENS,
  }));

  return { result };
}

export async function reviewPullRequest({
  projectId = "",
  prUrl = "",
  deepseekApiKey = "",
  githubToken = "",
  publishReviewComment = false,
} = {}) {
  const shouldPublishReviewComment = normalizeBoolean(publishReviewComment);

  if (shouldPublishReviewComment && !normalizeTrimmedString(githubToken)) {
    throw createHttpError(400, "发布 GitHub PR 评论时必须提供 GITHUB_TOKEN", {
      exposeError: false,
    });
  }

  const {
    normalizedPrUrl,
    normalizedDeepseekApiKey,
    normalizedGithubToken,
    prInfo,
    files,
    totalFileCount,
    skippedBinaryFiles,
    omittedTextFileCount,
    truncatedFileCount,
  } = await loadPullRequestContext({
    prUrl,
    deepseekApiKey,
    githubToken,
  });
  const project = await resolveProjectForPullRequest({
    projectId,
    prInfo,
  });
  const aiCredentials = { apiKey: normalizedDeepseekApiKey };

  const reviewCacheKey = JSON.stringify({
    type: "pr-review",
    pr: `${prInfo.owner}/${prInfo.repo}#${prInfo.prNumber}`,
    files,
  });

  const reviewResult = await getOrCreateCachedResult(reviewCacheKey, () => askAI(buildPullRequestReviewPrompt({
    owner: prInfo.owner,
    repo: prInfo.repo,
    prNumber: prInfo.prNumber,
    files,
  }), {
    ...aiCredentials,
    maxTokens: PR_REVIEW_MAX_TOKENS,
  }));

  let githubReviewComment = null;
  let githubReviewPublished = false;
  let githubReviewPublishError = null;

  if (shouldPublishReviewComment) {
    githubReviewComment = await askAI(buildGitHubReviewCommentPrompt({
      owner: prInfo.owner,
      repo: prInfo.repo,
      prNumber: prInfo.prNumber,
      reviewResult,
    }), {
      ...aiCredentials,
      maxTokens: GITHUB_COMMENT_MAX_TOKENS,
    });

    try {
      await publishPullRequestComment({
        owner: prInfo.owner,
        repo: prInfo.repo,
        prNumber: prInfo.prNumber,
        githubToken: normalizedGithubToken,
        body: githubReviewComment,
      });

      githubReviewPublished = true;
    } catch (error) {
      githubReviewPublishError = error.message || "未知错误";
      console.error("GitHub PR 评论发布失败：", error);
    }
  }

  const response = buildPullRequestResult({
    prInfo,
    totalFileCount,
    skippedBinaryFiles,
    omittedTextFileCount,
    truncatedFileCount,
    analyzedFileCount: files.length,
    reviewResult,
    githubReviewComment,
    githubReviewPublished,
    githubReviewPublishError,
  });
  const record = await createAnalysisRecord({
    projectId: project.id,
    type: "pr-review",
    title: buildPullRequestAnalysisTitle(prInfo, "PR Review"),
    pr: buildPullRequestReference(prInfo, normalizedPrUrl),
    triggerSource: "manual",
    source: {
      githubReviewPublished,
      publishReviewComment: shouldPublishReviewComment,
    },
    summary: extractPlainTextPreview(reviewResult),
    resultMarkdown: response.result,
    metadata: {
      totalFileCount,
      analyzedFileCount: files.length,
      skippedBinaryFiles,
      omittedTextFileCount,
      truncatedFileCount,
    },
    inputs: {
      prUrl: normalizedPrUrl,
      diffSnapshot: buildDiffSnapshot(files),
      files,
    },
    output: {
      reviewResult,
      githubReviewComment,
      githubReviewPublished,
      githubReviewPublishError,
    },
  });

  return {
    ...response,
    analysisId: record.id,
    projectId: project.id,
  };
}

export async function reviewPullRequestMonitoring({
  projectId = "",
  prUrl = "",
  deepseekApiKey = "",
  githubToken = "",
  sentryIssueUrl = "",
  sentryIssueSummary = "",
  performanceSummary = "",
  sentryAuthToken = "",
} = {}) {
  const normalizedPerformanceSummary = normalizeTrimmedString(performanceSummary);
  const normalizedSentryIssueUrl = normalizeTrimmedString(sentryIssueUrl);

  if (!normalizedSentryIssueUrl && !normalizeTrimmedString(sentryIssueSummary) && !normalizedPerformanceSummary) {
    throw createHttpError(400, "请至少提供 Sentry Issue URL、Sentry Issue / 错误摘要 或 性能指标摘要", {
      exposeError: false,
    });
  }

  const {
    normalizedPrUrl,
    normalizedDeepseekApiKey,
    prInfo,
    files,
    totalFileCount,
    skippedBinaryFiles,
    omittedTextFileCount,
    truncatedFileCount,
  } = await loadPullRequestContext({
    prUrl,
    deepseekApiKey,
    githubToken,
  });
  const project = await resolveProjectForPullRequest({
    projectId,
    prInfo,
  });
  const {
    combinedSentryIssueSummary,
    sentryIssueFetched,
    sentryIssueFetchWarning,
  } = await resolveSentryIssueSummary({
    sentryIssueUrl: normalizedSentryIssueUrl,
    sentryIssueSummary,
    sentryAuthToken,
  });
  const truncatedSentryIssueSummary = truncateText(
    combinedSentryIssueSummary,
    MAX_MONITORING_SUMMARY_CHARS,
    "[错误摘要过长，已截断]",
  );
  const truncatedPerformanceSummary = truncateText(
    normalizedPerformanceSummary,
    MAX_MONITORING_SUMMARY_CHARS,
    "[性能摘要过长，已截断]",
  );
  const reviewCacheKey = JSON.stringify({
    type: "pr-monitoring-review",
    pr: `${prInfo.owner}/${prInfo.repo}#${prInfo.prNumber}`,
    files,
    sentryIssueSummary: truncatedSentryIssueSummary,
    performanceSummary: truncatedPerformanceSummary,
  });
  const analysisResult = await getOrCreateCachedResult(reviewCacheKey, () => askAI(buildPullRequestMonitoringPrompt({
    owner: prInfo.owner,
    repo: prInfo.repo,
    prNumber: prInfo.prNumber,
    files,
    sentryIssueSummary: truncatedSentryIssueSummary,
    performanceSummary: truncatedPerformanceSummary,
  }), {
    apiKey: normalizedDeepseekApiKey,
    maxTokens: PR_MONITORING_REVIEW_MAX_TOKENS,
  }));
  const structuredResult = buildMonitoringStructuredResult(analysisResult);
  const response = buildPullRequestMonitoringResult({
    prInfo,
    totalFileCount,
    skippedBinaryFiles,
    omittedTextFileCount,
    truncatedFileCount,
    analyzedFileCount: files.length,
    sentryIssueUrl: normalizedSentryIssueUrl,
    sentryIssueSummary: truncatedSentryIssueSummary,
    performanceSummary: truncatedPerformanceSummary,
    sentryIssueFetched,
    sentryIssueFetchWarning,
    analysisResult,
  });
  const record = await createAnalysisRecord({
    projectId: project.id,
    type: "pr-monitoring",
    title: buildPullRequestAnalysisTitle(prInfo, "PR + 监控分析"),
    pr: buildPullRequestReference(prInfo, normalizedPrUrl),
    triggerSource: "manual",
    source: {
      hasSentryIssueUrl: Boolean(normalizedSentryIssueUrl),
      hasSentryIssueSummary: Boolean(truncatedSentryIssueSummary),
      hasPerformanceSummary: Boolean(truncatedPerformanceSummary),
      sentryIssueFetched,
      sentryIssueFetchWarning,
    },
    summary: structuredResult.summary || extractPlainTextPreview(analysisResult),
    resultMarkdown: response.result,
    structuredResult,
    metadata: {
      totalFileCount,
      analyzedFileCount: files.length,
      skippedBinaryFiles,
      omittedTextFileCount,
      truncatedFileCount,
    },
    inputs: {
      prUrl: normalizedPrUrl,
      diffSnapshot: buildDiffSnapshot(files),
      files,
      sentryIssueUrl: normalizedSentryIssueUrl,
      sentryIssueSummary: truncatedSentryIssueSummary,
      performanceSummary: truncatedPerformanceSummary,
    },
    output: {
      analysisResult,
      sentryIssueFetched,
      sentryIssueFetchWarning,
    },
  });

  return {
    ...response,
    analysisId: record.id,
    projectId: project.id,
    structuredResult,
  };
}

export async function listStoredAnalyses({
  limit = 10,
  type = "",
  projectId = "",
} = {}) {
  const normalizedLimit = Number.isInteger(limit)
    ? limit
    : Math.max(parseInt(limit, 10) || 10, 1);

  return {
    items: await listAnalysisRecords({
      limit: Math.min(normalizedLimit, ANALYSIS_HISTORY_LIMIT),
      type,
      projectId,
    }),
  };
}

export async function getStoredAnalysisDetail(analysisId = "") {
  const record = await getAnalysisRecordById(analysisId);

  if (!record) {
    throw createHttpError(404, "未找到对应的分析记录", {
      exposeError: false,
    });
  }

  return {
    analysis: record,
  };
}
