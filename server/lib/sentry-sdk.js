import * as Sentry from "@sentry/node";

import {
  SENTRY_BROWSER_DSN,
  SENTRY_BROWSER_TRACES_SAMPLE_RATE,
  SENTRY_DSN,
  SENTRY_ENVIRONMENT,
  SENTRY_RELEASE,
  SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
  SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
  SENTRY_TRACES_SAMPLE_RATE,
} from "../config.js";

function normalizeOptionalString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function initServerSentry() {
  if (Sentry.isInitialized()) {
    return true;
  }

  const dsn = normalizeOptionalString(SENTRY_DSN);

  if (!dsn) {
    return false;
  }

  Sentry.init({
    dsn,
    environment: SENTRY_ENVIRONMENT,
    release: normalizeOptionalString(SENTRY_RELEASE) || undefined,
    tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
    sendDefaultPii: false,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],
  });

  return true;
}

export function isServerSentryEnabled() {
  return Sentry.isInitialized();
}

export function setupServerSentryErrorHandler(app) {
  if (!Sentry.isInitialized()) {
    return;
  }

  Sentry.setupExpressErrorHandler(app);
}

export function getPublicRuntimeConfig() {
  const browserDsn = normalizeOptionalString(SENTRY_BROWSER_DSN);

  return {
    sentry: {
      enabled: Boolean(browserDsn),
      dsn: browserDsn || null,
      environment: normalizeOptionalString(SENTRY_ENVIRONMENT) || null,
      release: normalizeOptionalString(SENTRY_RELEASE) || null,
      tracesSampleRate: SENTRY_BROWSER_TRACES_SAMPLE_RATE,
      replaysSessionSampleRate: SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
      replaysOnErrorSampleRate: SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
    },
  };
}
