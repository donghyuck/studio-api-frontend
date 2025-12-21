<template>
    <div class="mail-list">
        <div v-for="(m, idx) in parsedList" :key="idx" class="mail-item">
            <v-hover v-slot="{ props, isHovering }">
                <div v-bind="props" class="hover-target">
                    <span class="name" v-if="m.name">{{ m.name }}</span>
                    <span class="email" v-else>{{ m.email }}</span>
                    <!-- Hover 팝업 -->
                    <v-menu v-model="showMenu[idx]" activator="parent" open-on-hover location="bottom start"
                        :close-on-content-click="false">
                        <v-card class="pa-3" width="250" rounded="15">
                            <template v-slot:title>
                                <v-card-title class="text-body-2" v-text="m.name || m.email"></v-card-title>
                            </template>
                            <template v-slot:subtitle>
                                <v-card-subtitle v-text="m.email"></v-card-subtitle>
                            </template> 
                            <template v-slot:prepend>
                                <v-avatar color="blue-darken-2" :image="ANONYMOUS_IMAGE">
                                </v-avatar>
                            </template>
                            <!-- <v-card-actions class="pb-0">
                                <v-spacer />
                                <v-btn icon="$vuetify"></v-btn>
                            </v-card-actions> -->
                        </v-card>
                    </v-menu>
                </div>
            </v-hover>
        </div>
    </div>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";
import ANONYMOUS_IMAGE from "@/assets/images/users/anonymous.png";
const props = defineProps<{ params: any }>();
const column = props.params.column;
const parsedList = computed(() => parseEmailList(props.params.value));
const showMenu = ref<boolean[]>([]);
function parseEmailList(raw: string) {
    if (!raw) return [];
    // 쉼표 기준 분리
    const parts = raw.split(",").map(v => v.trim());
    return parts.map(p => {
        let nameMatch = p.match(/"?(.*?)"?\s*</);
        let emailMatch = p.match(/<(.*?)>/);
        let name: string | null = null;
        let email: string | null = null;
        if (nameMatch && emailMatch) {
            name = nameMatch[1]
                .replace(/"/g, "")  // 큰따옴표 제거
                .replace(/\//g, "") // 슬래시 제거
                .trim();
            email = emailMatch[1].trim();
        } else if (emailMatch) {
            // <email> 만 있을 때
            email = emailMatch[1].trim();
        } else {
            // 순수 email
            email = p.trim();
        }
        return {
            name,
            email,
            initial: (name || email || "?").charAt(0).toUpperCase(),
        };
    });
}


</script>
