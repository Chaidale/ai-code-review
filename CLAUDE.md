# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

AI 前端代码 Review 工具，monorepo 结构，包含 Express 后端服务和 Vue 3 前端界面。通过 DeepSeek API 对前端代码进行 Code Review，同时支持分析 GitHub Pull Request、将 AI 评论发布到 PR 下，以及结合错误/性能摘要做 PR 风险分析；监控分析现已支持直接粘贴 Sentry Issue URL 自动抓取 issue 与最新事件摘要。项目本身也已接入 Sentry SDK：前端通过 `@sentry/vue` 上报浏览器异常与回放，后端通过 `@sentry/node` 采集 Express 异常与 traces。

## 常用命令

**后端 (server/)**
```bash
cd server && npm run dev      # nodemon 热重载开发
cd server && npm start        # 生产启动
```

**前端 (client/)**
```bash
cd client && npm run dev      # Vite 开发服务器
cd client && npm run build    # 生产构建
cd client && npm run preview  # 预览构建产物
```

**Docker**
```bash
docker compose up --build
```

## 技术栈

- **后端**: Express 5 + OpenAI SDK (指向 DeepSeek API) + dotenv
- **前端**: Vue 3 (script setup) + Vite 8 + Element Plus + Axios + markdown-it
- **AI 模型**: 默认 `deepseek-v4-flash`，支持 `deepseek-v4-pro` 等

## 后端架构

### 入口 → 路由 → 服务 → AI

```
index.js (Express app)
  ├── POST /api/review       → reviewCode()
  ├── POST /api/review-pr    → reviewPullRequest()
  └── POST /api/review-pr-monitoring → reviewPullRequestMonitoring()
```

### 关键文件

- [server/config.js](server/config.js) — 所有环境变量在此集中验证并导出，20+ 配置项（PORT、DEEPSEEK_MODEL、各种 max tokens、PR diff 长度限制等）
- [server/lib/ai.js](server/lib/ai.js) — 封装 DeepSeek API 调用（通过 OpenAI SDK + `baseURL: "https://api.deepseek.com"`），支持 thinking 模式，按 apiKey 缓存 client 实例
- [server/lib/diff.js](server/lib/diff.js) — GitHub PR diff 获取、解析、按文件拆分、行边界截断；也包含 `publishPullRequestComment` 发布评论到 GitHub
- [server/lib/sentry.js](server/lib/sentry.js) — Sentry Issue URL 解析、Issue / latest event 获取与摘要拼装
- [server/lib/sentry-sdk.js](server/lib/sentry-sdk.js) — Sentry SDK 初始化、Express 错误处理中间件和浏览器公共运行时配置下发
- [server/lib/prompts.js](server/lib/prompts.js) — 所有 AI prompt 模板（code review、PR review、PR monitoring、GitHub comment），均要求 Markdown 输出
- [server/lib/errors.js](server/lib/errors.js) — 自定义 `HttpError` 类，`toErrorResponse()` 根据 `exposeError` 控制是否向客户端暴露错误详情
- [server/lib/async.js](server/lib/async.js) — Express async handler 包装器 + 并发映射工具 `mapWithConcurrency`
- [server/services/review-service.js](server/services/review-service.js) — 业务编排：参数校验 → 获取 PR diff → 拆分文件 → 调用 AI → 可选发布 GitHub 评论 / 监控关联分析

### 调用链

1. `reviewPullRequest` / `reviewPullRequestMonitoring` 从 GitHub API 获取 PR diff（Accept: `application/vnd.github.v3.diff`）
2. `splitDiffByFile` 按 `diff --git ` 分割，过滤二进制文件，按配置截断
3. `buildPullRequestReviewPrompt` 生成 PR review；`buildPullRequestMonitoringPrompt` 生成 PR 与错误/性能摘要的关联分析
4. 如果提供 `Sentry Issue URL`，后端会调用 Sentry API 拉取 issue 与 latest event 摘要，再和手工补充说明合并
5. 如果 `publishReviewComment=true`，再调用 AI 生成精简版评论，然后 POST 到 GitHub Issues API 发布评论
6. `/api/public-config` 会把浏览器端可公开的 Sentry 配置下发给前端，前端启动时再初始化 `@sentry/vue`

## 前端架构

单页面应用，入口 [client/src/App.vue](client/src/App.vue)，三个 tab：
- **代码 Review**：选择框架 → 粘贴代码 → 调用 `/api/review`
- **GitHub PR Review**：输入 PR 链接 → "分析 PR" 调用 `/api/review-pr`（`publishReviewComment=false`），"AI 评论到 GitHub" 调用 `/api/review-pr`（`publishReviewComment=true`）
- **PR + 监控分析**：输入 PR 链接 + `Sentry Issue URL` / 错误摘要 / 性能摘要 → 调用 `/api/review-pr-monitoring`

开发环境通过 Vite 代理 `/api` 到后端；Docker 生产镜像中由 Nginx 反向代理 `/api` 到 `server:3001`。前端 Sentry 配置不再依赖构建时注入，而是启动后从 `/api/public-config` 动态读取。

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DEEPSEEK_API_KEY` | 无（必填） | DeepSeek API 密钥 |
| `GITHUB_TOKEN` | 空 | 分析私有仓库 PR 或发布评论时需要 |
| `SENTRY_AUTH_TOKEN` | 空 | 使用 Sentry Issue URL 自动抓取 issue 与 latest event 时需要 |
| `SENTRY_DSN` | 空 | 后端 Sentry DSN；如果 `SENTRY_BROWSER_DSN` 未设置，前端默认也复用它 |
| `SENTRY_BROWSER_DSN` | 空 | 可选，前端单独使用的浏览器 Sentry DSN |
| `SENTRY_ENVIRONMENT` | `development` | Sentry environment |
| `SENTRY_RELEASE` | 空 | 可选；留空时服务启动会自动推导为 `ai-code-review@<git-sha>` |
| `SENTRY_TRACES_SAMPLE_RATE` | `0.1` | 后端 traces 采样率 |
| `SENTRY_BROWSER_TRACES_SAMPLE_RATE` | 跟随后端 | 前端 traces 采样率 |
| `SENTRY_REPLAYS_SESSION_SAMPLE_RATE` | `0` | 前端 Session Replay 常规采样率 |
| `SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE` | `1` | 前端发生错误时的 Replay 采样率 |
| `PORT` | 3001 | 后端服务端口 |
| `DEEPSEEK_MODEL` | `deepseek-v4-flash` | DeepSeek 模型 |
| `AI_TIMEOUT_MS` | 30000 | AI 调用超时 |
| `SENTRY_TIMEOUT_MS` | 15000 | Sentry API 调用超时 |
| `MAX_PR_FILES` | 4 | 单次 PR 最多分析文件数 |
| `MAX_TOTAL_DIFF_CHARS` | 24000 | PR diff 总字符上限 |

完整配置见 [server/config.js](server/config.js)。
