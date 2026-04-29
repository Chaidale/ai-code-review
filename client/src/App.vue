<template>
  <div class="page">
    <h1>AI 前端代码 Review 工具</h1>
    <p class="desc">支持粘贴代码 Review，也支持 GitHub PR 自动 Review</p>

    <el-card>
      <div class="credentials">
        <h3>调用凭证</h3>
        <p class="credentials-desc">
          <code>DEEPSEEK_API_KEY</code> 为必填，<code>GITHUB_TOKEN</code> 可选，仅在需要更高 GitHub 权限或访问频率时填写。
        </p>

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
          style="margin-top: 12px"
        />
      </div>

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

          <div class="pr-actions">
            <el-button
              type="primary"
              :loading="loading"
              style="margin-top: 16px"
              @click="reviewPR"
            >
              分析 PR
            </el-button>

            <el-button
              :loading="loading"
              style="margin-top: 16px"
              @click="reviewPRAndComment"
            >
              AI 评论到 GitHub
            </el-button>
          </div>
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

const reviewCode = async () => {
  if (!ensureDeepseekApiKey()) {
    return;
  }

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
      deepseekApiKey: deepseekApiKey.value.trim(),
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
  await submitPullRequestReview();
};

const reviewPRAndComment = async () => {
  await submitPullRequestReview(true);
};

const submitPullRequestReview = async (publishReviewComment = false) => {
  if (!ensureDeepseekApiKey()) {
    return;
  }

  if (!prUrl.value.trim()) {
    ElMessage.warning("请先输入 GitHub PR 链接");
    return;
  }

  if (publishReviewComment && !githubToken.value.trim()) {
    ElMessage.warning("发布 GitHub PR 评论前，请先输入 GITHUB_TOKEN");
    return;
  }

  loading.value = true;
  result.value = "";

  try {
    const res = await axios.post("http://localhost:3001/api/review-pr", {
      prUrl: prUrl.value,
      deepseekApiKey: deepseekApiKey.value.trim(),
      githubToken: githubToken.value.trim(),
      publishReviewComment,
    });

    result.value = res.data.result;

    if (publishReviewComment && res.data.githubReviewPublished) {
      ElMessage.success("AI 评论已发布到 GitHub PR");
    }
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

.credentials {
  margin-bottom: 20px;
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

.pr-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
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
