import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

async function askAI(prompt) {
  const response = await openai.chat.completions.create({
    model: "deepseek-chat",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.3,
  });

  return response.choices[0].message.content;
}

function splitDiffByFile(diff) {
  return diff
    .split(/^diff --git /gm)
    .filter(Boolean)
    .map((item) => `diff --git ${item}`);
}

app.post("/api/review", async (req, res) => {
  try {
    const { code, framework = "Vue" } = req.body;

    if (!code) {
      return res.status(400).json({
        message: "code 不能为空",
      });
    }

    const prompt = `
你是一名资深前端架构师，请对下面 ${framework} 代码进行 Code Review。

请从以下角度分析：
1. 代码规范
2. 潜在 Bug
3. 性能问题
4. 可维护性
5. 前端最佳实践
6. 可优化建议

请使用 Markdown 输出。

代码如下：

\`\`\`${framework}
${code}
\`\`\`
`;

    const result = await askAI(prompt);

    res.json({ result });
  } catch (error) {
    console.error("代码 Review 失败：", error);

    res.status(500).json({
      message: "代码 Review 失败",
      error: error.message,
    });
  }
});

app.post("/api/review-pr", async (req, res) => {
  try {
    const { prUrl } = req.body;

    if (!prUrl) {
      return res.status(400).json({
        message: "PR 链接不能为空",
      });
    }

    const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);

    if (!match) {
      return res.status(400).json({
        message: "PR 链接格式不正确，例如：https://github.com/user/repo/pull/123",
      });
    }

    const [, owner, repo, prNumber] = match;

    const diffUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;

    const headers = {
      Accept: "application/vnd.github.v3.diff",
      "User-Agent": "ai-code-review",
    };

    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const diffRes = await fetch(diffUrl, { headers });

    if (!diffRes.ok) {
      return res.status(diffRes.status).json({
        message: "获取 GitHub PR diff 失败",
        status: diffRes.status,
      });
    }

    let diff = await diffRes.text();

    if (!diff) {
      return res.status(400).json({
        message: "该 PR 没有可分析的 diff",
      });
    }

    if (diff.length > 80000) {
      diff = diff.slice(0, 80000);
    }

    const files = splitDiffByFile(diff);

    let finalResult = `# GitHub PR Code Review 结果\n\n`;
    finalResult += `本次 PR 共修改 **${files.length}** 个文件。\n\n`;

    const maxFiles = 8;

    for (let i = 0; i < Math.min(files.length, maxFiles); i++) {
      const fileDiff = files[i];

      const fileNameMatch = fileDiff.match(/\+\+\+ b\/(.+)/);
      const fileName = fileNameMatch ? fileNameMatch[1] : `第 ${i + 1} 个文件`;

      const prompt = `
你是一名资深前端架构师，请对下面这个文件的 GitHub diff 做 Code Review。

文件名：${fileName}

请重点关注：
1. 这个文件修改了什么
2. 是否可能引入 Bug
3. 是否有性能问题
4. 是否有可维护性问题
5. 是否符合 Vue / React / TypeScript / JavaScript 最佳实践
6. 给出具体修改建议
7. 最后给出该文件风险等级：低 / 中 / 高

请使用 Markdown 输出。

文件 diff 如下：

\`\`\`diff
${fileDiff}
\`\`\`
`;

      const review = await askAI(prompt);

      finalResult += `---\n\n`;
      finalResult += `## ${i + 1}. ${fileName}\n\n`;
      finalResult += review;
      finalResult += `\n\n`;
    }

    if (files.length > maxFiles) {
      finalResult += `---\n\n`;
      finalResult += `> 注意：本次 PR 修改文件较多，仅分析了前 ${maxFiles} 个文件。\n`;
    }

    res.json({
      result: finalResult,
      fileCount: files.length,
      analyzedFileCount: Math.min(files.length, maxFiles),
      diffLength: diff.length,
    });
  } catch (error) {
    console.error("PR Review 失败：", error);

    res.status(500).json({
      message: "PR Review 失败",
      error: error.message,
    });
  }
});

app.listen(process.env.PORT || 3001, () => {
  console.log(`Server running on http://localhost:${process.env.PORT || 3001}`);
});