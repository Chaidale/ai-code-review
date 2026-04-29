function wrapCodeBlock(language, content) {
  return `\`\`\`${language}\n${content}\n\`\`\``;
}

export function buildCodeReviewPrompt({ framework, code }) {
  return `
你是一名资深工程师，请快速审查下面 ${framework} 代码。

只保留最重要、最值得立即修改的问题。

请使用简洁 Markdown 输出，并严格按以下结构：
## 结论
## 关键问题
## 修改建议

要求：
- 最多列出 3 个问题
- 如果没有明显问题，明确写“未发现明显问题”
- 重点关注 Bug、性能和可维护性
- 控制篇幅，不要展开成长文

代码如下：

${wrapCodeBlock(framework, code)}
`;
}

export function buildFileReviewPrompt({ fileName, fileDiff }) {
  return `
你正在审查一个 GitHub PR 中的单个文件 diff。请在准确、具体的前提下尽量简洁。

文件名：${fileName}

请重点关注：
1. 这个文件修改了什么
2. 是否可能引入 Bug
3. 是否有性能问题
4. 是否有可维护性问题
5. 是否符合 Vue / React / TypeScript / JavaScript 最佳实践
6. 哪些点需要跨文件继续核对

请使用 Markdown 输出，并严格按以下结构：
## 变更摘要
## 主要风险
## 性能与可维护性
## 跨文件关注点
## 风险等级

要求：
- 如果某部分未发现明显问题，明确写“未发现明显问题”
- 不要编造项目中未出现的上下文
- 给出尽量可执行的修改建议

文件 diff 如下：

${wrapCodeBlock("diff", fileDiff)}
`;
}

export function buildCrossFileReviewPrompt({
  owner,
  repo,
  prNumber,
  fileReviews,
}) {
  const contextBlocks = fileReviews
    .map(({ fileName, contextDiff, review }) => `
### ${fileName}

文件 diff 摘要：
${wrapCodeBlock("diff", contextDiff)}

文件级分析：
${review}
`)
    .join("\n");

  return `
你正在审查同一个 GitHub PR 的多个文件，请只从“跨文件上下文”角度补充 review，不要机械重复单文件已经说过的话。

PR：${owner}/${repo}#${prNumber}

请重点寻找：
1. 接口、类型、数据结构、字段语义是否在多个文件之间保持一致
2. 调用链、状态流、事件流、异步流程是否有联动断裂
3. import/export、配置、路由、权限、缓存、埋点等是否有遗漏同步
4. 是否存在只有结合多个文件才能看出的 Bug、性能问题或回归风险
5. 合并前最值得验证的跨文件场景

请使用 Markdown 输出，并严格按以下结构：
## 跨文件总评
## 高风险联动问题
## 需要重点验证的场景
## 合并前建议

要求：
- 如果没有发现明确的跨文件风险，也要明确说明“未发现明显的跨文件联动问题”
- 只根据提供的内容推断，不要虚构未给出的文件
- 优先给出最可能影响真实运行结果的问题

以下是本次 PR 的多文件上下文：

${contextBlocks}
`;
}

export function buildPullRequestReviewPrompt({
  owner,
  repo,
  prNumber,
  files,
}) {
  const fileBlocks = files
    .map(({ fileName, diff }) => `## ${fileName}\n\n${wrapCodeBlock("diff", diff)}`)
    .join("\n\n");

  return `
你正在审查一个 GitHub Pull Request，请基于多个文件的 diff 直接给出一份完整、简洁、可执行的 PR Review。

PR：${owner}/${repo}#${prNumber}

请重点关注：
1. 这次 PR 的整体改动目的
2. 可能引入的关键 Bug 或回归风险
3. 跨文件联动问题
4. 重要的性能和可维护性问题
5. 合并前最值得验证的场景

请使用 Markdown 输出，并严格按以下结构：
## 总体结论
## 高风险问题
## 重点文件观察
## 合并前建议

要求：
- 如果没有明确阻塞问题，也要清楚说明
- 结论尽量具体，避免空泛表述
- 优先指出最影响真实运行结果的问题
- 控制篇幅，适合直接在产品界面中阅读

以下是本次 PR 的 diff：

${fileBlocks}
`;
}

export function buildGitHubReviewCommentPrompt({
  owner,
  repo,
  prNumber,
  reviewResult,
}) {
  return `
你要把 AI Code Review 结果整理成一条适合直接发布到 GitHub Pull Request 的 review 评论。

PR：${owner}/${repo}#${prNumber}

请输出一条简洁、专业、可执行的 Markdown 评论，要求：
1. 适合直接发在 GitHub PR 下
2. 不要重复过多细节，不要过长
3. 优先给出总体判断、最重要的风险、合并前建议
4. 如果没有明显阻塞问题，要明确说明
5. 不要输出代码块

请严格按以下结构输出：
## 总体结论
## 主要问题
## 合并前建议

以下是已有分析结果：

${reviewResult}
`;
}
