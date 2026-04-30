<template>
  <section class="page-section">
    <div class="section-header">
      <div>
        <span class="section-eyebrow">Analyses</span>
        <h2>全局分析记录</h2>
        <p>这里展示已经沉淀进 PostgreSQL 的 PR 分析历史，适合作为后续 Dashboard 和协作视图的基础。</p>
      </div>

      <div class="section-actions">
        <el-select v-model="typeFilter" @change="loadAnalyses">
          <el-option label="全部类型" value="" />
          <el-option label="PR + 监控分析" value="pr-monitoring" />
          <el-option label="GitHub PR Review" value="pr-review" />
        </el-select>

        <el-button text :loading="loading" @click="loadAnalyses">
          刷新
        </el-button>
      </div>
    </div>

    <el-card class="surface-card">
      <AnalysisRecordList
        :items="analyses"
        empty-text="还没有分析记录，先去项目页发起一次分析。"
      />
    </el-card>
  </section>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import AnalysisRecordList from "../components/AnalysisRecordList.vue";
import { getAnalyses } from "../lib/api.js";
import { getRequestErrorMessage } from "../lib/request.js";

const loading = ref(false);
const typeFilter = ref("");
const analyses = ref([]);

async function loadAnalyses() {
  loading.value = true;

  try {
    const data = await getAnalyses({
      limit: 24,
      type: typeFilter.value,
    });
    analyses.value = Array.isArray(data?.items) ? data.items : [];
  } catch (error) {
    ElMessage.warning(getRequestErrorMessage(error, "加载分析记录失败"));
  } finally {
    loading.value = false;
  }
}

onMounted(loadAnalyses);
</script>

<style scoped>
.page-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
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

.section-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.surface-card {
  border: none;
  border-radius: 24px;
  box-shadow: 0 24px 40px rgba(106, 83, 64, 0.08);
}

@media (max-width: 860px) {
  .section-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .section-actions {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
