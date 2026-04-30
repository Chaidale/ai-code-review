<template>
  <section class="page-section">
    <div class="section-header">
      <div>
        <span class="section-eyebrow">Projects</span>
        <h2>把分析记录挂到真实项目上</h2>
        <p>
          先为仓库创建项目，再从项目页发起 PR 分析，后面的 GitHub/Sentry 配置也会以项目为边界继续扩展。
        </p>
      </div>

      <el-button type="primary" @click="createDialogVisible = true">
        新建项目
      </el-button>
    </div>

    <div class="project-overview">
      <div class="overview-metric">
        <span>项目数</span>
        <strong>{{ projects.length }}</strong>
      </div>

      <div class="overview-metric">
        <span>已绑定仓库</span>
        <strong>{{ boundRepositoryCount }}</strong>
      </div>

      <div class="overview-metric">
        <span>最近有分析的项目</span>
        <strong>{{ activeProjectCount }}</strong>
      </div>
    </div>

    <el-card class="surface-card">
      <template #header>
        <div class="surface-card__header">
          <span>项目列表</span>
          <el-button text :loading="loading" @click="loadProjects">
            刷新
          </el-button>
        </div>
      </template>

      <div v-if="loading && !projects.length" class="empty-state">
        正在加载项目...
      </div>

      <div v-else-if="!projects.length" class="empty-state">
        还没有项目，先创建第一个仓库绑定吧。
      </div>

      <div v-else class="project-grid">
        <button
          v-for="project in projects"
          :key="project.id"
          type="button"
          class="project-card"
          @click="openProject(project.id)"
        >
          <div class="project-card__top">
            <span class="project-card__badge">{{ project.repository?.provider || "github" }}</span>
            <span class="project-card__time">
              {{ project.lastAnalysisAt ? `最近分析：${formatDateTime(project.lastAnalysisAt)}` : "暂无分析" }}
            </span>
          </div>

          <div class="project-card__title">{{ project.name }}</div>
          <div class="project-card__repo">{{ project.repository?.fullName || "未绑定仓库" }}</div>

          <div class="project-card__stats">
            <span>默认环境 {{ project.defaultEnvironment }}</span>
            <span>{{ project.analysisCount }} 次分析</span>
          </div>
        </button>
      </div>
    </el-card>

    <el-dialog
      v-model="createDialogVisible"
      title="新建项目"
      width="560px"
      destroy-on-close
    >
      <div class="project-form">
        <el-input
          v-model="projectForm.name"
          placeholder="项目名称，例如：Checkout Web"
          clearable
        />

        <div class="project-form__row">
          <el-input
            v-model="projectForm.repositoryOwner"
            placeholder="GitHub owner，例如：openai"
            clearable
          />

          <el-input
            v-model="projectForm.repositoryName"
            placeholder="GitHub repo，例如：ai-code-review"
            clearable
          />
        </div>

        <div class="project-form__row">
          <el-input
            v-model="projectForm.defaultBranch"
            placeholder="默认分支，例如：main"
            clearable
          />

          <el-input
            v-model="projectForm.defaultEnvironment"
            placeholder="默认环境，例如：prod"
            clearable
          />
        </div>

        <el-select v-model="projectForm.defaultAnalysisType">
          <el-option label="PR + 监控分析" value="pr-monitoring" />
          <el-option label="GitHub PR Review" value="pr-review" />
        </el-select>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="createDialogVisible = false">
            取消
          </el-button>
          <el-button type="primary" :loading="createLoading" @click="submitProject">
            创建并进入项目
          </el-button>
        </div>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { createProject, getProjects } from "../lib/api.js";
import { formatDateTime } from "../lib/formatters.js";
import { getRequestErrorMessage } from "../lib/request.js";

const router = useRouter();

const loading = ref(false);
const createLoading = ref(false);
const createDialogVisible = ref(false);
const projects = ref([]);
const projectForm = reactive({
  name: "",
  repositoryOwner: "",
  repositoryName: "",
  defaultBranch: "main",
  defaultEnvironment: "prod",
  defaultAnalysisType: "pr-monitoring",
});

const boundRepositoryCount = computed(() => projects.value.filter((project) => project.repository?.fullName).length);
const activeProjectCount = computed(() => projects.value.filter((project) => project.lastAnalysisAt).length);

function resetProjectForm() {
  projectForm.name = "";
  projectForm.repositoryOwner = "";
  projectForm.repositoryName = "";
  projectForm.defaultBranch = "main";
  projectForm.defaultEnvironment = "prod";
  projectForm.defaultAnalysisType = "pr-monitoring";
}

async function loadProjects() {
  loading.value = true;

  try {
    const data = await getProjects({ limit: 50 });
    projects.value = Array.isArray(data?.items) ? data.items : [];
  } catch (error) {
    ElMessage.warning(getRequestErrorMessage(error, "加载项目失败"));
  } finally {
    loading.value = false;
  }
}

function openProject(projectId) {
  router.push(`/projects/${projectId}`);
}

async function submitProject() {
  if (!projectForm.name.trim() || !projectForm.repositoryOwner.trim() || !projectForm.repositoryName.trim()) {
    ElMessage.warning("请先填写项目名称和 GitHub 仓库信息");
    return;
  }

  createLoading.value = true;

  try {
    const data = await createProject(projectForm);
    const projectId = data?.project?.id;

    createDialogVisible.value = false;
    resetProjectForm();
    await loadProjects();

    if (projectId) {
      router.push(`/projects/${projectId}`);
    }
  } catch (error) {
    ElMessage.warning(getRequestErrorMessage(error, "创建项目失败"));
  } finally {
    createLoading.value = false;
  }
}

onMounted(loadProjects);
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

.project-overview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.overview-metric {
  padding: 18px;
  border-radius: 20px;
  background: linear-gradient(180deg, #fff8f1 0%, #fffdfb 100%);
  border: 1px solid rgba(188, 120, 63, 0.14);
}

.overview-metric span {
  display: block;
  color: #8a7467;
  margin-bottom: 6px;
}

.overview-metric strong {
  font-size: 30px;
  color: #1a120d;
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

.empty-state {
  color: #7d6b60;
  line-height: 1.7;
}

.project-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.project-card {
  padding: 18px;
  border-radius: 22px;
  border: 1px solid rgba(37, 35, 32, 0.08);
  background: rgba(255, 255, 255, 0.92);
  text-align: left;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.project-card:hover {
  transform: translateY(-2px);
  border-color: rgba(188, 120, 63, 0.28);
  box-shadow: 0 22px 34px rgba(120, 83, 50, 0.1);
}

.project-card__top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.project-card__badge {
  display: inline-flex;
  padding: 4px 10px;
  border-radius: 999px;
  background: #f4e8de;
  color: #9a5b34;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

.project-card__time {
  color: #8a7467;
  font-size: 13px;
}

.project-card__title {
  font-size: 20px;
  font-weight: 700;
  color: #1a120d;
}

.project-card__repo {
  margin-top: 8px;
  color: #6e5d52;
  line-height: 1.6;
}

.project-card__stats {
  margin-top: 14px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  color: #8a7467;
  font-size: 14px;
}

.project-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.project-form__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

@media (max-width: 860px) {
  .section-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .project-overview,
  .project-grid,
  .project-form__row {
    grid-template-columns: 1fr;
  }
}
</style>
