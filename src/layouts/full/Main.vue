<script setup lang="ts">
import { onMounted, ref, computed, shallowRef, watch } from 'vue';
import { useDisplay } from "vuetify";
import sidebarItems from './vertical-sidebar/sidebarItem';
import NavGroup from './vertical-sidebar/NavGroup/index.vue';
import NavItem from './vertical-sidebar/NavItem/index.vue'; 
import Logo from './logo/Logo.vue';
// Icon Imports
import { Menu2Icon} from 'vue-tabler-icons';
// dropdown imports
import NotificationDD from './vertical-header/NotificationDD.vue';
import ProfileDD from './vertical-header/ProfileDD.vue';
import NavCollapse from './vertical-sidebar/NavCollapse/NavCollapse.vue';

//auth store import
import { useAuthStore } from '@/stores/studio/auth.store';

const auth = useAuthStore();

// ✅ 현재 사용자 권한
const userRoles = computed(() => auth.user?.roles || []);
console.log('Current user roles:', userRoles.value);
// ✅ 권한 기반 필터링 함수
function hasAccess(item) {
  if (!item.roles || item.roles.length === 0) return true;
  return item.roles.some(role => userRoles.value.includes(role));
}

function filterSidebarItems(items) {
  return items
    .map(item => {
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
onMounted(() => {
  sDrawer.value = !mdAndDown.value; // hide on mobile, show on desktop
});
watch(mdAndDown, (val) => {
  sDrawer.value = !val;
});
</script>

<template>
    <!------Sidebar-------->
    <v-navigation-drawer left elevation="0"  app class="leftSidebar" :width="270"  v-model="sDrawer">
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
                <template v-for="(item, i) in filteredItems" >
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
    <v-app-bar elevation="0" height="70" class="top-header" >
        <div class="d-flex align-center justify-space-between w-100">
            <div>
                <v-btn class="hidden-lg-and-up ms-md-3 ms-sm-5 ms-3 text-muted" @click="sDrawer = !sDrawer" icon variant="flat"
                    size="small">
                    <Menu2Icon size="20" stroke-width="1.5" />
                </v-btn>
                <!-- Notification -->
                <NotificationDD />
            </div>
            <div>
                <!-- Upgrade button -->
                <v-btn class="mr-2 bg-primary" href="/" target="_blank">LINK</v-btn>
                <!-- User Profile -->
                <ProfileDD />
            </div>
        </div>
    </v-app-bar>
</template>
