function normalizeTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function splitMarkdownSections(markdown) {
  const lines = typeof markdown === "string" ? markdown.split(/\r?\n/) : [];
  const sections = {};
  let currentTitle = null;
  let currentLines = [];

  function flushCurrentSection() {
    if (!currentTitle) {
      return;
    }

    sections[currentTitle] = currentLines.join("\n").trim();
  }

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+?)\s*$/);

    if (headingMatch) {
      flushCurrentSection();
      currentTitle = headingMatch[1].trim();
      currentLines = [];
      continue;
    }

    if (currentTitle) {
      currentLines.push(line);
    }
  }

  flushCurrentSection();

  return sections;
}

function getFirstMeaningfulLine(content) {
  return normalizeTrimmedString(
    typeof content === "string"
      ? content.split(/\r?\n/).find((line) => normalizeTrimmedString(line))
      : "",
  );
}

function extractMarkdownBulletLines(content) {
  return typeof content === "string"
    ? content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line))
      .map((line) => line.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "").trim())
      .filter(Boolean)
    : [];
}

function parseMappedLabel(content, options, fallbackValue, fallbackLabel) {
  const firstLine = getFirstMeaningfulLine(content);

  for (const option of options) {
    if (firstLine.startsWith(option.label)) {
      return {
        value: option.value,
        label: option.label,
        firstLine,
      };
    }
  }

  return {
    value: fallbackValue,
    label: fallbackLabel,
    firstLine,
  };
}

function buildRiskSummary(content, options, fallbackValue, fallbackLabel) {
  const mapped = parseMappedLabel(content, options, fallbackValue, fallbackLabel);

  return {
    level: mapped.value,
    label: mapped.label,
    summary: normalizeTrimmedString(content),
  };
}

export function buildMonitoringStructuredResult(markdown) {
  const sections = splitMarkdownSections(markdown);
  const summary = normalizeTrimmedString(sections["PR 改了什么"]);
  const errorRisk = buildRiskSummary(
    sections["是否可能引发该错误"],
    [
      { label: "高可能", value: "high" },
      { label: "中等可能", value: "medium" },
      { label: "低可能", value: "low" },
      { label: "信息不足", value: "unknown" },
    ],
    "unknown",
    "信息不足",
  );
  const performanceRisk = buildRiskSummary(
    sections["是否可能影响性能"],
    [
      { label: "高可能", value: "high" },
      { label: "中等可能", value: "medium" },
      { label: "低可能", value: "low" },
      { label: "信息不足", value: "unknown" },
    ],
    "unknown",
    "信息不足",
  );
  const overallRisk = buildRiskSummary(
    sections["风险等级"],
    [
      { label: "高", value: "high" },
      { label: "中", value: "medium" },
      { label: "低", value: "low" },
    ],
    "unknown",
    "未识别",
  );
  const mergeAdviceMatch = parseMappedLabel(
    sections["是否建议合并"],
    [
      { label: "不建议合并", value: "block" },
      { label: "建议补充验证后再合并", value: "verify_then_merge" },
      { label: "可以合并", value: "safe_to_merge" },
    ],
    "unknown",
    "未识别",
  );

  return {
    type: "pr-monitoring",
    summary,
    errorRisk,
    performanceRisk,
    overallRisk,
    mergeAdvice: {
      decision: mergeAdviceMatch.value,
      label: mergeAdviceMatch.label,
      summary: normalizeTrimmedString(sections["是否建议合并"]),
    },
    verificationChecklist: Array.from(new Set([
      ...extractMarkdownBulletLines(sections["是否可能引发该错误"]),
      ...extractMarkdownBulletLines(sections["是否可能影响性能"]),
      ...extractMarkdownBulletLines(sections["是否建议合并"]),
    ])).slice(0, 8),
    sections,
  };
}
