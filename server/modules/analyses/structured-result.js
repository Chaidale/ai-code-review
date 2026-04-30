const RISK_LABELS = {
  high: "高可能",
  medium: "中等可能",
  low: "低可能",
  unknown: "信息不足",
};

const OVERALL_RISK_LABELS = {
  high: "高",
  medium: "中",
  low: "低",
  unknown: "未识别",
};

const MERGE_ADVICE_LABELS = {
  block: "不建议合并",
  verify_then_merge: "建议补充验证后再合并",
  safe_to_merge: "可以合并",
  unknown: "未识别",
};

export const STRUCTURED_ANALYSIS_RESULT_SCHEMA = Object.freeze({
  type: "pr-monitoring",
  summary: "string",
  errorRisk: {
    level: "high|medium|low|unknown",
    label: "string",
    summary: "string",
  },
  performanceRisk: {
    level: "high|medium|low|unknown",
    label: "string",
    summary: "string",
  },
  overallRisk: {
    level: "high|medium|low|unknown",
    label: "string",
    summary: "string",
  },
  mergeAdvice: {
    decision: "block|verify_then_merge|safe_to_merge|unknown",
    label: "string",
    summary: "string",
  },
  verificationChecklist: ["string"],
  sections: {},
});

function normalizeTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function normalizeRiskBlock(rawValue, fallbackLevel, labels) {
  const value = normalizeObject(rawValue);
  const level = normalizeTrimmedString(value?.level) || fallbackLevel || "unknown";

  return {
    level,
    label: normalizeTrimmedString(value?.label) || labels[level] || labels.unknown,
    summary: normalizeTrimmedString(value?.summary),
  };
}

function normalizeMergeAdvice(rawValue, fallbackDecision) {
  const value = normalizeObject(rawValue);
  const decision = normalizeTrimmedString(value?.decision) || fallbackDecision || "unknown";

  return {
    decision,
    label: normalizeTrimmedString(value?.label) || MERGE_ADVICE_LABELS[decision] || MERGE_ADVICE_LABELS.unknown,
    summary: normalizeTrimmedString(value?.summary),
  };
}

export function normalizeStructuredResult(rawResult, fallbacks = {}) {
  const value = normalizeObject(rawResult);
  const fallbackOverallRisk = normalizeTrimmedString(fallbacks.overallRisk);
  const fallbackErrorRisk = normalizeTrimmedString(fallbacks.errorRisk);
  const fallbackPerformanceRisk = normalizeTrimmedString(fallbacks.performanceRisk);
  const fallbackMergeAdvice = normalizeTrimmedString(fallbacks.mergeAdvice);

  if (!value && !fallbackOverallRisk && !fallbackErrorRisk && !fallbackPerformanceRisk && !fallbackMergeAdvice) {
    return null;
  }

  return {
    type: normalizeTrimmedString(value?.type) || "pr-monitoring",
    summary: normalizeTrimmedString(value?.summary),
    errorRisk: normalizeRiskBlock(value?.errorRisk, fallbackErrorRisk || "unknown", RISK_LABELS),
    performanceRisk: normalizeRiskBlock(
      value?.performanceRisk,
      fallbackPerformanceRisk || "unknown",
      RISK_LABELS,
    ),
    overallRisk: normalizeRiskBlock(value?.overallRisk, fallbackOverallRisk || "unknown", OVERALL_RISK_LABELS),
    mergeAdvice: normalizeMergeAdvice(value?.mergeAdvice, fallbackMergeAdvice || "unknown"),
    verificationChecklist: Array.isArray(value?.verificationChecklist)
      ? value.verificationChecklist.map((item) => normalizeTrimmedString(item)).filter(Boolean)
      : [],
    sections: normalizeObject(value?.sections) || {},
  };
}
