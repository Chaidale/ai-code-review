<template>
  <div class="page">
    <h1>AI 前端代码 Review 工具</h1>
    <p class="desc">支持粘贴代码 Review，也支持 GitHub PR 自动 Review</p>

    <el-card>
      <el-tabs v-model="activeTab">
        <el-tab-pane label="代码 Review" name="code">
          <el-select
            v-model="framework"
            style="width: 180px; margin-bottom: 16px"
          >
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

          <el-button
            type="primary"
            :loading="loading"
            style="margin-top: 16px"
            @click="reviewCode"
          >
            开始 AI Review
          </el-button>
        </el-tab-pane>

        <el-tab-pane label="GitHub PR Review" name="pr">
          <el-input
            v-model="prUrl"
            placeholder="请输入 GitHub PR 链接，例如：https://github.com/user/repo/pull/123"
            clearable
          />

          <el-button
            type="primary"
            :loading="loading"
            style="margin-top: 16px"
            @click="reviewPR"
          >
            分析 PR
          </el-button>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-card v-if="result" style="margin-top: 24px">
      <template #header>
        <div class="result-header">
          <span>Review 结果</span>
          <el-button size="small" @click="copyResult">复制结果</el-button>
        </div>
      </template>

      <div class="markdown" v-html="htmlResult"></div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import axios from "axios";
import MarkdownIt from "markdown-it";
import { ElMessage } from "element-plus";

const md = new MarkdownIt();

const activeTab = ref("code");
const framework = ref("Vue");
const code = ref("");
const prUrl = ref("");
const result = ref("");
const loading = ref(false);

const htmlResult = computed(() => md.render(result.value));

const test = "hello ai review";

console.log("debug");

const reviewCode = async () => {
  if (!code.value.trim()) {
    ElMessage.warning("请先输入代码");
    return;
  }

  loading.value = true;
  result.value = "";

  try {
    const res = await axios.post("http://localhost:3001/api/review", {
      code: code.value,
      framework: framework.value,
    });

    result.value = res.data.result;
  } catch (err) {
    result.value =
      err.response?.data?.error ||
      err.response?.data?.message ||
      "Review 失败，请检查后端服务、DeepSeek Key 或网络。";
  } finally {
    loading.value = false;
  }
};

const reviewPR = async () => {
  if (!prUrl.value.trim()) {
    ElMessage.warning("请先输入 GitHub PR 链接");
    return;
  }

  loading.value = true;
  result.value = "";

  try {
    const res = await axios.post("http://localhost:3001/api/review-pr", {
      prUrl: prUrl.value,
    });

    result.value = res.data.result;
  } catch (err) {
    result.value =
      err.response?.data?.error ||
      err.response?.data?.message ||
      "PR Review 失败，请检查 PR 链接、GitHub 权限或后端服务。";
  } finally {
    loading.value = false;
  }
};

const copyResult = async () => {
  await navigator.clipboard.writeText(result.value);
  ElMessage.success("已复制");
};
</script>

<style scoped>
.page {
  max-width: 1100px;
  margin: 40px auto;
  padding: 0 20px;
}

h1 {
  margin-bottom: 8px;
  text-align: center;
}

.desc {
  text-align: center;
  color: #666;
  margin-bottom: 24px;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.markdown {
  line-height: 1.8;
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
</style>