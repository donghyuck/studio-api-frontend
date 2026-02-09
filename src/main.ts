import { createApp, watch } from 'vue';
import App from './App.vue';
import router from '@/router';
import { vuetify, pinia } from './plugins';

import '@/scss/style.scss'; 
import 'highlight.js/styles/github.css';
import { PerfectScrollbarPlugin } from 'vue3-perfect-scrollbar';
import VueApexCharts from 'vue3-apexcharts';
import VueTablerIcons from 'vue-tabler-icons'; 
import Toast from '@/plugins/toast';
import Confirm from '@/plugins/confirm';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';

const app = createApp(App);

// AG Grid v35+ requires explicit module registration.
ModuleRegistry.registerModules([AllCommunityModule]);
function syncHtmlLangFromVuetify() {
  const locale = (vuetify as any)?.locale?.current?.value || 'ko';
  if (typeof document !== 'undefined') {
    document.documentElement.lang = String(locale);
  }
}

app.use(PerfectScrollbarPlugin);
app.use(VueTablerIcons);
app.use(VueApexCharts);
app.use(pinia);
app.use(vuetify);
syncHtmlLangFromVuetify();
watch((vuetify as any)?.locale?.current, () => syncHtmlLangFromVuetify());
app.use(Toast);
app.use(Confirm);

const bootstrap = async () => {
  app.use(router);
  await router.isReady();
  app.mount('#app');
};

bootstrap();
