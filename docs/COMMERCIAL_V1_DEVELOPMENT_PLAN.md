# 商业化 V1 开发清单

## 1. 产品目标

### V1 定位

把当前的 AI Code Review 工具升级为一个可落地的 `PR 风险分析平台`，核心目标是：

```text
GitHub PR diff
  ↓
AI Review + 风险判断
  ↓
结合 Sentry / 性能数据
  ↓
输出风险等级、合并建议、验证清单
  ↓
回写 GitHub / 保存分析历史 / 支持团队协作
```

### V1 核心价值

- 在 PR 合并前提前发现可能导致线上异常或性能回退的改动
- 为研发、测试、前端负责人提供统一的风险判断入口
- 让 PR 分析从“临时工具”升级为“可复用、可追踪、可接入流程”的产品能力

### V1 成功标准

- 支持项目级配置 GitHub 与 Sentry 集成
- 支持手动或自动触发 PR 风险分析
- 支持结构化输出分析结果，而不只是 Markdown 文本
- 支持查看分析历史、风险等级、关键证据和合并建议
- 支持把分析结果回写到 GitHub PR

---

## 2. 功能模块

### 2.1 账号与组织

- [ ] 用户登录
- [ ] 组织创建与切换
- [ ] 组织成员管理
- [ ] 基础角色权限控制（管理员 / 普通成员）

### 2.2 项目管理

- [x] 创建项目
- [x] 绑定 GitHub 仓库
- [x] 配置默认环境（dev / staging / prod）
- [x] 配置默认分析策略

### 2.3 GitHub 集成

- [ ] 支持 GitHub App 或 OAuth 集成
- [ ] 支持选择组织和仓库
- [ ] 支持读取 PR diff
- [ ] 支持 webhook 自动触发 PR 分析
- [ ] 支持回写 PR comment
- [ ] 支持回写 GitHub Check / Status

### 2.4 Sentry 集成

- [ ] 配置 Sentry org / project / token
- [ ] 支持 Sentry Issue URL 自动抓取
- [ ] 支持 latest event 摘要抓取
- [ ] 支持 environment 维度区分
- [ ] 支持将错误摘要合并进分析上下文

### 2.5 性能数据集成

- [ ] 保留手工输入性能摘要能力
- [ ] 支持项目级性能数据源配置
- [ ] V1 优先接入 Sentry Performance 或统一性能摘要接口
- [ ] 为后续 Datadog / New Relic 接入预留统一数据结构

### 2.6 PR 风险分析

- [ ] 拉取 PR diff
- [ ] 分析 PR 改动概览
- [ ] 结合错误上下文判断异常风险
- [ ] 结合性能摘要判断性能风险
- [x] 输出结构化风险等级与合并建议
- [x] 输出建议验证清单

### 2.7 分析历史与协作

- [x] 保存分析记录
- [x] 查看历史分析结果
- [ ] 支持重新分析
- [ ] 支持人工确认风险结论
- [ ] 支持添加备注

### 2.8 审计与用量

- [ ] 记录关键操作日志
- [ ] 记录分析调用次数
- [ ] 记录模型消耗与请求成本

---

## 3. 页面结构

### 3.1 登录页

- [ ] 邮箱登录或 GitHub 登录
- [ ] 登录后跳转工作台

### 3.2 工作台 Dashboard

- [ ] 展示最近分析的 PR
- [ ] 展示高风险 PR 数量
- [ ] 展示最近失败的集成任务
- [ ] 展示风险等级分布

### 3.3 项目列表页

- [x] 项目名称
- [x] 绑定仓库
- [ ] 环境数量
- [ ] GitHub / Sentry / 性能集成状态
- [x] 最近一次分析时间

### 3.4 项目详情页

- [x] 项目基础信息
- [x] 仓库信息
- [ ] 默认规则与策略
- [x] 最近分析记录
- [ ] 环境配置

### 3.5 集成配置页

- [ ] GitHub 配置
- [ ] Sentry 配置
- [ ] 性能平台配置
- [ ] Token 连通性检测

### 3.6 PR 分析详情页

- [x] PR 基本信息
- [x] AI 风险分析结果
- [x] 风险等级
- [x] 合并建议
- [ ] 关键证据文件
- [ ] Sentry 事件摘要
- [x] 性能指标摘要
- [x] 建议验证项
- [ ] 人工确认区

### 3.7 规则与策略页

- [ ] 风险阈值配置
- [ ] 自动评论开关
- [ ] 自动阻断合并开关
- [ ] 通知策略

### 3.8 审计与用量页

- [ ] 操作审计日志
- [ ] 分析次数统计
- [ ] 模型调用量统计
- [ ] 失败请求统计

---

## 4. 后端接口设计

### 4.1 认证与用户

- [ ] `POST /api/v1/auth/login`
- [ ] `POST /api/v1/auth/logout`
- [ ] `GET /api/v1/me`

### 4.2 组织与项目

- [ ] `GET /api/v1/organizations`
- [ ] `POST /api/v1/organizations`
- [x] `GET /api/v1/projects`
- [x] `POST /api/v1/projects`
- [x] `GET /api/v1/projects/:projectId`
- [ ] `PATCH /api/v1/projects/:projectId`

### 4.3 集成配置

- [ ] `POST /api/v1/projects/:projectId/integrations/github`
- [ ] `POST /api/v1/projects/:projectId/integrations/sentry`
- [ ] `POST /api/v1/projects/:projectId/integrations/performance`
- [ ] `POST /api/v1/projects/:projectId/integrations/:type/test`

### 4.4 分析任务

- [x] `GET /api/v1/analyses`
- [x] `POST /api/v1/projects/:projectId/analyses`
- [x] `GET /api/v1/projects/:projectId/analyses`
- [x] `GET /api/v1/analyses/:analysisId`
- [ ] `POST /api/v1/analyses/:analysisId/retry`
- [ ] `POST /api/v1/analyses/:analysisId/decision`

### 4.5 Webhook

- [ ] `POST /api/v1/webhooks/github`
- [ ] `POST /api/v1/webhooks/sentry`

### 4.6 保留现有调试入口

- [x] 保留 `/api/review`
- [x] 保留 `/api/review-pr`
- [x] 保留 `/api/review-pr-monitoring`
- [ ] 将现有接口逐步迁移为内部服务能力

### 4.7 分析结果结构化返回

- [x] Markdown 文本输出
- [x] JSON 结构化输出
- [ ] 保留原始 prompt / 原始模型输出用于调试

建议的返回结构：

```json
{
  "summary": "PR 改了什么",
  "errorRisk": "high|medium|low|unknown",
  "performanceRisk": "high|medium|low|unknown",
  "overallRisk": "high|medium|low",
  "mergeAdvice": "block|verify_then_merge|safe_to_merge",
  "evidenceFiles": [],
  "verificationChecklist": [],
  "rawMarkdown": "..."
}
```

---

## 5. 数据表设计

建议 V1 使用 PostgreSQL。

### 5.1 用户与组织

- [ ] `users`
- [ ] `organizations`
- [ ] `organization_members`

建议字段：

- `users`: `id`, `email`, `name`, `avatar_url`, `created_at`
- `organizations`: `id`, `name`, `slug`, `created_at`
- `organization_members`: `id`, `organization_id`, `user_id`, `role`, `created_at`

### 5.2 项目与仓库

- [x] `projects`
- [ ] `repositories`
- [ ] `project_environments`

建议字段：

- `projects`: `id`, `organization_id`, `name`, `slug`, `repository_id`, `default_branch`, `status`, `created_at`
- `repositories`: `id`, `provider`, `owner`, `name`, `external_id`, `default_branch`, `created_at`
- `project_environments`: `id`, `project_id`, `name`, `sentry_environment`, `is_default`, `created_at`

### 5.3 集成配置

- [ ] `integration_connections`
- [ ] `integration_secrets`

建议字段：

- `integration_connections`: `id`, `project_id`, `type`, `status`, `config_json`, `created_at`, `updated_at`
- `integration_secrets`: `id`, `integration_connection_id`, `secret_key`, `encrypted_value`, `created_at`

### 5.4 PR 与分析任务

- [x] `pull_requests`
- [x] `analysis_runs`
- [x] `analysis_inputs`
- [x] `analysis_results`
- [ ] `analysis_findings`

建议字段：

- `pull_requests`: `id`, `project_id`, `repository_id`, `pr_number`, `title`, `author`, `head_sha`, `base_sha`, `status`, `created_at`
- `analysis_runs`: `id`, `project_id`, `pull_request_id`, `trigger_source`, `status`, `started_at`, `finished_at`, `error_message`
- `analysis_inputs`: `id`, `analysis_run_id`, `diff_snapshot`, `sentry_summary`, `performance_summary`, `input_json`
- `analysis_results`: `id`, `analysis_run_id`, `overall_risk`, `error_risk`, `performance_risk`, `merge_advice`, `summary_markdown`, `result_json`
- `analysis_findings`: `id`, `analysis_run_id`, `type`, `severity`, `title`, `description`, `evidence_json`

### 5.5 人工决策与审计

- [ ] `merge_decisions`
- [ ] `audit_logs`
- [ ] `usage_records`

建议字段：

- `merge_decisions`: `id`, `analysis_run_id`, `decision`, `comment`, `decided_by`, `created_at`
- `audit_logs`: `id`, `organization_id`, `user_id`, `action`, `target_type`, `target_id`, `detail_json`, `created_at`
- `usage_records`: `id`, `organization_id`, `project_id`, `analysis_run_id`, `model_name`, `request_tokens`, `response_tokens`, `estimated_cost`, `created_at`

---

## 6. GitHub / Sentry / 性能平台集成方式

### 6.1 GitHub 集成

#### V1 目标

- [ ] 不再依赖用户每次手填 `GITHUB_TOKEN`
- [ ] 支持项目级绑定仓库
- [ ] 支持 PR 自动触发分析
- [ ] 支持回写 comment 和 check

#### 接入方式

- [ ] 优先采用 `GitHub App`
- [ ] 通过 webhook 监听 `pull_request`、`pull_request_review`、`push`
- [ ] 通过 GitHub API 获取 PR diff、PR 基本信息、变更文件
- [ ] 分析完成后回写 comment 与 check run

#### V1 交付标准

- [ ] 新建项目时能选择 GitHub 仓库
- [ ] PR 打开或更新时可自动触发分析
- [ ] GitHub PR 页面可看到风险评论与风险状态

### 6.2 Sentry 集成

#### V1 目标

- [ ] 支持项目级配置 Sentry org / project / token
- [ ] 支持通过 Issue URL 拉取错误上下文
- [ ] 支持 latest event 摘要
- [ ] 支持 environment 映射

#### 接入方式

- [ ] 存储 Sentry 配置到项目级集成表
- [ ] 基于现有 `server/lib/sentry.js` 升级为项目级服务
- [ ] 支持手动输入 URL 和自动拉取 issue 摘要
- [ ] 为后续 release 自动关联预留字段

#### V1 交付标准

- [ ] 一个项目可保存自己的 Sentry 配置
- [ ] 分析时无需反复输入 Sentry token
- [ ] PR 风险详情页能展示错误摘要与关键事件信息

### 6.3 性能平台集成

#### V1 目标

- [ ] 先保留手工性能摘要
- [ ] 再统一抽象性能数据结构
- [ ] 优先接入 Sentry Performance 或一个统一性能输入层

#### 推荐统一结构

- [ ] `metric_name`
- [ ] `scope`
- [ ] `baseline`
- [ ] `current`
- [ ] `delta`
- [ ] `environment`
- [ ] `time_window`

#### V1 交付标准

- [ ] 分析任务可同时接收错误上下文和性能上下文
- [ ] 结构化结果里单独输出性能风险等级

---

## 7. 迭代优先级

### P0：把当前工具升级为可保存、可追踪的产品原型

- [x] 引入 PostgreSQL
- [x] 增加项目模型
- [x] 增加分析记录持久化
- [x] 增加结构化输出 JSON
- [x] 增加分析历史列表页
- [x] 增加分析详情页

### P1：接入真实研发工作流

- [ ] 接入 GitHub App
- [ ] 实现 PR webhook 自动触发
- [ ] 实现项目级 Sentry 配置
- [ ] 回写 GitHub comment
- [ ] 回写 GitHub check

### P2：增强风险判断可信度

- [ ] 增加规则引擎
- [ ] 增加证据链展示
- [ ] 增加建议验证清单
- [ ] 增加人工确认与备注
- [ ] 接入自动化性能数据源

### P3：补齐商业化基础设施

- [ ] 增加 RBAC
- [ ] 增加审计日志
- [ ] 增加用量统计
- [ ] 增加通知中心
- [ ] 增加套餐与额度设计
- [ ] 增加企业级密钥管理

---

## 8. 推荐实施顺序

### 第一阶段：先把“分析结果可沉淀”做出来

- [x] 增加数据库与 ORM
- [x] 定义 `projects / analysis_runs / analysis_results`
- [x] 改造当前 `/api/review-pr-monitoring`，支持结构化输出
- [x] 新增分析历史页和详情页

### 第二阶段：把“人工触发工具”升级成“项目能力”

- [x] 新增项目管理页
- [ ] 新增项目级 GitHub / Sentry 配置
- [x] 支持分析记录与项目绑定
- [ ] 支持一键重新分析

### 第三阶段：打通 GitHub 自动流程

- [ ] 接入 GitHub App
- [ ] 接入 webhook
- [ ] 自动拉取 PR diff
- [ ] 自动回写评论
- [ ] 自动回写风险状态

### 第四阶段：打通监控上下文自动化

- [ ] 从手工输入 Sentry URL 升级为项目级默认配置
- [ ] 优化错误上下文摘要
- [ ] 接入性能平台数据源
- [ ] 把错误风险与性能风险统一输出

### 第五阶段：补齐商业化能力

- [ ] 用户体系
- [ ] 组织与权限
- [ ] 审计能力
- [ ] 用量与成本统计
- [ ] 套餐设计

---

## 9. 第一批可以直接开工的任务

### 后端

- [x] 选型数据库与 ORM
- [x] 新增 `server/modules/projects`
- [x] 新增 `server/modules/analyses`
- [x] 把分析结果存入数据库
- [x] 定义结构化分析结果 schema

### 前端

- [x] 从单页 tab 升级为多页面路由结构
- [x] 新增项目列表页
- [x] 新增分析历史页
- [x] 新增分析详情页
- [ ] 新增集成配置页

### 产品与交互

- [ ] 确定风险等级标准
- [ ] 确定合并建议文案标准
- [ ] 确定详情页信息分区
- [ ] 确定 Dashboard 的核心指标

### 集成与平台

- [ ] 申请 GitHub App
- [ ] 设计 webhook 验签机制
- [ ] 设计 Sentry 项目级配置模型
- [ ] 设计性能数据统一结构

---

## 10. 备注

- 当前仓库已经具备 `PR Review`、`PR + 监控分析`、`Sentry Issue URL 自动抓取` 的基础能力
- 本文档目标不是重写现有能力，而是在现有基础上做产品化升级
- 当前最优先的不是继续堆 prompt，而是补齐 `项目模型 + 持久化 + 结构化结果 + GitHub 工作流接入`
- 当前 P0 的分析记录持久化已替换为 `PostgreSQL + ORM`
- 当前已从现有单页升级为独立页面路由结构，项目与分析历史已可分别访问
