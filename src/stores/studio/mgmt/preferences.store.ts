import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

const AUTO_REFRESH_KEY = 'auto_refresh_token';
const AUTO_REFRESH_WINDOW_KEY = 'auto_refresh_window_sec';
const THEME_MODE_KEY = 'theme_mode';

export type ThemeMode = 'light' | 'dark' | 'system';

export const usePreferencesStore = defineStore('preferences', () => {
  const autoRefreshEnabled = ref(localStorage.getItem(AUTO_REFRESH_KEY) === 'true');
  const raw = localStorage.getItem(AUTO_REFRESH_WINDOW_KEY);
  const parsed = raw ? Number(raw) : NaN;
  const autoRefreshWindowSec = ref<number>(
    Number.isFinite(parsed) && parsed > 0 ? parsed : 10 * 60
  );

  const themeRaw = localStorage.getItem(THEME_MODE_KEY) as ThemeMode | null;
  const themeMode = ref<ThemeMode>(
    themeRaw === 'light' || themeRaw === 'dark' || themeRaw === 'system' ? themeRaw : 'system'
  );

  watch(autoRefreshEnabled, (val) => {
    localStorage.setItem(AUTO_REFRESH_KEY, val ? 'true' : 'false');
  });

  watch(autoRefreshWindowSec, (val) => {
    const next = Number(val);
    if (Number.isFinite(next) && next > 0) {
      localStorage.setItem(AUTO_REFRESH_WINDOW_KEY, String(next));
    }
  });

  watch(themeMode, (val) => {
    localStorage.setItem(THEME_MODE_KEY, val);
  });

  return {
    autoRefreshEnabled,
    autoRefreshWindowSec,
    themeMode,
  };
});
