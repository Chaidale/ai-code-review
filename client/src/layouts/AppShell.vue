<template>
  <div class="shell">
    <aside class="shell-sidebar">
      <RouterLink class="brand" to="/projects">
        <span class="brand-mark">RP</span>
        <div>
          <strong>Risk Prism</strong>
          <p>PR 风险分析平台原型</p>
        </div>
      </RouterLink>

      <nav class="shell-nav">
        <RouterLink to="/projects">项目管理</RouterLink>
        <RouterLink to="/analyses">分析记录</RouterLink>
        <RouterLink to="/workbench">调试工作台</RouterLink>
      </nav>

      <div class="sidebar-note">
        <span class="sidebar-note__label">当前迭代</span>
        <p>PostgreSQL 持久化、项目维度分析记录、多页面工作流。</p>
      </div>
    </aside>

    <main class="shell-main">
      <header class="shell-main__header">
        <div>
          <span class="eyebrow">Commercial V1</span>
          <h1>{{ currentTitle }}</h1>
        </div>

        <p class="shell-main__copy">
          先把分析记录沉淀成项目资产，再逐步接 GitHub 与 Sentry 的项目级集成。
        </p>
      </header>

      <div class="shell-main__content">
        <RouterView />
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";

const route = useRoute();

const currentTitle = computed(() => route.meta?.title || "Risk Prism");
</script>

<style scoped>
.shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
}

.shell-sidebar {
  position: sticky;
  top: 0;
  min-height: 100vh;
  padding: 32px 24px;
  border-right: 1px solid rgba(37, 35, 32, 0.08);
  background:
    linear-gradient(180deg, rgba(245, 236, 218, 0.92) 0%, rgba(255, 251, 244, 0.96) 100%);
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 14px;
  color: inherit;
  text-decoration: none;
}

.brand-mark {
  width: 52px;
  height: 52px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #bb5f2f 0%, #523017 100%);
  box-shadow: 0 18px 32px rgba(82, 48, 23, 0.22);
}

.brand strong {
  display: block;
  font-size: 22px;
  color: #1a120d;
}

.brand p {
  margin-top: 4px;
  color: #735f51;
  line-height: 1.5;
}

.shell-nav {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.shell-nav a {
  padding: 12px 14px;
  border-radius: 16px;
  color: #5f4c41;
  text-decoration: none;
  font-weight: 600;
  transition: transform 0.18s ease, background-color 0.18s ease, color 0.18s ease;
}

.shell-nav a:hover {
  transform: translateX(2px);
  background: rgba(82, 48, 23, 0.08);
  color: #1a120d;
}

.shell-nav a.router-link-active {
  color: #fff;
  background: linear-gradient(135deg, #8f4f28 0%, #3e2617 100%);
  box-shadow: 0 16px 30px rgba(62, 38, 23, 0.18);
}

.sidebar-note {
  margin-top: auto;
  padding: 18px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.64);
  border: 1px solid rgba(82, 48, 23, 0.1);
}

.sidebar-note__label {
  display: inline-flex;
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #9a5b34;
}

.sidebar-note p {
  color: #5f4c41;
  line-height: 1.7;
}

.shell-main {
  min-width: 0;
  padding: 36px 34px 48px;
}

.shell-main__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 28px;
}

.eyebrow {
  display: inline-flex;
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #9a5b34;
}

.shell-main__header h1 {
  margin: 0;
  font-size: clamp(32px, 4vw, 46px);
}

.shell-main__copy {
  max-width: 420px;
  color: #6e5d52;
  line-height: 1.7;
}

.shell-main__content {
  min-width: 0;
}

@media (max-width: 1080px) {
  .shell {
    grid-template-columns: 1fr;
  }

  .shell-sidebar {
    position: static;
    min-height: auto;
    border-right: none;
    border-bottom: 1px solid rgba(37, 35, 32, 0.08);
  }

  .shell-main {
    padding: 26px 18px 36px;
  }

  .shell-main__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
