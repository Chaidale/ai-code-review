<template>
  <section class="page-section">
    <div class="section-header">
      <div>
        <span class="section-eyebrow">Workbench</span>
        <h2>保留调试入口，同时把历史视图独立出去</h2>
        <p>这里继续保留现有 `/api/review`、`/api/review-pr` 和 `/api/review-pr-monitoring` 的手动入口，方便调试和快速试跑。</p>
      </div>
    </div>

    <el-card class="surface-card">
      <div class="credentials">
        <h3>调用凭证</h3>
        <p class="credentials-desc">
          <code>DEEPSEEK_API_KEY</code> 为必填；<code>GITHUB_TOKEN</code> 可选；如需通过
          <code>Sentry Issue URL</code> 自动抓取错误详情，请提供 <code>SENTRY_AUTH_TOKEN</code>。
        </p>

        <div class="credentials-inputs">
          <el-input
            v-model="deepseekApiKey"
            type="password"
            show-password
            placeholder="请输入 DEEPSEEK_API_KEY"
            clearable
            autocomplete="off"
          />

          <el-input
            v-model="githubToken"
            type="password"
            show-password
            placeholder="请输入 GITHUB_TOKEN（选填）"
            clearable
            autocomplete="off"
          />

          <el-input
            v-model="sentryAuthToken"
            type="password"
            show-password
            placeholder="请输入 SENTRY_AUTH_TOKEN（选填，用于自动抓取 Sentry Issue）"
            clearable
            autocomplete="off"
          />
        </div>
      </div>

      <el-tabs v-model="activeTab">
        <el-tab-pane label="代码 Review" name="code">
          <div class="tab-panel">
            <el-select v-model="framework" class="framework-select">
              <el-option label="Vue" value="Vue" />
              <el-option label="React" value="React" />
              <el-option label="JavaScript" value="JavaScript" />
              <el-option label="TypeScript" value="TypeScript" />
            </el-select>

            <el-input
              v-model="code"
              type="textarea"
              :rows="16"
              placeholder="把你的前端代码粘贴到这里..."
            />

            <div class="action-row">
              <el-button
                type="primary"
                :loading="codeLoading"
                :disabled="prReviewLoading || prCommentLoading || prMonitoringLoading"
                @click="submitCodeReview"
              >
                开始 AI Review
              </el-button>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="GitHub PR Review" name="pr">
          <div class="tab-panel">
            <el-input
              v-model="prUrl"
              placeholder="请输入 GitHub PR 链接，例如：https://github.com/user/repo/pull/123"
              clearable
            />

            <div class="action-row">
              <el-button
                type="primary"
                :loading="prReviewLoading"
                :disabled="codeLoading || prCommentLoading || prMonitoringLoading"
                @click="submitPullRequestReview()"
              >
                分析 PR
              </el-button>

              <el-button
                :loading="prCommentLoading"
                :disabled="codeLoading || prReviewLoading || prMonitoringLoading"
                @click="submitPullRequestReview(true)"
              >
                AI 评论到 GitHub
              </el-button>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="PR + 监控分析" name="monitoring">
          <div class="tab-panel">
            <el-input
              v-model="prUrl"
              placeholder="请输入 GitHub PR 链接，例如：https://github.com/user/repo/pull/123"
              clearable
            />

            <el-input
              v-model="sentryIssueUrl"
              placeholder="可选：Sentry Issue URL"
              clearable
            />

            <el-input
              v-model="sentryIssueSummary"
              type="textarea"
              :rows="6"
              placeholder="可选：补充错误摘要"
            />

            <el-input
              v-model="performanceSummary"
              type="textarea"
              :rows="6"
              placeholder="请输入性能指标摘要"
            />

            <div class="action-row">
              <el-button
                type="primary"
                :loading="prMonitoringLoading"
                :disabled="codeLoading || prReviewLoading || prCommentLoading"
                @click="submitMonitoringReview"
              >
                开始分析
              </el-button>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-card v-if="result" class="surface-card">
      <template #header>
        <div class="surface-card__header">
          <span>{{ resultTitle }}</span>
          <div class="result-actions">
            <RouterLink v-if="currentAnalysisId" :to="`/analyses/${currentAnalysisId}`" class="detail-link">
              查看详情页
            </RouterLink>
            <el-button text @click="copyResult">
              复制结果
            </el-button>
          </div>
        </div>
      </template>

      <AnalysisSummaryPanel :structured-result="currentStructuredResult" />

      <div class="markdown" v-html="htmlResult"></div>
    </el-card>

    <el-card class="surface-card">
      <template #header>
        <div class="surface-card__header">
          <span>最近分析记录</span>
          <el-button text :loading="analysisHistoryLoading" @click="loadAnalysisHistory">
            刷新
          </el-button>
        </div>
      </template>

      <AnalysisRecordList
        :items="analysisHistory"
        empty-text="还没有分析记录，先跑一次 PR 分析试试。"
      />
    </el-card>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import MarkdownIt from "markdown-it";
import { ElMessage } from "element-plus";
import { RouterLink } from "vue-router";
import AnalysisRecordList from "../components/AnalysisRecordList.vue";
import AnalysisSummaryPanel from "../components/AnalysisSummaryPanel.vue";
import {
  getAnalyses,
  reviewCode,
  reviewPullRequest,
  reviewPullRequestMonitoring,
} from "../lib/api.js";
import { getRequestErrorMessage } from "../lib/request.js";

const md = new MarkdownIt();

const activeTab = ref("code");
const framework = ref("Vue");
const code = ref("");
const prUrl = ref("");
const sentryIssueUrl = ref("");
const sentryIssueSummary = ref("");
const performanceSummary = ref("");
const result = ref("");
const resultTitle = ref("AI 输出");
const currentAnalysisId = ref("");
const currentStructuredResult = ref(null);
const codeLoading = ref(false);
const prReviewLoading = ref(false);
const prCommentLoading = ref(false);
const prMonitoringLoading = ref(false);
const analysisHistoryLoading = ref(false);
const analysisHistory = ref([]);
const deepseekApiKey = ref("");
const githubToken = ref("");
const sentryAuthToken = ref("");

const htmlResult = computed(() => md.render(result.value));

function formatMonitoringErrorMessage(error) {
  const message = getRequestErrorMessage(
    error,
    "监控分析失败，请检查 PR 链接、Sentry 链接/权限、摘要内容或后端服务。",
  );
  const normalizedIssueUrl = error?.response?.data?.normalizedIssueUrl;

  return normalizedIssueUrl
    ? `${message}\n服务端识别到的 Sentry URL：${normalizedIssueUrl}`
    : message;
}

function resetResult(title) {
  resultTitle.value = title;
  result.value = "";
  currentAnalysisId.value = "";
  currentStructuredResult.value = null;
}

function ensureDeepseekApiKey() {
  if (deepseekApiKey.value.trim()) {
    return true;
  }

  ElMessage.warning("请先输入 DEEPSEEK_API_KEY");
  return false;
}

function ensurePrUrl() {
  if (prUrl.value.trim()) {
    return true;
  }

  ElMessage.warning("请先输入 GitHub PR 链接");
  return false;
}

function ensureMonitoringContext() {
  if (
    sentryIssueUrl.value.trim()
    || sentryIssueSummary.value.trim()
    || performanceSummary.value.trim()
  ) {
    return true;
  }

  ElMessage.warning("请至少输入 Sentry Issue URL、错误摘要或性能指标摘要");
  return false;
}

async function loadAnalysisHistory() {
  analysisHistoryLoading.value = true;

  try {
    const data = await getAnalyses({ limit: 6 });
    analysisHistory.value = Array.isArray(data?.items) ? data.items : [];
  } catch (error) {
    ElMessage.warning(getRequestErrorMessage(error, "加载分析记录失败"));
  } finally {
    analysisHistoryLoading.value = false;
  }
}

async function submitCodeReview() {
  if (!ensureDeepseekApiKey()) {
    return;
  }

  if (!code.value.trim()) {
    ElMessage.warning("请先输入代码");
    return;
  }

  codeLoading.value = true;
  resetResult("代码 Review 结果");

  try {
    const data = await reviewCode({
      code: code.value,
      framework: framework.value,
      deepseekApiKey: deepseekApiKey.value.trim(),
    });

    result.value = data?.result || "";
  } catch (error) {
    result.value = getRequestErrorMessage(error, "Review 失败，请检查后端服务、DeepSeek Key 或网络。");
  } finally {
    codeLoading.value = false;
  }
}

async function submitPullRequestReview(publishReviewComment = false) {
  if (!ensureDeepseekApiKey() || !ensurePrUrl()) {
    return;
  }

  if (publishReviewComment && !githubToken.value.trim()) {
    ElMessage.warning("发布 GitHub PR 评论前，请先输入 GITHUB_TOKEN");
    return;
  }

  if (publishReviewComment) {
    prCommentLoading.value = true;
    resetResult("GitHub PR 评论结果");
  } else {
    prReviewLoading.value = true;
    resetResult("GitHub PR Review 结果");
  }

  try {
    const data = await reviewPullRequest({
      prUrl: prUrl.value.trim(),
      deepseekApiKey: deepseekApiKey.value.trim(),
      githubToken: githubToken.value.trim(),
      publishReviewComment,
    });

    result.value = data?.result || "";
    currentAnalysisId.value = data?.analysisId || "";
    currentStructuredResult.value = data?.structuredResult || null;
    await loadAnalysisHistory();
  } catch (error) {
    result.value = getRequestErrorMessage(error, "PR Review 失败，请检查 PR 链接、GitHub 权限或后端服务。");
  } finally {
    if (publishReviewComment) {
      prCommentLoading.value = false;
    } else {
      prReviewLoading.value = false;
    }
  }
}

async function submitMonitoringReview() {
  if (!ensureDeepseekApiKey() || !ensurePrUrl() || !ensureMonitoringContext()) {
    return;
  }

  prMonitoringLoading.value = true;
  resetResult("PR + 监控分析结果");

  try {
    const data = await reviewPullRequestMonitoring({
      prUrl: prUrl.value.trim(),
      deepseekApiKey: deepseekApiKey.value.trim(),
      githubToken: githubToken.value.trim(),
      sentryIssueUrl: sentryIssueUrl.value.trim(),
      sentryIssueSummary: sentryIssueSummary.value.trim(),
      performanceSummary: performanceSummary.value.trim(),
      sentryAuthToken: sentryAuthToken.value.trim(),
    });

    result.value = data?.result || "";
    currentAnalysisId.value = data?.analysisId || "";
    currentStructuredResult.value = data?.structuredResult || null;
    await loadAnalysisHistory();
  } catch (error) {
    result.value = formatMonitoringErrorMessage(error);
  } finally {
    prMonitoringLoading.value = false;
  }
}

async function copyResult() {
  try {
    await navigator.clipboard.writeText(result.value);
    ElMessage.success("已复制");
  } catch {
    ElMessage.error("复制失败，请手动复制");
  }
}

onMounted(loadAnalysisHistory);
</script>

<style scoped>
.page-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-eyebrow {
  display: inline-flex;
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #a25d34;
}

.section-header h2 {
  margin: 0 0 8px;
}

.section-header p {
  max-width: 760px;
  color: #6e5d52;
  line-height: 1.7;
}

.surface-card {
  border: none;
  border-radius: 24px;
  box-shadow: 0 24px 40px rgba(106, 83, 64, 0.08);
}

.surface-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.credentials {
  margin-bottom: 20px;
  padding: 18px;
  border-radius: 20px;
  background: #faf5ee;
  border: 1px solid rgba(188, 120, 63, 0.16);
}

.credentials h3 {
  margin: 0 0 8px;
  font-size: 16px;
}

.credentials-desc {
  margin: 0 0 12px;
  color: #6e5d52;
  line-height: 1.7;
}

.credentials-inputs {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tab-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.framework-select {
  width: 180px;
}

.action-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.result-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.detail-link {
  color: #8f4f28;
  text-decoration: none;
  font-weight: 600;
}

.markdown {
  margin-top: 18px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}

.markdown :deep(h1),
.markdown :deep(h2),
.markdown :deep(h3) {
  margin-top: 1.2em;
}

.markdown :deep(pre) {
  padding: 16px;
  overflow: auto;
  border-radius: 14px;
  background: #f6f1ea;
}

.markdown :deep(code) {
  padding: 2px 6px;
  border-radius: 6px;
  background: #f6f1ea;
}

@media (max-width: 768px) {
  .framework-select {
    width: 100%;
  }

  .surface-card__header,
  .result-actions {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
