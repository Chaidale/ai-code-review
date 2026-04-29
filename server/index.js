import express from "express";
import cors from "cors";
import { PORT } from "./config.js";
import { asyncHandler } from "./lib/async.js";
import { toErrorResponse } from "./lib/errors.js";
import {
  reviewCode,
  reviewPullRequest,
  reviewPullRequestMonitoring,
} from "./services/review-service.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.post("/api/review", asyncHandler(async (req, res) => {
  const result = await reviewCode(req.body ?? {});
  res.json(result);
}));

app.post("/api/review-pr", asyncHandler(async (req, res) => {
  const result = await reviewPullRequest(req.body ?? {});
  res.json(result);
}));

app.post("/api/review-pr-monitoring", asyncHandler(async (req, res) => {
  const result = await reviewPullRequestMonitoring(req.body ?? {});
  res.json(result);
}));

app.use((error, req, res, next) => {
  console.error("请求处理失败：", error);

  const { status, body } = toErrorResponse(error);
  res.status(status).json(body);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
