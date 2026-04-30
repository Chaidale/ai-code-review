import express from "express";
import cors from "cors";
import { PORT } from "./config.js";
import {
  ensureDatabaseSchema,
  getDatabaseState,
  startDatabaseInitialization,
} from "./db/bootstrap.js";
import { asyncHandler } from "./lib/async.js";
import { createHttpError, toErrorResponse } from "./lib/errors.js";
import {
  getPublicRuntimeConfig,
  isServerSentryEnabled,
  setupServerSentryErrorHandler,
} from "./lib/sentry-sdk.js";
import { listProjectAnalysisRecords } from "./lib/analysis-store.js";
import {
  createProject,
  getProjectByIdOrThrow,
  listProjects,
} from "./modules/projects/service.js";
import {
  getStoredAnalysisDetail,
  listStoredAnalyses,
  reviewCode,
  reviewPullRequest,
  reviewPullRequestMonitoring,
} from "./services/review-service.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const requireDatabaseReady = asyncHandler(async (req, res, next) => {
  await ensureDatabaseSchema();
  next();
});

app.get("/api/public-config", asyncHandler(async (req, res) => {
  res.json(getPublicRuntimeConfig());
}));

app.get("/api/health", asyncHandler(async (req, res) => {
  const database = getDatabaseState();
  const status = database.ready ? 200 : 503;

  res.status(status).json({
    ok: database.ready,
    database,
  });
}));

app.post("/api/review", asyncHandler(async (req, res) => {
  const result = await reviewCode(req.body ?? {});
  res.json(result);
}));

app.use([
  "/api/review-pr",
  "/api/review-pr-monitoring",
  "/api/v1",
], requireDatabaseReady);

app.post("/api/review-pr", asyncHandler(async (req, res) => {
  const result = await reviewPullRequest(req.body ?? {});
  res.json(result);
}));

app.post("/api/review-pr-monitoring", asyncHandler(async (req, res) => {
  const result = await reviewPullRequestMonitoring(req.body ?? {});
  res.json(result);
}));

app.get("/api/v1/analyses", asyncHandler(async (req, res) => {
  const result = await listStoredAnalyses(req.query ?? {});
  res.json(result);
}));

app.get("/api/v1/projects", asyncHandler(async (req, res) => {
  const items = await listProjects(req.query ?? {});
  res.json({ items });
}));

app.post("/api/v1/projects", asyncHandler(async (req, res) => {
  const project = await createProject(req.body ?? {});
  res.status(201).json({ project });
}));

app.get("/api/v1/projects/:projectId", asyncHandler(async (req, res) => {
  const project = await getProjectByIdOrThrow(req.params.projectId);
  res.json({ project });
}));

app.get("/api/v1/projects/:projectId/analyses", asyncHandler(async (req, res) => {
  const project = await getProjectByIdOrThrow(req.params.projectId);
  const items = await listProjectAnalysisRecords(req.params.projectId, req.query ?? {});
  res.json({
    project,
    items,
  });
}));

app.post("/api/v1/projects/:projectId/analyses", asyncHandler(async (req, res) => {
  await getProjectByIdOrThrow(req.params.projectId);

  const type = typeof req.body?.type === "string" ? req.body.type.trim() : "pr-monitoring";
  const payload = {
    ...(req.body ?? {}),
    projectId: req.params.projectId,
  };

  if (type === "pr-review") {
    const result = await reviewPullRequest(payload);
    res.status(201).json(result);
    return;
  }

  if (type === "pr-monitoring") {
    const result = await reviewPullRequestMonitoring(payload);
    res.status(201).json(result);
    return;
  }

  throw createHttpError(400, "项目分析任务仅支持 pr-review 或 pr-monitoring", {
    exposeError: false,
  });
}));

app.get("/api/v1/analyses/:analysisId", asyncHandler(async (req, res) => {
  const result = await getStoredAnalysisDetail(req.params.analysisId);
  res.json(result);
}));

setupServerSentryErrorHandler(app);

app.use((error, req, res, next) => {
  console.error("请求处理失败：", error);

  const { status, body } = toErrorResponse(error);
  res.status(status).json(body);
});

app.listen(PORT, "0.0.0.0", () => {
  startDatabaseInitialization();

  if (isServerSentryEnabled()) {
    console.log("Sentry server monitoring enabled");
  } else {
    console.log("Sentry server monitoring disabled: missing SENTRY_DSN");
  }

  console.log(`Server running on http://localhost:${PORT}`);
});
