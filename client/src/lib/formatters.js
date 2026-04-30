export function formatDateTime(value) {
  if (!value) {
    return "未知时间";
  }

  try {
    return new Intl.DateTimeFormat("zh-CN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function formatAnalysisType(type) {
  if (type === "pr-monitoring") {
    return "PR + 监控分析";
  }

  if (type === "pr-review") {
    return "GitHub PR Review";
  }

  if (type === "code-review") {
    return "代码 Review";
  }

  return type || "未知类型";
}
