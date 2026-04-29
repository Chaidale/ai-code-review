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

export const PORT = parsePositiveInteger(process.env.PORT, 3001, "PORT");
export const AI_MODEL = parseNonEmptyString(process.env.DEEPSEEK_MODEL, "deepseek-v4-pro", "DEEPSEEK_MODEL");
export const AI_TIMEOUT_MS = parsePositiveInteger(process.env.AI_TIMEOUT_MS, 60_000, "AI_TIMEOUT_MS");
export const AI_MAX_TOKENS = parsePositiveInteger(process.env.AI_MAX_TOKENS, 4_096, "AI_MAX_TOKENS");
export const GITHUB_TIMEOUT_MS = parsePositiveInteger(process.env.GITHUB_TIMEOUT_MS, 15_000, "GITHUB_TIMEOUT_MS");
export const MAX_PR_FILES = parsePositiveInteger(process.env.MAX_PR_FILES, 8, "MAX_PR_FILES");
export const MAX_TOTAL_DIFF_CHARS = parsePositiveInteger(process.env.MAX_TOTAL_DIFF_CHARS, 80_000, "MAX_TOTAL_DIFF_CHARS");
export const MAX_FILE_DIFF_CHARS = parsePositiveInteger(process.env.MAX_FILE_DIFF_CHARS, 12_000, "MAX_FILE_DIFF_CHARS");
export const MAX_CROSS_FILE_DIFF_CHARS = parsePositiveInteger(process.env.MAX_CROSS_FILE_DIFF_CHARS, 2_500, "MAX_CROSS_FILE_DIFF_CHARS");
export const REVIEW_CONCURRENCY = parsePositiveInteger(process.env.REVIEW_CONCURRENCY, 3, "REVIEW_CONCURRENCY");
