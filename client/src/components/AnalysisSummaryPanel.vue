<template>
  <section v-if="structuredResult" class="analysis-summary">
    <div class="analysis-summary__intro">
      <span class="section-label">结构化结论</span>
      <p>{{ structuredResult.summary || "模型未输出本次 PR 的变更摘要。" }}</p>
    </div>

    <div class="analysis-summary__grid">
      <div class="summary-metric">
        <span class="section-label">错误风险</span>
        <strong :class="['risk-pill', `risk-pill--${structuredResult.errorRisk.level}`]">
          {{ structuredResult.errorRisk.label }}
        </strong>
      </div>

      <div class="summary-metric">
        <span class="section-label">性能风险</span>
        <strong :class="['risk-pill', `risk-pill--${structuredResult.performanceRisk.level}`]">
          {{ structuredResult.performanceRisk.label }}
        </strong>
      </div>

      <div class="summary-metric">
        <span class="section-label">整体风险</span>
        <strong :class="['risk-pill', `risk-pill--${structuredResult.overallRisk.level}`]">
          {{ structuredResult.overallRisk.label }}
        </strong>
      </div>

      <div class="summary-metric">
        <span class="section-label">合并建议</span>
        <strong :class="['decision-pill', `decision-pill--${structuredResult.mergeAdvice.decision}`]">
          {{ structuredResult.mergeAdvice.label }}
        </strong>
      </div>
    </div>

    <div
      v-if="structuredResult.verificationChecklist?.length"
      class="analysis-summary__checklist"
    >
      <span class="section-label">建议优先验证</span>

      <ul>
        <li
          v-for="(item, index) in structuredResult.verificationChecklist"
          :key="`${index}-${item}`"
        >
          {{ item }}
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup>
defineProps({
  structuredResult: {
    type: Object,
    default: null,
  },
});
</script>

<style scoped>
.analysis-summary {
  padding: 18px;
  border-radius: 22px;
  background: linear-gradient(180deg, #fff7ef 0%, #fffdf9 100%);
  border: 1px solid rgba(188, 120, 63, 0.18);
}

.analysis-summary__intro {
  margin-bottom: 18px;
}

.analysis-summary__intro p {
  color: #5f4c41;
  line-height: 1.75;
}

.analysis-summary__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.summary-metric {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(188, 120, 63, 0.12);
}

.analysis-summary__checklist {
  margin-top: 18px;
}

.analysis-summary__checklist ul {
  margin: 10px 0 0;
  padding-left: 18px;
  color: #5f4c41;
  line-height: 1.7;
}

.section-label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #a25d34;
}

.risk-pill,
.decision-pill {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
}

.risk-pill--high,
.decision-pill--block {
  color: #a61b1b;
  background: #ffe2e2;
}

.risk-pill--medium,
.decision-pill--verify_then_merge {
  color: #9a6700;
  background: #fff0cc;
}

.risk-pill--low,
.decision-pill--safe_to_merge {
  color: #0a6e31;
  background: #ddfbe6;
}

.risk-pill--unknown,
.decision-pill--unknown {
  color: #475467;
  background: #eef2f6;
}

@media (max-width: 768px) {
  .analysis-summary__grid {
    grid-template-columns: 1fr;
  }
}
</style>
