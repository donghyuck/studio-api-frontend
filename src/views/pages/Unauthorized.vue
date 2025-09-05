<script setup lang="ts">
</script>
<template>
    <v-row>
        <v-col cols="12" md="12">
            <v-container class="text-center py-10">
                <v-icon color="error" size="80">mdi-lock-alert</v-icon>
                <h2 class="text-h5 mt-4">접근 권한이 없습니다</h2>
                <p class="text-body-1 mb-6">
                    이 페이지에 접근할 수 있는 권한이 없습니다. 관리자에게 문의하세요.
                </p>
                <v-btn color="primary" @click="$router.push('/')">메인페이지 이동</v-btn>
            </v-container>
        </v-col>
    </v-row>
</template>
