import { createApp } from 'vue';
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

const app = createApp(App);
app.use(router);
app.use(PerfectScrollbarPlugin);
app.use(VueTablerIcons);
app.use(VueApexCharts);
app.use(pinia);
app.use(vuetify);
app.use(Toast);
app.use(Confirm);
app.mount('#app');
