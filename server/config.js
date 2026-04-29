import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });

export const PORT = Number(process.env.PORT) || 3001;
export const AI_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
export const AI_TIMEOUT_MS = 60_000;
export const GITHUB_TIMEOUT_MS = 15_000;
export const MAX_PR_FILES = 8;
export const MAX_TOTAL_DIFF_CHARS = 80_000;
export const MAX_FILE_DIFF_CHARS = 12_000;
export const CROSS_FILE_DIFF_CHARS = 2_500;
export const REVIEW_CONCURRENCY = 3;
