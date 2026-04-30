import { createRouter, createWebHistory } from "vue-router";
import AnalysesPage from "../pages/AnalysesPage.vue";
import AnalysisDetailPage from "../pages/AnalysisDetailPage.vue";
import ProjectDetailPage from "../pages/ProjectDetailPage.vue";
import ProjectsPage from "../pages/ProjectsPage.vue";
import WorkbenchPage from "../pages/WorkbenchPage.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      redirect: "/projects",
    },
    {
      path: "/projects",
      name: "projects",
      component: ProjectsPage,
      meta: {
        title: "项目管理",
      },
    },
    {
      path: "/projects/:projectId",
      name: "project-detail",
      component: ProjectDetailPage,
      meta: {
        title: "项目详情",
      },
    },
    {
      path: "/analyses",
      name: "analyses",
      component: AnalysesPage,
      meta: {
        title: "分析记录",
      },
    },
    {
      path: "/analyses/:analysisId",
      name: "analysis-detail",
      component: AnalysisDetailPage,
      meta: {
        title: "分析详情",
      },
    },
    {
      path: "/workbench",
      name: "workbench",
      component: WorkbenchPage,
      meta: {
        title: "调试工作台",
      },
    },
  ],
});

export default router;
