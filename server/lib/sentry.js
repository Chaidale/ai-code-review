import { SENTRY_TIMEOUT_MS } from "../config.js";
import { createHttpError } from "./errors.js";

const SENTRY_MAX_STACK_FRAMES = 6;
const SENTRY_MAX_CONTEXT_LINES = 8;

function normalizeTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function parseIntegerString(value) {
  return typeof value === "string" && /^\d+$/.test(value) ? value : null;
}

function escapePathSegment(value) {
  return encodeURIComponent(value);
}

function buildSentryApiUrl({ origin, organizationSlug, issueId, eventId = null, environments = [] }) {
  const path = eventId
    ? `/api/0/organizations/${escapePathSegment(organizationSlug)}/issues/${escapePathSegment(issueId)}/events/${escapePathSegment(eventId)}/`
    : `/api/0/organizations/${escapePathSegment(organizationSlug)}/issues/${escapePathSegment(issueId)}/`;
  const url = new URL(path, origin);

  for (const environment of environments) {
    url.searchParams.append("environment", environment);
  }

  return url.toString();
}

function parseSentryIssuePath(pathParts) {
  const organizationsIndex = pathParts.indexOf("organizations");

  if (organizationsIndex >= 0) {
    const organizationSlug = pathParts[organizationsIndex + 1] ?? "";
    const issuesSegment = pathParts[organizationsIndex + 2] ?? "";
    const issueId = parseIntegerString(pathParts[organizationsIndex + 3] ?? "");

    if (organizationSlug && issuesSegment === "issues" && issueId) {
      return { organizationSlug, issueId };
    }
  }

  const issuesIndex = pathParts.indexOf("issues");

  if (issuesIndex >= 2) {
    const organizationSlug = pathParts[issuesIndex - 2] ?? "";
    const issueId = parseIntegerString(pathParts[issuesIndex + 1] ?? "");

    if (organizationSlug && issueId) {
      return { organizationSlug, issueId };
    }
  }

  return null;
}

export function parseSentryIssueUrl(issueUrl) {
  const normalizedIssueUrl = normalizeTrimmedString(issueUrl);

  if (!normalizedIssueUrl) {
    return null;
  }

  try {
    const url = new URL(normalizedIssueUrl);
    const parsedPath = parseSentryIssuePath(url.pathname.split("/").filter(Boolean));

    if (!parsedPath) {
      return null;
    }

    return {
      issueUrl: normalizedIssueUrl,
      origin: url.origin,
      organizationSlug: parsedPath.organizationSlug,
      issueId: parsedPath.issueId,
      environments: url.searchParams.getAll("environment").filter(Boolean),
    };
  } catch {
    return null;
  }
}

async function fetchSentryJson(url, authToken) {
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${authToken}`,
    "User-Agent": "ai-code-review",
  };
  let response;

  try {
    response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(SENTRY_TIMEOUT_MS),
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw createHttpError(504, "请求 Sentry 超时", { cause: error });
    }

    throw createHttpError(502, "连接 Sentry 失败", { cause: error });
  }

  const responseText = await response.text();
  let responseJson = null;

  if (responseText) {
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      responseJson = null;
    }
  }

  if (!response.ok) {
    throw createHttpError(response.status, "获取 Sentry Issue 失败", {
      details: {
        status: response.status,
        sentryMessage:
          responseJson?.detail ||
          responseJson?.error ||
          responseJson?.message ||
          responseText ||
          undefined,
      },
      exposeError: false,
    });
  }

  return responseJson;
}

function findEventEntry(event, type) {
  return Array.isArray(event?.entries)
    ? event.entries.find((entry) => entry?.type === type)
    : null;
}

function formatStackFrame(frame) {
  const target = frame.filename || frame.absPath || frame.module || frame.package || "unknown";
  const location = Number.isFinite(frame.lineNo)
    ? `${target}:${frame.lineNo}${Number.isFinite(frame.colNo) ? `:${frame.colNo}` : ""}`
    : target;
  const fn = frame.function && frame.function !== "?" ? frame.function : null;

  return fn ? `${fn} (${location})` : location;
}

function extractStackFrames(event) {
  const exceptionEntry = findEventEntry(event, "exception");
  const values = Array.isArray(exceptionEntry?.data?.values) ? exceptionEntry.data.values : [];
  const allFrames = values.flatMap((item) => (
    Array.isArray(item?.stacktrace?.frames) ? item.stacktrace.frames : []
  ));
  const preferredFrames = allFrames.filter((frame) => frame?.inApp);
  const frames = preferredFrames.length > 0 ? preferredFrames : allFrames;

  return frames
    .slice(-SENTRY_MAX_STACK_FRAMES)
    .reverse()
    .map(formatStackFrame)
    .filter(Boolean);
}

function extractRequestSummary(event) {
  const requestEntry = findEventEntry(event, "request");
  const requestData = requestEntry?.data;

  if (!requestData) {
    return null;
  }

  const parts = [];

  if (isNonEmptyString(requestData.method)) {
    parts.push(requestData.method.trim());
  }

  if (isNonEmptyString(requestData.url)) {
    parts.push(requestData.url.trim());
  }

  if (parts.length === 0) {
    return null;
  }

  return parts.join(" ");
}

function extractUserSummary(event) {
  const user = event?.user;

  if (!user || typeof user !== "object") {
    return null;
  }

  return [
    normalizeTrimmedString(user.email),
    normalizeTrimmedString(user.username),
    normalizeTrimmedString(user.name),
    normalizeTrimmedString(user.id),
  ].find(Boolean) || null;
}

function extractInterestingTags(event) {
  const tagMap = new Map();

  if (Array.isArray(event?.tags)) {
    for (const tag of event.tags) {
      if (isNonEmptyString(tag?.key) && isNonEmptyString(tag?.value)) {
        tagMap.set(tag.key.trim(), tag.value.trim());
      }
    }
  }

  const preferredKeys = [
    "environment",
    "release",
    "browser",
    "os",
    "transaction",
    "handled",
    "mechanism",
    "runtime",
    "trace.status",
  ];

  return preferredKeys
    .filter((key) => tagMap.has(key))
    .map((key) => `${key}: ${tagMap.get(key)}`);
}

function extractInterestingContexts(event) {
  const contexts = event?.contexts;

  if (!contexts || typeof contexts !== "object") {
    return [];
  }

  const lines = [];
  const traceContext = contexts.trace;

  if (traceContext && typeof traceContext === "object") {
    const parts = [
      isNonEmptyString(traceContext.op) ? `op=${traceContext.op.trim()}` : null,
      isNonEmptyString(traceContext.status) ? `status=${traceContext.status.trim()}` : null,
      isNonEmptyString(traceContext.trace_id) ? `trace=${traceContext.trace_id.trim()}` : null,
    ].filter(Boolean);

    if (parts.length > 0) {
      lines.push(`trace: ${parts.join(", ")}`);
    }
  }

  for (const [key, value] of Object.entries(contexts)) {
    if (key === "trace" || !value || typeof value !== "object") {
      continue;
    }

    const detailParts = Object.entries(value)
      .filter(([fieldKey, fieldValue]) => fieldKey !== "type" && typeof fieldValue !== "object" && fieldValue != null)
      .slice(0, 3)
      .map(([fieldKey, fieldValue]) => `${fieldKey}=${fieldValue}`);

    if (detailParts.length > 0) {
      lines.push(`${key}: ${detailParts.join(", ")}`);
    }

    if (lines.length >= SENTRY_MAX_CONTEXT_LINES) {
      break;
    }
  }

  return lines.slice(0, SENTRY_MAX_CONTEXT_LINES);
}

function buildIssueSummary({ issue, latestEvent, latestEventFetchError, issueUrl }) {
  const lines = [
    "Sentry Issue 自动抓取摘要",
    `- 来源链接: ${issueUrl}`,
    `- Issue ID: ${issue.id ?? "未知"}`,
    `- Short ID: ${issue.shortId ?? "未知"}`,
    `- 标题: ${issue.title || issue.metadata?.title || "未知"}`,
    `- 状态: ${issue.status || "未知"}`,
    `- 严重级别: ${issue.level || "未知"}`,
    `- 项目: ${issue.project?.slug || issue.project?.name || "未知"}`,
    `- 影响次数: ${issue.count ?? "未知"}`,
    `- 影响用户数: ${issue.userCount ?? "未知"}`,
    `- 首次出现: ${issue.firstSeen || "未知"}`,
    `- 最近出现: ${issue.lastSeen || "未知"}`,
  ];

  if (isNonEmptyString(issue.culprit)) {
    lines.push(`- Culprit: ${issue.culprit.trim()}`);
  }

  if (isNonEmptyString(issue.permalink)) {
    lines.push(`- Permalink: ${issue.permalink.trim()}`);
  }

  if (!latestEvent) {
    lines.push(`- 最新事件: ${latestEventFetchError || "未获取到"}`);
    return lines.join("\n");
  }

  lines.push(`- 最新事件 ID: ${latestEvent.eventID || latestEvent.id || "未知"}`);
  lines.push(`- 最新事件时间: ${latestEvent.dateCreated || "未知"}`);
  lines.push(`- 平台: ${latestEvent.platform || "未知"}`);

  if (isNonEmptyString(latestEvent.title)) {
    lines.push(`- 最新事件标题: ${latestEvent.title.trim()}`);
  }

  if (isNonEmptyString(latestEvent.message)) {
    lines.push(`- 最新事件消息: ${latestEvent.message.trim()}`);
  }

  if (isNonEmptyString(latestEvent.metadata?.type)) {
    lines.push(`- 异常类型: ${latestEvent.metadata.type.trim()}`);
  }

  if (isNonEmptyString(latestEvent.metadata?.value)) {
    lines.push(`- 异常信息: ${latestEvent.metadata.value.trim()}`);
  }

  const requestSummary = extractRequestSummary(latestEvent);

  if (requestSummary) {
    lines.push(`- 请求信息: ${requestSummary}`);
  }

  const userSummary = extractUserSummary(latestEvent);

  if (userSummary) {
    lines.push(`- 用户信息: ${userSummary}`);
  }

  const tagLines = extractInterestingTags(latestEvent);

  if (tagLines.length > 0) {
    lines.push(`- 关键标签: ${tagLines.join(" | ")}`);
  }

  const contextLines = extractInterestingContexts(latestEvent);

  if (contextLines.length > 0) {
    lines.push("- 关键上下文:");
    lines.push(...contextLines.map((line) => `  - ${line}`));
  }

  const stackFrames = extractStackFrames(latestEvent);

  if (stackFrames.length > 0) {
    lines.push("- 最近堆栈帧:");
    lines.push(...stackFrames.map((line) => `  - ${line}`));
  }

  return lines.join("\n");
}

export async function fetchSentryIssueSummary({ issueUrl, authToken }) {
  const normalizedAuthToken = normalizeTrimmedString(authToken);

  if (!normalizedAuthToken) {
    throw createHttpError(400, "使用 Sentry Issue URL 自动抓取时必须提供 SENTRY_AUTH_TOKEN", {
      exposeError: false,
    });
  }

  const sentryIssueInfo = parseSentryIssueUrl(issueUrl);

  if (!sentryIssueInfo) {
    throw createHttpError(400, "Sentry Issue URL 格式不正确，请粘贴完整的 Issue 链接", {
      exposeError: false,
    });
  }

  const issueApiUrl = buildSentryApiUrl(sentryIssueInfo);
  const latestEventApiUrl = buildSentryApiUrl({
    ...sentryIssueInfo,
    eventId: "latest",
  });
  const issue = await fetchSentryJson(issueApiUrl, normalizedAuthToken);
  let latestEvent = null;
  let latestEventFetchError = null;

  try {
    latestEvent = await fetchSentryJson(latestEventApiUrl, normalizedAuthToken);
  } catch (error) {
    latestEventFetchError = error?.message || "获取最新事件失败";
  }

  return {
    issue: {
      id: issue?.id ?? null,
      shortId: issue?.shortId ?? null,
      title: issue?.title ?? issue?.metadata?.title ?? null,
      status: issue?.status ?? null,
      level: issue?.level ?? null,
    },
    latestEvent: latestEvent
      ? {
          id: latestEvent.eventID ?? latestEvent.id ?? null,
          title: latestEvent.title ?? null,
          timestamp: latestEvent.dateCreated ?? null,
        }
      : null,
    latestEventFetchError,
    summary: buildIssueSummary({
      issue,
      latestEvent,
      latestEventFetchError,
      issueUrl: sentryIssueInfo.issueUrl,
    }),
  };
}
