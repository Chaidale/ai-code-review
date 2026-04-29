import { GITHUB_TIMEOUT_MS } from "../config.js";
import { createHttpError } from "./errors.js";

export function truncateAtLineBoundary(text, maxChars) {
  if (text.length <= maxChars) {
    return text;
  }

  const candidate = text.slice(0, maxChars);
  const newlineIndex = candidate.lastIndexOf("\n");
  const truncated = newlineIndex > 0 ? candidate.slice(0, newlineIndex) : candidate;

  return `${truncated}\n\n[diff 内容过长，已截断]`;
}

export function parseGitHubPrUrl(prUrl) {
  try {
    const url = new URL(prUrl.trim());

    if (!["github.com", "www.github.com"].includes(url.hostname)) {
      return null;
    }

    const parts = url.pathname.split("/").filter(Boolean);

    if (parts.length < 4 || parts[2] !== "pull" || !/^\d+$/.test(parts[3])) {
      return null;
    }

    return {
      owner: parts[0],
      repo: parts[1].replace(/\.git$/, ""),
      prNumber: parts[3],
    };
  } catch {
    return null;
  }
}

function getFileNameFromDiff(fileDiff, fallbackIndex) {
  const newFileMatch = fileDiff.match(/^\+\+\+ b\/(.+)$/m);

  if (newFileMatch && newFileMatch[1] !== "/dev/null") {
    return newFileMatch[1];
  }

  const oldFileMatch = fileDiff.match(/^--- a\/(.+)$/m);

  if (oldFileMatch && oldFileMatch[1] !== "/dev/null") {
    return oldFileMatch[1];
  }

  const diffHeaderMatch = fileDiff.match(/^diff --git a\/(.+?) b\/(.+)$/m);

  if (diffHeaderMatch) {
    return diffHeaderMatch[2];
  }

  return `第 ${fallbackIndex + 1} 个文件`;
}

function isBinaryDiff(fileDiff) {
  return /^(Binary files|GIT binary patch)/m.test(fileDiff);
}

export function splitDiffByFile(diff, options = {}) {
  const {
    maxFiles = Infinity,
    maxTotalChars = Infinity,
    maxFileChars = Infinity,
    contextChars: customContextChars,
  } = options;
  const defaultContextChars = Number.isFinite(maxFileChars)
    ? Math.max(Math.floor(maxFileChars / 2), 1)
    : Infinity;
  const contextChars = customContextChars ?? defaultContextChars;

  const sections = diff
    .split(/^diff --git /gm)
    .filter(Boolean)
    .map((item) => `diff --git ${item}`.trim());

  const files = [];
  let totalChars = 0;
  let skippedBinaryFiles = 0;
  let truncatedFileCount = 0;

  for (const section of sections) {
    if (files.length >= maxFiles) {
      break;
    }

    if (isBinaryDiff(section)) {
      skippedBinaryFiles += 1;
      continue;
    }

    let normalizedDiff = truncateAtLineBoundary(section, maxFileChars);
    const contextDiff = truncateAtLineBoundary(section, contextChars);

    if (normalizedDiff !== section) {
      truncatedFileCount += 1;
    }

    if (totalChars + normalizedDiff.length > maxTotalChars) {
      if (files.length === 0) {
        normalizedDiff = truncateAtLineBoundary(normalizedDiff, maxTotalChars);
      } else {
        break;
      }
    }

    files.push({
      fileName: getFileNameFromDiff(section, files.length),
      diff: normalizedDiff,
      contextDiff,
    });
    totalChars += normalizedDiff.length;
  }

  const omittedTextFileCount = Math.max(sections.length - skippedBinaryFiles - files.length, 0);

  return {
    files,
    totalFileCount: sections.length,
    skippedBinaryFiles,
    omittedTextFileCount,
    truncatedFileCount,
  };
}

export async function fetchPullRequestDiff({ owner, repo, prNumber }, options = {}) {
  const githubToken = typeof options.githubToken === "string" ? options.githubToken.trim() : "";
  const diffUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
  const headers = {
    Accept: "application/vnd.github.v3.diff",
    "User-Agent": "ai-code-review",
  };

  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  let diffRes;

  try {
    diffRes = await fetch(diffUrl, {
      headers,
      signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw createHttpError(504, "获取 GitHub PR diff 超时", { cause: error });
    }

    throw createHttpError(502, "连接 GitHub 失败", { cause: error });
  }

  if (!diffRes.ok) {
    const errorText = (await diffRes.text()).trim();

    throw createHttpError(diffRes.status, "获取 GitHub PR diff 失败", {
      details: {
        status: diffRes.status,
        error: errorText || undefined,
      },
      exposeError: false,
    });
  }

  const diff = await diffRes.text();

  if (!diff.trim()) {
    throw createHttpError(400, "该 PR 没有可分析的 diff", { exposeError: false });
  }

  return diff;
}
