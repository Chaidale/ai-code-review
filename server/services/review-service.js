import {
  MAX_CODE_REVIEW_CHARS,
  MAX_FILE_DIFF_CHARS,
  MAX_CROSS_FILE_DIFF_CHARS,
  MAX_PR_FILES,
  MAX_TOTAL_DIFF_CHARS,
  CODE_REVIEW_MAX_TOKENS,
  PR_REVIEW_MAX_TOKENS,
  GITHUB_COMMENT_MAX_TOKENS,
  REVIEW_CACHE_TTL_MS,
} from "../config.js";
import { askAI } from "../lib/ai.js";
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
  buildPullRequestReviewPrompt,
} from "../lib/prompts.js";

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
  prUrl = "",
  deepseekApiKey = "",
  githubToken = "",
  publishReviewComment = false,
} = {}) {
  const normalizedPrUrl = normalizeTrimmedString(prUrl);
  const normalizedDeepseekApiKey = normalizeTrimmedString(deepseekApiKey);
  const normalizedGithubToken = normalizeTrimmedString(githubToken);
  const shouldPublishReviewComment = normalizeBoolean(publishReviewComment);

  if (!normalizedPrUrl) {
    throw createHttpError(400, "PR 链接不能为空", { exposeError: false });
  }

  if (!normalizedDeepseekApiKey) {
    throw createHttpError(400, "DEEPSEEK_API_KEY 不能为空", { exposeError: false });
  }

  if (shouldPublishReviewComment && !normalizedGithubToken) {
    throw createHttpError(400, "发布 GitHub PR 评论时必须提供 GITHUB_TOKEN", {
      exposeError: false,
    });
  }

  const prInfo = parseGitHubPrUrl(normalizedPrUrl);

  if (!prInfo) {
    throw createHttpError(400, "PR 链接格式不正确，例如：https://github.com/user/repo/pull/123", {
      exposeError: false,
    });
  }

  const aiCredentials = { apiKey: normalizedDeepseekApiKey };
  const diff = await fetchPullRequestDiff(prInfo, {
    githubToken: normalizedGithubToken,
  });
  const {
    files,
    totalFileCount,
    skippedBinaryFiles,
    omittedTextFileCount,
    truncatedFileCount,
  } = splitDiffByFile(diff, {
    maxFiles: MAX_PR_FILES,
    maxTotalChars: MAX_TOTAL_DIFF_CHARS,
    maxFileChars: MAX_FILE_DIFF_CHARS,
    contextChars: MAX_CROSS_FILE_DIFF_CHARS,
  });

  if (files.length === 0) {
    throw createHttpError(
      400,
      skippedBinaryFiles > 0 ? "该 PR 只包含二进制文件，暂不支持分析" : "该 PR 没有可分析的文本 diff",
      { exposeError: false },
    );
  }

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

  return buildPullRequestResult({
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
}
