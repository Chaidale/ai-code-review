import {
  MAX_FILE_DIFF_CHARS,
  MAX_CROSS_FILE_DIFF_CHARS,
  MAX_PR_FILES,
  MAX_TOTAL_DIFF_CHARS,
  REVIEW_CONCURRENCY,
} from "../config.js";
import { askAI } from "../lib/ai.js";
import { mapWithConcurrency } from "../lib/async.js";
import {
  fetchPullRequestDiff,
  parseGitHubPrUrl,
  publishPullRequestComment,
  splitDiffByFile,
} from "../lib/diff.js";
import { createHttpError } from "../lib/errors.js";
import {
  buildCodeReviewPrompt,
  buildCrossFileReviewPrompt,
  buildFileReviewPrompt,
  buildGitHubReviewCommentPrompt,
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

async function reviewSinglePullRequestFile(file, credentials) {
  try {
    const review = await askAI(buildFileReviewPrompt({
      fileName: file.fileName,
      fileDiff: file.diff,
    }), credentials);

    return {
      ...file,
      review,
      reviewFailed: false,
    };
  } catch (error) {
    console.error(`文件 ${file.fileName} Review 失败：`, error);

    return {
      ...file,
      review: `## 变更摘要
该文件的 AI Review 生成失败，请人工检查。

## 主要风险
AI 调用失败，未能自动给出可靠结论。

## 性能与可维护性
未完成分析。

## 跨文件关注点
建议人工检查这个文件与其上下游调用是否保持一致。

## 风险等级
中`,
      reviewFailed: true,
      reviewError: error.message,
    };
  }
}

function buildPullRequestResult({
  prInfo,
  totalFileCount,
  skippedBinaryFiles,
  omittedTextFileCount,
  truncatedFileCount,
  fileReviews,
  crossFileReview,
  crossFileReviewFailed,
  githubReviewComment,
  githubReviewPublished,
  githubReviewPublishError,
}) {
  const failedFileReviewCount = fileReviews.filter((item) => item.reviewFailed).length;
  const sections = [
    "# GitHub PR Code Review 结果",
    "",
    `PR：**${prInfo.owner}/${prInfo.repo}#${prInfo.prNumber}**`,
    "",
    `本次 PR 共修改 **${totalFileCount}** 个文件，本次分析了 **${fileReviews.length}** 个文本文件。`,
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

  if (failedFileReviewCount > 0) {
    sections.push(`> 有 ${failedFileReviewCount} 个文件的 AI 单文件分析失败，结果中已标注为人工复核项。`, "");
  }

  if (githubReviewPublished) {
    sections.push("> AI 评论已成功发布到 GitHub PR。", "");
  }

  if (githubReviewPublishError) {
    sections.push(`> GitHub PR 评论发布失败：${githubReviewPublishError}`, "");
  }

  sections.push("---", "");

  if (crossFileReview) {
    sections.push(crossFileReview, "");
  } else if (crossFileReviewFailed) {
    sections.push(
      "## 跨文件总评",
      "",
      "跨文件总评生成失败，建议人工重点检查接口契约、状态流和上下游依赖是否同步更新。",
      "",
    );
  }

  fileReviews.forEach(({ fileName, review }, index) => {
    sections.push("---", "", `## ${index + 1}. ${fileName}`, "", review, "");
  });

  return {
    result: sections.join("\n"),
    fileCount: totalFileCount,
    analyzedFileCount: fileReviews.length,
    skippedBinaryFileCount: skippedBinaryFiles,
    failedFileReviewCount,
    crossFileReviewIncluded: Boolean(crossFileReview),
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

  const result = await askAI(buildCodeReviewPrompt({
    framework,
    code: normalizedCode,
  }), {
    apiKey: normalizedDeepseekApiKey,
  });

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

  const fileReviews = await mapWithConcurrency(
    files,
    REVIEW_CONCURRENCY,
    (file) => reviewSinglePullRequestFile(file, aiCredentials),
  );

  const successfulFileReviews = fileReviews.filter((item) => !item.reviewFailed);

  if (successfulFileReviews.length === 0) {
    throw createHttpError(502, "PR Review 失败：所有文件的 AI 分析都失败了");
  }

  let crossFileReview = null;
  let crossFileReviewFailed = false;
  let githubReviewComment = null;
  let githubReviewPublished = false;
  let githubReviewPublishError = null;

  if (successfulFileReviews.length === 1) {
    crossFileReview = `## 跨文件总评

本次只成功分析了 1 个文本文件，未发现可确认的跨文件联动问题。建议在合并前人工检查它的上下游调用、数据结构和依赖是否同步更新。`;
  } else {
    try {
      crossFileReview = await askAI(buildCrossFileReviewPrompt({
        owner: prInfo.owner,
        repo: prInfo.repo,
        prNumber: prInfo.prNumber,
        fileReviews: successfulFileReviews,
      }), aiCredentials);
    } catch (error) {
      crossFileReviewFailed = true;
      console.error("跨文件总评生成失败：", error);
    }
  }

  if (shouldPublishReviewComment) {
    githubReviewComment = await askAI(buildGitHubReviewCommentPrompt({
      owner: prInfo.owner,
      repo: prInfo.repo,
      prNumber: prInfo.prNumber,
      crossFileReview,
      fileReviews: successfulFileReviews,
    }), aiCredentials);

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
    fileReviews,
    crossFileReview,
    crossFileReviewFailed,
    githubReviewComment,
    githubReviewPublished,
    githubReviewPublishError,
  });
}
