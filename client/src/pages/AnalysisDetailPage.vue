<template>
  <section class="page-section">
    <div v-if="loading && !analysis" class="empty-state">
      正在加载分析详情...
    </div>

    <template v-else-if="analysis">
      <div class="detail-hero">
        <div>
          <span class="section-eyebrow">{{ formatAnalysisType(analysis.type) }}</span>
          <h2>{{ analysis.title }}</h2>
          <p>
            <RouterLink
              v-if="analysis.project?.id"
              class="hero-link"
              :to="`/projects/${analysis.project.id}`"
            >
              {{ analysis.project.name }}
            </RouterLink>
            <span v-if="analysis.pr?.url">
              ·
              <a class="hero-link" :href="analysis.pr.url" target="_blank" rel="noreferrer">
                查看 PR
              </a>
            </span>
          </p>
        </div>

        <div class="detail-hero__meta">
          <span>{{ formatDateTime(analysis.createdAt) }}</span>
          <span v-if="analysis.structuredResult?.overallRisk">
            风险 {{ analysis.structuredResult.overallRisk.label }}
          </span>
          <span v-if="analysis.structuredResult?.mergeAdvice">
            {{ analysis.structuredResult.mergeAdvice.label }}
          </span>
        </div>
      </div>

      <AnalysisSummaryPanel :structured-result="analysis.structuredResult" />

      <div class="detail-grid">
        <el-card class="surface-card">
          <template #header>
            <div class="surface-card__header">
              <span>分析上下文</span>
            </div>
          </template>

          <div class="context-list">
            <div class="context-row">
              <span>项目</span>
              <strong>{{ analysis.project?.name || "未绑定" }}</strong>
            </div>

            <div class="context-row">
              <span>仓库</span>
              <strong>{{ analysis.project?.repository?.fullName || "未知" }}</strong>
            </div>

            <div class="context-row">
              <span>PR</span>
              <strong>{{ analysis.pr?.owner && analysis.pr?.repo ? `${analysis.pr.owner}/${analysis.pr.repo}#${analysis.pr.prNumber}` : "无" }}</strong>
            </div>

            <div class="context-row">
              <span>错误摘要</span>
              <strong>{{ analysis.inputs?.sentryIssueSummary || "未提供" }}</strong>
            </div>

            <div class="context-row">
              <span>性能摘要</span>
              <strong>{{ analysis.inputs?.performanceSummary || "未提供" }}</strong>
            </div>
          </div>
        </el-card>

        <el-card class="surface-card">
          <template #header>
            <div class="surface-card__header">
              <span>输入线索</span>
            </div>
          </template>

          <div class="context-copy">
            <p v-if="analysis.inputs?.prUrl">
              <strong>PR URL：</strong>{{ analysis.inputs.prUrl }}
            </p>

            <p v-if="analysis.inputs?.sentryIssueUrl">
              <strong>Sentry URL：</strong>{{ analysis.inputs.sentryIssueUrl }}
            </p>

            <p v-if="analysis.source?.sentryIssueFetched">
              <strong>自动抓取：</strong>已从 Sentry 拉取最新 issue 摘要。
            </p>

            <p v-if="analysis.source?.sentryIssueFetchWarning">
              <strong>抓取告警：</strong>{{ analysis.source.sentryIssueFetchWarning }}
            </p>

            <p v-if="!analysis.inputs?.prUrl && !analysis.inputs?.sentryIssueUrl">
              这次分析没有额外的外部输入线索。
            </p>
          </div>
        </el-card>
      </div>

      <el-card class="surface-card">
        <template #header>
          <div class="surface-card__header">
            <span>Markdown 结果</span>
          </div>
        </template>

        <div class="markdown" v-html="htmlResult"></div>
      </el-card>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import MarkdownIt from "markdown-it";
import { ElMessage } from "element-plus";
import { RouterLink, useRoute } from "vue-router";
import AnalysisSummaryPanel from "../components/AnalysisSummaryPanel.vue";
import { getAnalysisDetail } from "../lib/api.js";
import { formatAnalysisType, formatDateTime } from "../lib/formatters.js";
import { getRequestErrorMessage } from "../lib/request.js";

const md = new MarkdownIt();
const route = useRoute();

const loading = ref(false);
const analysis = ref(null);

const htmlResult = computed(() => md.render(analysis.value?.resultMarkdown || ""));

function getAnalysisId() {
  return typeof route.params.analysisId === "string" ? route.params.analysisId : "";
}

async function loadAnalysis() {
  const analysisId = getAnalysisId();

  if (!analysisId) {
    return;
  }

  loading.value = true;

  try {
    const data = await getAnalysisDetail(analysisId);
    analysis.value = data?.analysis || null;
  } catch (error) {
    ElMessage.warning(getRequestErrorMessage(error, "加载分析详情失败"));
  } finally {
    loading.value = false;
  }
}

watch(() => route.params.analysisId, loadAnalysis);
onMounted(loadAnalysis);
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

.detail-hero {
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

.detail-hero h2 {
  margin: 0 0 8px;
}

.detail-hero p {
  color: #6e5d52;
}

.hero-link {
  color: #8f4f28;
  text-decoration: none;
}

.detail-hero__meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.detail-hero__meta span {
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
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

.context-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.context-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.context-row span {
  color: #8a7467;
  font-size: 14px;
}

.context-row strong {
  color: #1a120d;
  line-height: 1.6;
}

.context-copy {
  color: #5f4c41;
  line-height: 1.75;
}

.context-copy p + p {
  margin-top: 12px;
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

@media (max-width: 960px) {
  .detail-hero,
  .detail-grid {
    grid-template-columns: 1fr;
  }

  .detail-hero {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
