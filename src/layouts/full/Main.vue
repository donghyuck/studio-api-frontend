<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, computed, shallowRef, watch } from 'vue';
import { useDisplay, useTheme } from "vuetify";
import sidebarItems from './vertical-sidebar/sidebarItem';
import NavGroup from './vertical-sidebar/NavGroup/index.vue';
import NavItem from './vertical-sidebar/NavItem/index.vue';
import Logo from './logo/Logo.vue';
// Icon Imports
import { Menu2Icon } from 'vue-tabler-icons';
// dropdown imports
import NotificationDD from './vertical-header/NotificationDD.vue';
import ProfileDD from './vertical-header/ProfileDD.vue';
import NavCollapse from './vertical-sidebar/NavCollapse/NavCollapse.vue';

//auth store import
import { useAuthStore } from '@/stores/studio/mgmt/auth.store';
import { usePreferencesStore, type ThemeMode } from '@/stores/studio/mgmt/preferences.store';
import { useRouter } from 'vue-router';

const auth = useAuthStore();
const prefs = usePreferencesStore();
const theme = useTheme();

const themeModeItems: Array<{ title: string; value: ThemeMode }> = [
  { title: '시스템', value: 'system' },
  { title: '라이트', value: 'light' },
  { title: '다크', value: 'dark' },
];

const themeMode = computed<ThemeMode>({
  get: () => prefs.themeMode,
  set: (val) => { prefs.themeMode = val; },
});

const isSystemDark = ref(false);
let systemThemeMedia: MediaQueryList | null = null;
let systemThemeListener: ((e: MediaQueryListEvent) => void) | null = null;

function applyTheme(mode: ThemeMode) {
  const next = mode === 'system'
    ? (isSystemDark.value ? 'dark' : 'light')
    : (mode === 'dark' ? 'dark' : 'light');
  theme.global.name.value = next;
}

// ✅ 현재 사용자 권한
const userRoles = computed(() => auth.user?.roles || []);
// ✅ 권한 기반 필터링 함수
function hasAccess(item: any) {
  if (!item.roles || item.roles.length === 0) return true;
  return item.roles.some((role: string) => userRoles.value.includes(role));
}

function filterSidebarItems(items: any) {
  return items
    .map((item: any) => {
      const hasRole = hasAccess(item);
      if (item.children) {
        const filteredChildren = filterSidebarItems(item.children);
        if (filteredChildren.length > 0 || hasRole) {
          return {
            ...item,
            children: filteredChildren
          };
        }
        return null; // 부모도 접근 불가, 자식도 없음 → 제거
      }

      return hasRole ? item : null;
    })
    .filter(Boolean);
}
const filteredItems = computed(() => filterSidebarItems(sidebarItems));
const sidebarMenu = shallowRef(sidebarItems);

const { mdAndDown } = useDisplay();
const sDrawer = ref(true);
const isScrolled = ref(false);
let scrollListener: (() => void) | null = null;
onMounted(() => {
  sDrawer.value = !mdAndDown.value; // hide on mobile, show on desktop
  const updateScroll = () => {
    isScrolled.value = window.scrollY > 4;
  };
  updateScroll();
  scrollListener = () => updateScroll();
  window.addEventListener('scroll', scrollListener, { passive: true });

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    systemThemeMedia = window.matchMedia('(prefers-color-scheme: dark)');
    isSystemDark.value = systemThemeMedia.matches;
    systemThemeListener = (e: MediaQueryListEvent) => {
      isSystemDark.value = e.matches;
      if (themeMode.value === 'system') {
        applyTheme('system');
      }
    };
    systemThemeMedia.addEventListener('change', systemThemeListener);
  }

  applyTheme(themeMode.value);
});
watch(mdAndDown, (val) => {
  sDrawer.value = !val;
});
watch(themeMode, (mode) => {
  applyTheme(mode);
});
onBeforeUnmount(() => {
  if (scrollListener) {
    window.removeEventListener('scroll', scrollListener);
  }
  if (systemThemeMedia && systemThemeListener) {
    systemThemeMedia.removeEventListener('change', systemThemeListener);
  }
});
const router = useRouter();
const goLogin = async () => {
    router.push({ name: 'Login' })
}
</script>
<template>
  <!------Sidebar-------->
  <v-navigation-drawer left elevation="0" app class="leftSidebar" :width="270" v-model="sDrawer">
    <!---Logo part -->
    <div class="pa-5">
      <Logo />
    </div>
    <!-- ---------------------------------------------- -->
    <!---Navigation -->
    <!-- ---------------------------------------------- -->
    <div>
      <perfect-scrollbar class="scrollnavbar">
        <v-list class="pa-6">
          <!---Menu Loop -->
          <template v-for="(item, i) in filteredItems">
            <!---Item Sub Header -->
            <NavGroup :item="item" v-if="item.header" :key="item.title" />
            <NavCollapse class="leftPadding" :item="item" :level="0" v-else-if="item.children" />
            <!---Single Item-->
            <NavItem :item="item" v-else class="leftPadding" />
            <!---End Single Item-->
          </template>
        </v-list>
      </perfect-scrollbar>
    </div>
  </v-navigation-drawer>
  <!------Header-------->
  <v-app-bar app elevation="0" height="70" :class="['top-header', { 'top-header--scrolled': isScrolled }]">
    <div class="d-flex align-center justify-space-between w-100">
      <div>
        <!--hidden-lg-and-up -->
        <v-btn class="ms-md-3 ms-sm-5 ms-3 text-muted" @click="sDrawer = !sDrawer" icon variant="flat" size="small">
          <Menu2Icon size="20" stroke-width="1.5" />
        </v-btn>
        <!-- Notification -->
        <NotificationDD />
      </div>
      <div class="d-flex align-center ga-2">
        <!-- Theme Switch -->
        <v-select
          v-model="themeMode"
          :items="themeModeItems"
          item-title="title"
          item-value="value"
          density="compact"
          variant="outlined"
          hide-details
          style="max-width: 140px"
          label="테마"
        />
        <!-- User Profile -->
        <ProfileDD v-if="auth.isAuthenticated" />
        <v-btn v-else prepend-icon="mdi-login" variant="tonal" color="primary" @click="goLogin" class="mr-5">
          로그인
        </v-btn>
      </div>
    </div>
  </v-app-bar>
</template>
