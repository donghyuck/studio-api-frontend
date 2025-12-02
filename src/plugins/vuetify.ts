import { createVuetify } from "vuetify";
import "@mdi/font/css/materialdesignicons.css";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import { BlueTheme } from "@/theme/LightTheme";
import { ko, en } from "vuetify/locale";

export default createVuetify({
  locale: {
    locale: "ko", // 기본 언어
    fallback: "en",
    messages: { ko, en }, // ko 메시지 로드
  },
  components,
  directives,
  theme: {
    defaultTheme: "BlueTheme",
    themes: {
      BlueTheme,
    },
  },
  defaults: {
    VBtn: {},
    VCard: {
      rounded: "md",
    },
    VTextField: {
      rounded: "lg",
    },
    VTooltip: {
      // set v-tooltip default location to top
      location: "top",
    },
  },
});
