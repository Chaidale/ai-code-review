import * as Sentry from "@sentry/vue";

const DEFAULT_TRACE_PROPAGATION_TARGETS = [
  "localhost",
  /^\/api/,
];
const GLOBAL_SENTRY_DIAGNOSTICS_KEY = "__AI_CODE_REVIEW_SENTRY__";

function normalizeOptionalString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSampleRate(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function isDebugEnabled(config) {
  return normalizeOptionalString(config?.environment) === "development";
}

function shouldEnableReplay(config) {
  return normalizeSampleRate(config?.replaysSessionSampleRate, 0) > 0
    || normalizeSampleRate(config?.replaysOnErrorSampleRate, 0) > 0;
}

function getDiagnosticsTarget() {
  return typeof window !== "undefined" ? window : globalThis;
}

function setGlobalSentryDiagnostics(partialState) {
  const target = getDiagnosticsTarget();
  const previousState = target[GLOBAL_SENTRY_DIAGNOSTICS_KEY] ?? {};

  target[GLOBAL_SENTRY_DIAGNOSTICS_KEY] = {
    ...previousState,
    ...partialState,
    async captureTestException(message = "Sentry browser smoke test") {
      const error = new Error(message);
      const eventId = Sentry.captureException(error);

      if (typeof Sentry.flush === "function") {
        await Sentry.flush(2_000);
      }

      return eventId;
    },
    async captureTestMessage(message = "Sentry browser smoke test message") {
      const eventId = Sentry.captureMessage(message);

      if (typeof Sentry.flush === "function") {
        await Sentry.flush(2_000);
      }

      return eventId;
    },
  };
}

export async function loadPublicRuntimeConfig() {
  try {
    const response = await fetch("/api/public-config", {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return { sentry: { enabled: false, dsn: null } };
    }

    return await response.json();
  } catch {
    return { sentry: { enabled: false, dsn: null } };
  }
}

export function initBrowserSentry(app, config) {
  const dsn = normalizeOptionalString(config?.dsn);

  if (!dsn) {
    setGlobalSentryDiagnostics({
      initialized: false,
      reason: "missing-browser-dsn",
      config: {
        enabled: false,
      },
    });

    return false;
  }

  const integrations = [
    Sentry.vueIntegration({
      app,
      tracingOptions: {
        trackComponents: true,
      },
    }),
    Sentry.browserTracingIntegration(),
  ];

  if (shouldEnableReplay(config)) {
    integrations.push(Sentry.replayIntegration());
  }

  Sentry.init({
    dsn,
    integrations,
    environment: normalizeOptionalString(config?.environment) || undefined,
    release: normalizeOptionalString(config?.release) || undefined,
    tracesSampleRate: normalizeSampleRate(config?.tracesSampleRate, 0.1),
    replaysSessionSampleRate: normalizeSampleRate(config?.replaysSessionSampleRate, 0),
    replaysOnErrorSampleRate: normalizeSampleRate(config?.replaysOnErrorSampleRate, 1),
    tracePropagationTargets: DEFAULT_TRACE_PROPAGATION_TARGETS,
    sendDefaultPii: false,
    debug: isDebugEnabled(config),
  });

  setGlobalSentryDiagnostics({
    initialized: true,
    reason: "initialized",
    config: {
      enabled: true,
      dsn,
      environment: normalizeOptionalString(config?.environment) || null,
      release: normalizeOptionalString(config?.release) || null,
      tracesSampleRate: normalizeSampleRate(config?.tracesSampleRate, 0.1),
      replaysSessionSampleRate: normalizeSampleRate(config?.replaysSessionSampleRate, 0),
      replaysOnErrorSampleRate: normalizeSampleRate(config?.replaysOnErrorSampleRate, 1),
    },
  });

  return true;
}
