import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });

function parsePositiveInteger(value, fallback, name) {
  if (value == null || value === "") {
    return fallback;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${name} 必须是正整数`);
  }

  return parsedValue;
}

function parseNonEmptyString(value, fallback, name) {
  const normalizedValue = typeof value === "string" ? value.trim() : "";

  if (!normalizedValue) {
    if (typeof value === "string" && fallback) {
      console.warn(`${name} 为空字符串，已回退到默认值：${fallback}`);
    }

    if (fallback) {
      return fallback;
    }

    throw new Error(`${name} 不能为空`);
  }

  return normalizedValue;
}

function parseOptionalString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseUnitIntervalNumber(value, fallback, name) {
  if (value == null || value === "") {
    return fallback;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 0 || parsedValue > 1) {
    throw new Error(`${name} 必须是 0 到 1 之间的数字`);
  }

  return parsedValue;
}

export const PORT = parsePositiveInteger(process.env.PORT, 3001, "PORT");
export const AI_MODEL = parseNonEmptyString(process.env.DEEPSEEK_MODEL, "deepseek-v4-flash", "DEEPSEEK_MODEL");
export const AI_TIMEOUT_MS = parsePositiveInteger(process.env.AI_TIMEOUT_MS, 30_000, "AI_TIMEOUT_MS");
export const SENTRY_TIMEOUT_MS = parsePositiveInteger(process.env.SENTRY_TIMEOUT_MS, 15_000, "SENTRY_TIMEOUT_MS");
export const AI_MAX_TOKENS = parsePositiveInteger(process.env.AI_MAX_TOKENS, 2_048, "AI_MAX_TOKENS");
export const CODE_REVIEW_MAX_TOKENS = parsePositiveInteger(process.env.CODE_REVIEW_MAX_TOKENS, 640, "CODE_REVIEW_MAX_TOKENS");
export const PR_REVIEW_MAX_TOKENS = parsePositiveInteger(process.env.PR_REVIEW_MAX_TOKENS, 1_024, "PR_REVIEW_MAX_TOKENS");
export const PR_MONITORING_REVIEW_MAX_TOKENS = parsePositiveInteger(
  process.env.PR_MONITORING_REVIEW_MAX_TOKENS,
  1_024,
  "PR_MONITORING_REVIEW_MAX_TOKENS",
);
export const GITHUB_COMMENT_MAX_TOKENS = parsePositiveInteger(process.env.GITHUB_COMMENT_MAX_TOKENS, 512, "GITHUB_COMMENT_MAX_TOKENS");
export const GITHUB_TIMEOUT_MS = parsePositiveInteger(process.env.GITHUB_TIMEOUT_MS, 15_000, "GITHUB_TIMEOUT_MS");
export const MAX_PR_FILES = parsePositiveInteger(process.env.MAX_PR_FILES, 4, "MAX_PR_FILES");
export const MAX_TOTAL_DIFF_CHARS = parsePositiveInteger(process.env.MAX_TOTAL_DIFF_CHARS, 24_000, "MAX_TOTAL_DIFF_CHARS");
export const MAX_FILE_DIFF_CHARS = parsePositiveInteger(process.env.MAX_FILE_DIFF_CHARS, 6_000, "MAX_FILE_DIFF_CHARS");
export const MAX_CODE_REVIEW_CHARS = parsePositiveInteger(process.env.MAX_CODE_REVIEW_CHARS, 8_000, "MAX_CODE_REVIEW_CHARS");
export const MAX_MONITORING_SUMMARY_CHARS = parsePositiveInteger(
  process.env.MAX_MONITORING_SUMMARY_CHARS,
  4_000,
  "MAX_MONITORING_SUMMARY_CHARS",
);
export const MAX_CROSS_FILE_DIFF_CHARS = parsePositiveInteger(
  process.env.MAX_CROSS_FILE_DIFF_CHARS ?? process.env.CROSS_FILE_DIFF_CHARS,
  1_500,
  "MAX_CROSS_FILE_DIFF_CHARS",
);
export const REVIEW_CACHE_TTL_MS = parsePositiveInteger(process.env.REVIEW_CACHE_TTL_MS, 300_000, "REVIEW_CACHE_TTL_MS");
export const DEFAULT_SENTRY_AUTH_TOKEN = parseOptionalString(process.env.SENTRY_AUTH_TOKEN);
export const SENTRY_DSN = parseOptionalString(process.env.SENTRY_DSN);
export const SENTRY_BROWSER_DSN = parseOptionalString(process.env.SENTRY_BROWSER_DSN) || SENTRY_DSN;
export const SENTRY_RELEASE = parseOptionalString(process.env.SENTRY_RELEASE);
export const SENTRY_ENVIRONMENT = parseNonEmptyString(
  process.env.SENTRY_ENVIRONMENT,
  parseOptionalString(process.env.NODE_ENV) || "development",
  "SENTRY_ENVIRONMENT",
);
export const SENTRY_TRACES_SAMPLE_RATE = parseUnitIntervalNumber(
  process.env.SENTRY_TRACES_SAMPLE_RATE,
  0.1,
  "SENTRY_TRACES_SAMPLE_RATE",
);
export const SENTRY_BROWSER_TRACES_SAMPLE_RATE = parseUnitIntervalNumber(
  process.env.SENTRY_BROWSER_TRACES_SAMPLE_RATE,
  SENTRY_TRACES_SAMPLE_RATE,
  "SENTRY_BROWSER_TRACES_SAMPLE_RATE",
);
export const SENTRY_REPLAYS_SESSION_SAMPLE_RATE = parseUnitIntervalNumber(
  process.env.SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
  0,
  "SENTRY_REPLAYS_SESSION_SAMPLE_RATE",
);
export const SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE = parseUnitIntervalNumber(
  process.env.SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
  1,
  "SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE",
);
