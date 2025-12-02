<script setup lang="ts">
import { useAuthStore } from '@/stores/studio/auth.store';
import { useRouter } from 'vue-router';
import { ListCheckIcon, MailIcon, UserIcon } from 'vue-tabler-icons';
const auth = useAuthStore();
const router = useRouter();
const logout = () => {
    auth.logout();
    router.push('/auth/login');
};
</script>
<template>
    <!-- ---------------------------------------------- -->
    <!-- notifications DD -->
    <!-- ---------------------------------------------- -->
    <v-menu :close-on-content-click="false">
        <template v-slot:activator="{ props }">
            <v-btn class="profileBtn custom-hover-primary" variant="text" v-bind="props" icon>
                <v-avatar size="35">
                    <img :src="auth.profileImageUrl" width="35" alt="user" />
                </v-avatar>
            </v-btn>
        </template>
        <v-sheet rounded="md" width="250" elevation="10" class="mt-2">
            <v-list>
                <v-list-item :prepend-avatar="auth.profileImageUrl" :subtitle="auth.user?.email"
                    :title="auth.user?.name">
                    <template v-slot:append> 
                    </template>
                </v-list-item>
            </v-list>
            <v-divider></v-divider>
            <v-list class="py-0" lines="one" density="compact">
                <v-list-item value="item1" color="primary">
                    <template v-slot:prepend>
                        <UserIcon stroke-width="1.5" size="20" />
                    </template>
                    <v-list-item-title class="pl-4 text-body-1">Profile</v-list-item-title>
                </v-list-item>
            </v-list>
            <div class="pt-4 pb-4 px-5 text-center">
                <v-btn @click="logout" color="primary" variant="outlined" block>Logout</v-btn>
            </div>
        </v-sheet>
    </v-menu>
</template>
