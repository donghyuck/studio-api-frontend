<template>
    <div>
        <v-btn v-if="showDownload" variant="tonal" size="small" color="blue" @click="handleDownload" prepend-icon="mdi-file-download" class="mr-2">다운로드</v-btn>
        <v-btn v-if="showDelete"  variant="tonal" size="small" color="red" @click="handleDelete" prepend-icon="mdi-delete">삭제</v-btn>
    </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  params: {
    data: Record<string, any>;
    api: any;
    node: any;
    column?: any;
    colDef?: {
      cellRendererParams?: {
        /** 타이틀로 표시할 키들 (우선순위 순) */
        nameKeys?: string | string[];
        /** 부제목으로 표시할 키들 (우선순위 순) */
        subtitleKeys?: string | string[];
        /** 다운로드 버튼 노출 여부 */
        downloadable?: boolean;
        /** 삭제 버튼 노출 여부 */
        deletable?: boolean;
      };
    };
  };
}>();

const rendererParams = computed(
    () => props.params?.colDef?.cellRendererParams ?? {}
);

const showDownload = computed(() => {
  const v = rendererParams.value.downloadable;
  return v === undefined ? true : !!v;
});
const showDelete = computed(() => {
  const v = rendererParams.value.deletable;
  return v === undefined ? true : !!v;
});

const emits = defineEmits(['delete', 'download']);

const handleDownload = () => {
    emits('delete', props.params.data);
    props.params.api.dispatchEvent({
        type: 'buttonCellRenderer:download',
        data: props.params.data
    });
    props.params.api.applyTransaction({ download: [props.params.data] });
};

const handleDelete = () => {
    emits('delete', props.params.data);
    props.params.api.dispatchEvent({
        type: 'buttonCellRenderer:delete',
        data: props.params.data
    });
    props.params.api.applyTransaction({ delete: [props.params.data] });
};
</script>