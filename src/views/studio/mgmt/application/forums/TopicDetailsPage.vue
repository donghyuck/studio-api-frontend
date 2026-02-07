<template>
    <v-breadcrumbs class="pa-0" :items="['응용프로그램', '자원', '파일']" density="compact"></v-breadcrumbs>
    <PageToolbar title="제목" label="설명" @refresh="refresh" :closeable="false" :divider="false" :prepend-items="[
    ]" :items="[
        { icon: 'mdi-refresh', event: 'refresh', }]"></PageToolbar>
    <v-card density="compact" class="mt-1" variant="text">
         <v-card-actions class="pa-0">
            <v-container fluid class="pa-0">
                <v-row>
                    <v-col cols="2">
                        <v-number-input v-model="objectType" :reverse="false" controlVariant="default" label="객체 유형"
                            :hideInput="false" hide-details variant="outlined" density="compact" :min="0"
                            :inset="false"></v-number-input>
                    </v-col>
                    <v-col cols="2">
                        <v-number-input v-model="objectId" :reverse="false" controlVariant="default" label="객체 식별자"
                            :hideInput="false" hide-details variant="outlined" density="compact" :min="0"
                            :inset="false"></v-number-input>
                    </v-col>
                    <v-col>
                        <v-text-field v-model="q" label="검색어" placeholder="파일 이름을 입력하세요."
                            @keydown.enter="onSearchClick" hide-details variant="outlined" density="compact">
                            <template v-slot:append>
                                <v-btn icon="mdi-text-search" variant="tonal"></v-btn>
                            </template>
                        </v-text-field>
                    </v-col>
                </v-row>
            </v-container>
        </v-card-actions>
    </v-card>
</template>
<script setup lang="ts">
import PageToolbar from '@/components/bars/PageToolbar.vue';
import { ref } from 'vue';

const q = ref<string | null>(null)
const objectType = ref<number | null>(null)
const objectId = ref<number | null>(null)
    
// 수동 조회 버튼
function onSearchClick() {
}

const refresh = () => {

}

</script>
