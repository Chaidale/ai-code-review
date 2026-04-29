<template>
  <div class="page">
    <div class="page-hero">
      <h1>AI 代码 Review 与监控风险分析</h1>
      <p class="desc">
        支持粘贴代码 Review、GitHub PR 自动 Review，以及结合错误与性能摘要做 PR 风险分析。
      </p>
    </div>

    <el-card class="main-card">
      <div class="credentials">
        <h3>调用凭证</h3>
        <p class="credentials-desc">
          <code>DEEPSEEK_API_KEY</code> 为必填，<code>GITHUB_TOKEN</code> 可选，仅在需要更高 GitHub 权限或访问频率时填写。
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
              :rows="18"
              placeholder="把你的前端代码粘贴到这里..."
            />

            <div class="action-row">
              <el-button
                type="primary"
                :loading="codeLoading"
                :disabled="prReviewLoading || prCommentLoading || prMonitoringLoading"
                @click="reviewCode"
              >
                开始 AI Review
              </el-button>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="GitHub PR Review" name="pr">
          <div class="tab-panel">
            <p class="form-note">
              输入 GitHub PR 链接后，AI 会基于 diff 输出整体改动和主要风险；如需直接评论到 GitHub，请同时填写
              <code>GITHUB_TOKEN</code>。
            </p>

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
                @click="reviewPR"
              >
                分析 PR
              </el-button>

              <el-button
                :loading="prCommentLoading"
                :disabled="codeLoading || prReviewLoading || prMonitoringLoading"
                @click="reviewPRAndComment"
              >
                AI 评论到 GitHub
              </el-button>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="PR + 监控分析" name="monitoring">
          <div class="tab-panel">
            <p class="form-note">
              把 PR diff 与错误/性能摘要一起交给 AI，判断是否可能引发线上错误或性能回归。当前版本不会自动抓取
              Sentry 链接，请粘贴摘要正文。
            </p>

            <el-input
              v-model="prUrl"
              placeholder="请输入 GitHub PR 链接，例如：https://github.com/user/repo/pull/123"
              clearable
            />

            <el-input
              v-model="sentryIssueSummary"
              type="textarea"
              :rows="7"
              placeholder="请输入 Sentry Issue / 错误摘要，例如：报错标题、堆栈、影响范围、最近发布版本、出现时间段..."
            />

            <el-input
              v-model="performanceSummary"
              type="textarea"
              :rows="7"
              placeholder="请输入性能指标摘要，例如：LCP 从 2.1s 升到 4.9s、接口 p95 从 280ms 升到 980ms、慢页面集中在 checkout..."
            />

            <div class="action-row">
              <el-button
                type="primary"
                :loading="prMonitoringLoading"
                :disabled="codeLoading || prReviewLoading || prCommentLoading"
                @click="analyzePullRequestMonitoring"
              >
                开始分析
              </el-button>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-card v-if="result" class="result-card">
      <template #header>
        <div class="result-header">
          <span>{{ resultTitle }}</span>
          <el-button size="small" @click="copyResult">复制结果</el-button>
        </div>
      </template>

      <div class="markdown" v-html="htmlResult"></div>
    </el-card>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import axios from "axios";
import MarkdownIt from "markdown-it";
import { ElMessage } from "element-plus";

const md = new MarkdownIt();

const activeTab = ref("code");
const framework = ref("Vue");
const code = ref("");
const prUrl = ref("");
const sentryIssueSummary = ref("");
const performanceSummary = ref("");
const result = ref("");
const resultTitle = ref("AI 输出");
const codeLoading = ref(false);
const prReviewLoading = ref(false);
const prCommentLoading = ref(false);
const prMonitoringLoading = ref(false);
const deepseekApiKey = ref("");
const githubToken = ref("");

const htmlResult = computed(() => md.render(result.value));

const ensureDeepseekApiKey = () => {
  if (deepseekApiKey.value.trim()) {
    return true;
  }

  ElMessage.warning("请先输入 DEEPSEEK_API_KEY");
  return false;
};

const ensurePrUrl = () => {
  if (prUrl.value.trim()) {
    return true;
  }

  ElMessage.warning("请先输入 GitHub PR 链接");
  return false;
};

const ensureMonitoringContext = () => {
  if (sentryIssueSummary.value.trim() || performanceSummary.value.trim()) {
    return true;
  }

  ElMessage.warning("请至少输入错误摘要或性能指标摘要");
  return false;
};

const reviewCode = async () => {
  if (!ensureDeepseekApiKey()) {
    return;
  }

  if (!code.value.trim()) {
    ElMessage.warning("请先输入代码");
    return;
  }

  codeLoading.value = true;
  resultTitle.value = "代码 Review 结果";
  result.value = "";

  try {
    const res = await axios.post("/api/review", {
      code: code.value,
      framework: framework.value,
      deepseekApiKey: deepseekApiKey.value.trim(),
    });

    result.value = res.data.result;
  } catch (err) {
    result.value =
      err.response?.data?.error ||
      err.response?.data?.message ||
      "Review 失败，请检查后端服务、DeepSeek Key 或网络。";
  } finally {
    codeLoading.value = false;
  }
};

const reviewPR = async () => {
  await submitPullRequestReview();
};

const reviewPRAndComment = async () => {
  await submitPullRequestReview(true);
};

const submitPullRequestReview = async (publishReviewComment = false) => {
  if (!ensureDeepseekApiKey() || !ensurePrUrl()) {
    return;
  }

  if (publishReviewComment && !githubToken.value.trim()) {
    ElMessage.warning("发布 GitHub PR 评论前，请先输入 GITHUB_TOKEN");
    return;
  }

  if (publishReviewComment) {
    prCommentLoading.value = true;
    resultTitle.value = "GitHub PR 评论结果";
  } else {
    prReviewLoading.value = true;
    resultTitle.value = "GitHub PR Review 结果";
  }

  result.value = "";

  try {
    const res = await axios.post("/api/review-pr", {
      prUrl: prUrl.value.trim(),
      deepseekApiKey: deepseekApiKey.value.trim(),
      githubToken: githubToken.value.trim(),
      publishReviewComment,
    });

    result.value = res.data.result;

    if (publishReviewComment && res.data.githubReviewPublished) {
      ElMessage.success("AI 评论已发布到 GitHub PR");
    } else if (publishReviewComment && res.data.githubReviewPublishError) {
      ElMessage.warning("分析完成，但发布 GitHub 评论失败");
    }
  } catch (err) {
    result.value =
      err.response?.data?.error ||
      err.response?.data?.message ||
      "PR Review 失败，请检查 PR 链接、GitHub 权限或后端服务。";
  } finally {
    if (publishReviewComment) {
      prCommentLoading.value = false;
    } else {
      prReviewLoading.value = false;
    }
  }
};

const analyzePullRequestMonitoring = async () => {
  if (!ensureDeepseekApiKey() || !ensurePrUrl() || !ensureMonitoringContext()) {
    return;
  }

  prMonitoringLoading.value = true;
  resultTitle.value = "PR + 监控分析结果";
  result.value = "";

  try {
    const res = await axios.post("/api/review-pr-monitoring", {
      prUrl: prUrl.value.trim(),
      deepseekApiKey: deepseekApiKey.value.trim(),
      githubToken: githubToken.value.trim(),
      sentryIssueSummary: sentryIssueSummary.value.trim(),
      performanceSummary: performanceSummary.value.trim(),
    });

    result.value = res.data.result;
  } catch (err) {
    result.value =
      err.response?.data?.error ||
      err.response?.data?.message ||
      "监控分析失败，请检查 PR 链接、摘要内容、GitHub 权限或后端服务。";
  } finally {
    prMonitoringLoading.value = false;
  }
};

const copyResult = async () => {
  try {
    await navigator.clipboard.writeText(result.value);
    ElMessage.success("已复制");
  } catch {
    ElMessage.error("复制失败，请手动复制");
  }
};
</script>

<style scoped>
.page {
  max-width: 1100px;
  margin: 32px auto 48px;
  padding: 0 20px;
}

.page-hero {
  text-align: center;
  margin-bottom: 24px;
}

h1 {
  margin: 0 0 10px;
  line-height: 1.2;
}

.desc {
  color: #666;
  line-height: 1.7;
}

.credentials {
  margin-bottom: 20px;
  padding: 16px;
  background: #fafafa;
  border: 1px solid #ebeef5;
  border-radius: 12px;
}

.credentials h3 {
  margin: 0 0 8px;
  font-size: 16px;
}

.credentials-desc {
  margin: 0 0 12px;
  color: #666;
  line-height: 1.6;
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

.form-note {
  color: #666;
  line-height: 1.7;
}

.action-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.result-card {
  margin-top: 24px;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.markdown {
  line-height: 1.8;
  overflow-wrap: anywhere;
}

.markdown :deep(h1),
.markdown :deep(h2),
.markdown :deep(h3) {
  margin-top: 1.2em;
}

.markdown :deep(pre) {
  background: #f6f8fa;
  padding: 16px;
  overflow: auto;
  border-radius: 8px;
}

.markdown :deep(code) {
  background: #f6f8fa;
  padding: 2px 6px;
  border-radius: 4px;
}

@media (max-width: 768px) {
  .page {
    margin: 24px auto 36px;
    padding: 0 16px;
  }

  .framework-select {
    width: 100%;
  }

  .result-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
