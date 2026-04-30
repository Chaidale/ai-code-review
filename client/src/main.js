import { createApp } from "vue";
import App from "./App.vue";

import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import { initBrowserSentry, loadPublicRuntimeConfig } from "./lib/sentry.js";
import router from "./router/index.js";

async function bootstrap() {
  const app = createApp(App);

  app.use(ElementPlus);
  app.use(router);

  const publicConfig = await loadPublicRuntimeConfig();
  initBrowserSentry(app, publicConfig?.sentry);

  app.mount("#app");
}

bootstrap();
