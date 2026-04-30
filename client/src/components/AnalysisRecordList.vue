<template>
  <div v-if="!items.length" class="analysis-list__empty">
    {{ emptyText }}
  </div>

  <div v-else class="analysis-list">
    <RouterLink
      v-for="item in items"
      :key="item.id"
      :to="`/analyses/${item.id}`"
      :class="['analysis-card', { 'analysis-card--active': item.id === activeId }]"
    >
      <div class="analysis-card__top">
        <span class="analysis-card__type">{{ formatAnalysisType(item.type) }}</span>

        <span
          v-if="item.overallRisk"
          :class="['risk-pill', `risk-pill--${item.overallRisk.level}`]"
        >
          {{ item.overallRisk.label }}
        </span>
      </div>

      <div class="analysis-card__title">{{ item.title }}</div>

      <div class="analysis-card__meta">
        <span v-if="showProject && item.project?.name">{{ item.project.name }}</span>
        <span>{{ formatDateTime(item.createdAt) }}</span>
      </div>

      <p v-if="item.summary" class="analysis-card__summary">
        {{ item.summary }}
      </p>
    </RouterLink>
  </div>
</template>

<script setup>
import { RouterLink } from "vue-router";
import { formatAnalysisType, formatDateTime } from "../lib/formatters.js";

defineProps({
  items: {
    type: Array,
    default: () => [],
  },
  emptyText: {
    type: String,
    default: "暂无数据",
  },
  activeId: {
    type: String,
    default: "",
  },
  showProject: {
    type: Boolean,
    default: true,
  },
});
</script>

<style scoped>
.analysis-list {
  display: grid;
  gap: 12px;
}

.analysis-list__empty {
  color: #7d6b60;
  line-height: 1.7;
}

.analysis-card {
  display: block;
  padding: 16px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(37, 35, 32, 0.08);
  color: inherit;
  text-decoration: none;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.analysis-card:hover {
  transform: translateY(-2px);
  border-color: rgba(188, 120, 63, 0.3);
  box-shadow: 0 20px 28px rgba(120, 83, 50, 0.08);
}

.analysis-card--active {
  border-color: rgba(188, 120, 63, 0.42);
  box-shadow: 0 20px 30px rgba(120, 83, 50, 0.12);
}

.analysis-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.analysis-card__type {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #a25d34;
}

.analysis-card__title {
  font-weight: 700;
  color: #1a120d;
  line-height: 1.55;
}

.analysis-card__meta {
  margin-top: 8px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  color: #8a7467;
  font-size: 14px;
}

.analysis-card__summary {
  margin-top: 10px;
  color: #5f4c41;
  line-height: 1.65;
}

.risk-pill {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.risk-pill--high {
  color: #a61b1b;
  background: #ffe2e2;
}

.risk-pill--medium {
  color: #9a6700;
  background: #fff0cc;
}

.risk-pill--low {
  color: #0a6e31;
  background: #ddfbe6;
}

.risk-pill--unknown {
  color: #475467;
  background: #eef2f6;
}
</style>
