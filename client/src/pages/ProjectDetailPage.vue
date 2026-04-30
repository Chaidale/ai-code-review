<template>
  <section class="page-section">
    <div v-if="loading && !project" class="empty-state">
      正在加载项目详情...
    </div>

    <template v-else-if="project">
      <div class="project-hero">
        <div>
          <span class="section-eyebrow">Project</span>
          <h2>{{ project.name }}</h2>
          <p>{{ project.repository?.fullName || "未绑定仓库" }}</p>
        </div>

        <div class="project-hero__meta">
          <span>默认环境 {{ project.defaultEnvironment }}</span>
          <span>默认分析 {{ project.defaultAnalysisType }}</span>
          <span>{{ project.analysisCount }} 次分析</span>
        </div>
      </div>

      <div class="detail-grid">
        <el-card class="surface-card">
          <template #header>
            <div class="surface-card__header">
              <span>手动触发分析</span>
            </div>
          </template>

          <div class="analysis-form">
            <el-select v-model="analysisForm.type">
              <el-option label="PR + 监控分析" value="pr-monitoring" />
              <el-option label="GitHub PR Review" value="pr-review" />
            </el-select>

            <el-input
              v-model="analysisForm.prUrl"
              placeholder="请输入 GitHub PR 链接，例如：https://github.com/org/repo/pull/123"
              clearable
            />

            <div class="analysis-form__row">
              <el-input
                v-model="analysisForm.deepseekApiKey"
                type="password"
                show-password
                placeholder="DEEPSEEK_API_KEY"
                clearable
                autocomplete="off"
              />

              <el-input
                v-model="analysisForm.githubToken"
                type="password"
                show-password
                placeholder="GITHUB_TOKEN（选填）"
                clearable
                autocomplete="off"
              />
            </div>

            <el-switch
              v-if="analysisForm.type === 'pr-review'"
              v-model="analysisForm.publishReviewComment"
              active-text="分析后直接评论到 GitHub"
            />

            <template v-if="analysisForm.type === 'pr-monitoring'">
              <el-input
                v-model="analysisForm.sentryIssueUrl"
                placeholder="Sentry Issue URL（选填）"
                clearable
              />

              <el-input
                v-model="analysisForm.sentryAuthToken"
                type="password"
                show-password
                placeholder="SENTRY_AUTH_TOKEN（选填，用于自动抓取 issue）"
                clearable
                autocomplete="off"
              />

              <el-input
                v-model="analysisForm.sentryIssueSummary"
                type="textarea"
                :rows="6"
                placeholder="错误摘要，可补充影响范围、发布时间、怀疑链路等"
              />

              <el-input
                v-model="analysisForm.performanceSummary"
                type="textarea"
                :rows="6"
                placeholder="性能摘要，例如：LCP / 接口 p95 / 慢页面路径"
              />
            </template>

            <div class="analysis-form__actions">
              <el-button type="primary" :loading="submitLoading" @click="submitAnalysis">
                {{ analysisForm.type === "pr-review" ? "开始 PR Review" : "开始风险分析" }}
              </el-button>
            </div>
          </div>
        </el-card>

        <el-card class="surface-card">
          <template #header>
            <div class="surface-card__header">
              <span>项目信息</span>
            </div>
          </template>

          <div class="project-info">
            <div class="project-info__row">
              <span>仓库</span>
              <strong>{{ project.repository?.fullName || "未配置" }}</strong>
            </div>

            <div class="project-info__row">
              <span>默认分支</span>
              <strong>{{ project.defaultBranch }}</strong>
            </div>

            <div class="project-info__row">
              <span>默认环境</span>
              <strong>{{ project.defaultEnvironment }}</strong>
            </div>

            <div class="project-info__row">
              <span>最近分析</span>
              <strong>{{ formatDateTime(project.lastAnalysisAt) }}</strong>
            </div>
          </div>
        </el-card>
      </div>

      <el-card class="surface-card">
        <template #header>
          <div class="surface-card__header">
            <span>最近分析记录</span>
            <el-button text :loading="loading" @click="loadProjectData">
              刷新
            </el-button>
          </div>
        </template>

        <AnalysisRecordList
          :items="analyses"
          :show-project="false"
          empty-text="这个项目还没有分析记录。"
        />
      </el-card>
    </template>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { useRoute, useRouter } from "vue-router";
import AnalysisRecordList from "../components/AnalysisRecordList.vue";
import {
  createProjectAnalysis,
  getProject,
  getProjectAnalyses,
} from "../lib/api.js";
import { formatDateTime } from "../lib/formatters.js";
import { getRequestErrorMessage } from "../lib/request.js";

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const submitLoading = ref(false);
const project = ref(null);
const analyses = ref([]);
const analysisForm = reactive({
  type: "pr-monitoring",
  prUrl: "",
  deepseekApiKey: "",
  githubToken: "",
  publishReviewComment: false,
  sentryIssueUrl: "",
  sentryAuthToken: "",
  sentryIssueSummary: "",
  performanceSummary: "",
});

function getProjectId() {
  return typeof route.params.projectId === "string" ? route.params.projectId : "";
}

async function loadProjectData() {
  const projectId = getProjectId();

  if (!projectId) {
    return;
  }

  loading.value = true;

  try {
    const [projectData, analysesData] = await Promise.all([
      getProject(projectId),
      getProjectAnalyses(projectId, { limit: 8 }),
    ]);

    project.value = projectData?.project || null;
    analyses.value = Array.isArray(analysesData?.items) ? analysesData.items : [];
  } catch (error) {
    ElMessage.warning(getRequestErrorMessage(error, "加载项目详情失败"));
  } finally {
    loading.value = false;
  }
}

async function submitAnalysis() {
  const projectId = getProjectId();

  if (!projectId) {
    return;
  }

  if (!analysisForm.prUrl.trim() || !analysisForm.deepseekApiKey.trim()) {
    ElMessage.warning("请先填写 PR 链接和 DEEPSEEK_API_KEY");
    return;
  }

  if (
    analysisForm.type === "pr-monitoring"
    && !analysisForm.sentryIssueUrl.trim()
    && !analysisForm.sentryIssueSummary.trim()
    && !analysisForm.performanceSummary.trim()
  ) {
    ElMessage.warning("监控分析至少需要 Sentry URL、错误摘要或性能摘要中的一项");
    return;
  }

  submitLoading.value = true;

  try {
    const data = await createProjectAnalysis(projectId, analysisForm);
    const analysisId = data?.analysisId;

    ElMessage.success("分析任务已完成并保存");
    await loadProjectData();

    if (analysisId) {
      router.push(`/analyses/${analysisId}`);
    }
  } catch (error) {
    ElMessage.warning(getRequestErrorMessage(error, "提交分析任务失败"));
  } finally {
    submitLoading.value = false;
  }
}

watch(() => route.params.projectId, loadProjectData);
onMounted(loadProjectData);
</script>

<style scoped>
.page-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.empty-state {
  color: #7d6b60;
  line-height: 1.7;
}

.project-hero {
  padding: 22px 24px;
  border-radius: 26px;
  background: linear-gradient(135deg, rgba(255, 245, 235, 0.9) 0%, rgba(255, 253, 249, 0.92) 100%);
  border: 1px solid rgba(188, 120, 63, 0.16);
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
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

.project-hero h2 {
  margin: 0 0 8px;
}

.project-hero p {
  color: #6e5d52;
}

.project-hero__meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.project-hero__meta span {
  display: inline-flex;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(188, 120, 63, 0.12);
  color: #7a5b48;
  font-size: 14px;
  font-weight: 600;
}

.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(300px, 0.8fr);
  gap: 18px;
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
}

.analysis-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.analysis-form__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.analysis-form__actions {
  padding-top: 6px;
}

.project-info {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.project-info__row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.project-info__row span {
  color: #8a7467;
  font-size: 14px;
}

.project-info__row strong {
  color: #1a120d;
  line-height: 1.5;
}

@media (max-width: 960px) {
  .project-hero,
  .detail-grid,
  .analysis-form__row {
    grid-template-columns: 1fr;
  }

  .project-hero {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
