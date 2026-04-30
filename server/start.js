import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { initServerSentry } from "./lib/sentry-sdk.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const releaseFilePath = path.resolve(__dirname, ".sentry-release");

function normalizeOptionalString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function buildReleaseFromSha(sha) {
  const normalizedSha = normalizeOptionalString(sha);

  return normalizedSha ? `ai-code-review@${normalizedSha}` : "";
}

function readReleaseFromFile() {
  try {
    return normalizeOptionalString(readFileSync(releaseFilePath, "utf8"));
  } catch {
    return "";
  }
}

function readReleaseFromGit() {
  try {
    const shortSha = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });

    return buildReleaseFromSha(shortSha);
  } catch {
    return "";
  }
}

function resolveSentryRelease() {
  const explicitRelease = normalizeOptionalString(process.env.SENTRY_RELEASE);

  if (explicitRelease) {
    return explicitRelease;
  }

  const gitCommitSha = normalizeOptionalString(process.env.GIT_COMMIT_SHA);

  if (gitCommitSha) {
    return buildReleaseFromSha(gitCommitSha);
  }

  return readReleaseFromFile() || readReleaseFromGit();
}

const resolvedSentryRelease = resolveSentryRelease();

if (resolvedSentryRelease) {
  process.env.SENTRY_RELEASE = resolvedSentryRelease;
}

initServerSentry();
