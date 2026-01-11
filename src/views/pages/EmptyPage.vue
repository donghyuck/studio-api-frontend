<template>
    <v-breadcrumbs class="pa-0" :items="['응용프로그램', '자원', '파일']" density="compact"></v-breadcrumbs>
    <PageToolbar title="제목" label="설명" @refresh="refresh" :closeable="false" :divider="false" :prepend-items="[
    ]" :items="[
        { icon: 'mdi-refresh', event: 'refresh', }]"></PageToolbar>
    <v-card density="compact" class="mt-2">
        <v-card-text class="pb-0">
            <v-container fluid class="pa-0">
                <v-row>
                    <v-col>
                        <v-number-input :reverse="false" controlVariant="default" label="dd" :hideInput="false" :min="0"
                            :inset="false"></v-number-input>
                    </v-col>
                    <v-col>
                        <v-number-input :reverse="false" controlVariant="default" label="dd" :hideInput="false" :min="0"
                            :inset="false"></v-number-input>
                    </v-col>
                    <v-col></v-col>
                </v-row>
            </v-container>
        </v-card-text>
        <v-card-actions>
            <v-container fluid class="pa-0">
                <v-text-field label="검색어" placeholder="검색어를 입력하세요." row-height="15" rows="2" hide-details>
                    <template v-slot:append>
                        <v-btn icon="mdi-text-search" variant="tonal"></v-btn>
                    </template>
                </v-text-field>
            </v-container>
        </v-card-actions>
    </v-card>
</template>
<script setup lang="ts">
import PageToolbar from '@/components/bars/PageToolbar.vue';


const refresh = () => {

}

</script>
