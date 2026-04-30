import axios from "axios";

async function unwrap(promise) {
  const response = await promise;
  return response.data;
}

export function getProjects(params = {}) {
  return unwrap(axios.get("/api/v1/projects", { params }));
}

export function createProject(payload) {
  return unwrap(axios.post("/api/v1/projects", payload));
}

export function getProject(projectId) {
  return unwrap(axios.get(`/api/v1/projects/${projectId}`));
}

export function getProjectAnalyses(projectId, params = {}) {
  return unwrap(axios.get(`/api/v1/projects/${projectId}/analyses`, { params }));
}

export function createProjectAnalysis(projectId, payload) {
  return unwrap(axios.post(`/api/v1/projects/${projectId}/analyses`, payload));
}

export function getAnalyses(params = {}) {
  return unwrap(axios.get("/api/v1/analyses", { params }));
}

export function getAnalysisDetail(analysisId) {
  return unwrap(axios.get(`/api/v1/analyses/${analysisId}`));
}

export function reviewCode(payload) {
  return unwrap(axios.post("/api/review", payload));
}

export function reviewPullRequest(payload) {
  return unwrap(axios.post("/api/review-pr", payload));
}

export function reviewPullRequestMonitoring(payload) {
  return unwrap(axios.post("/api/review-pr-monitoring", payload));
}
