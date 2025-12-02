<template>
  <div class="metadata-cell" @click="openDialog">
    <!-- 짧게 보여주는 텍스트 + 마우스오버 툴팁 -->
    <span :title="fullText">{{ shortText }}</span>

    <v-dialog v-model="dialogOpen" max-width="600">
      <v-card>
        <v-card-title>{{ title }}</v-card-title>
        <v-card-text> 
          <v-textarea variant="outlined" :model-value="prettyText"></v-textarea>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="dialogOpen = false">닫기</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
// 필요하면 ag-grid 타입 사용
// import type { ICellRendererParams } from "ag-grid-community";

interface Params {
  value: unknown;
  data: any;
  colDef: { headerName?: string; field?: string };
  // ag-Grid ICellRendererParams 의 일부만 사용
}

const props = defineProps<{ params: Params }>();

const dialogOpen = ref(false);

/**
 * 원본 value 를 문자열로 변환 (string / object / number 등 공통 처리)
 */
const fullText = computed<string>(() => {
  const v = props.params.value;

  if (v == null) return "";

  if (typeof v === "string") {
    return v;
  }

  try {
    // object, array 등은 JSON 문자열로
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
});

/**
 * 다이얼로그 제목: 컬럼 헤더 이름 또는 필드명
 */
const title = computed(() => {
  return (
    props.params.colDef.headerName ||
    props.params.colDef.field ||
    "상세 보기"
  );
});

/**
 * 셀에 짧게 보여줄 텍스트 (ellipsis)
 */
const shortText = computed(() => {
  const text = fullText.value;
  if (!text) return "";

  const firstLine = text.split("\n")[0]; // 첫 줄만
  const maxLen = 50;

  if (firstLine.length <= maxLen) return firstLine;
  return firstLine.slice(0, maxLen) + "…";
});

/**
 * 다이얼로그 안에서 예쁘게 보여줄 텍스트
 * - object 면 JSON pretty print
 * - string 이면 그대로
 */
const prettyText = computed(() => {
  const v = props.params.value;

  if (v == null) return "";

  if (typeof v === "string") {
    return v;
  }

  try {
    return JSON.stringify(v, null, 2); // 들여쓰기 2
  } catch {
    return String(v);
  }
});

function openDialog() {
  if (!fullText.value) return; // 값 없으면 안 열도록 방어
  dialogOpen.value = true;
}
</script>

<style scoped>
.metadata-cell {
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
