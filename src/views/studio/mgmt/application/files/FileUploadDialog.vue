<template>
  <v-dialog v-model="dialogOpen" width="650" :fullscreen="false" :scrim="true" transition="dialog-bottom-transition">
    <v-card>
      <PageToolbar title="업로드" @close="handleClose" :closeable="true" :divider="true"
        :items="[{ icon: 'mdi-refresh', event: 'refresh' }]" />
      <v-card-text>
        <v-row>
          <v-col>
            <v-number-input v-model="objectType" :reverse="false" controlVariant="default" label="객체 유형"
              :hideInput="false" :min="0" :inset="false" hide-details></v-number-input>
          </v-col>
          <v-col>
            <v-number-input v-model="objectId" :reverse="false" controlVariant="default" label="객체 식별자"
              :hideInput="false" :min="0" :inset="false" hide-details></v-number-input>
          </v-col>
        </v-row>
        <v-row dense>
          <v-col cols="12" sm="12">
            <div ref="uppyContainer"></div>
          </v-col>
        </v-row>
      </v-card-text>
      <v-divider class="border-opacity-100" color="primary" />
      <v-card-actions>
        <v-spacer />
        <v-btn variant="tonal" color="grey" rounded="xl" @click="handleClose" width="100">
          Cancel
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
<script setup lang="ts">
import PageToolbar from '@/components/bars/PageToolbar.vue'
import Uppy from '@uppy/core';
import Dashboard from "@uppy/dashboard"
import XHRUpload from "@uppy/xhr-upload"
import { useToast } from '@/plugins/toast';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import Korean from '@uppy/locales/lib/ko_KR'
import '@uppy/core/css/style.min.css'
import '@uppy/dashboard/css/style.min.css' 
import { authHeader } from '@/data/studio/auth';

const toast = useToast()
const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'close'): void
  (e: 'complete', payload: any): void
}>()

/** 닫기: 여기서만 초기화 */
function handleClose() {
  emit('close')
}
const dialogOpen = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const objectType = ref<number | null>(0)
const objectId = ref<number | null>(0)
const xhrUploadUrl = `${import.meta.env.VITE_API_BASE_URL}/api/mgmt/files`
/* ----------------------------------------------
 *  UPPY INSTANCE
 * ---------------------------------------------- */
const uppyContainer = ref<HTMLDivElement | null>(null)
let uppy: Uppy | null = null

function initUppy() {
  if (uppy) return  // 이미 초기화됨

  uppy = new Uppy({
    autoProceed: false,
    locale: Korean,
    restrictions: {
      maxFileSize: 20 * 1024 * 1024,
      maxNumberOfFiles: 1
    }
  })

  uppy.use(Dashboard, {
    inline: true,
    target: uppyContainer.value!,
    height: 300,
    proudlyDisplayPoweredByUppy: false,
  }) 

  // form data 방식 업로드 설정
  uppy.use(XHRUpload, {
    method: "POST",
    formData: true,
    fieldName: "file",
    endpoint: xhrUploadUrl,
    headers:{...authHeader()},
  })
 
  uppy.on("upload", async () => {
    const files = uppy!.getFiles()
    for (const file of files) { 
      uppy!.setFileMeta(file.id, {
        objectId: objectId.value,
        objectType: objectType.value,
      })
    }
  })
   
  uppy.on("complete", (result) => {
    console.log("Upload complete! We’ve uploaded these files:", result.successful) 
    emit("complete", result.successful)
  })
}

function destroyUppy() {
  if (uppy) {
    uppy.destroy()
    uppy = null
    objectType.value = 0
    objectId.value = 0
  }
}

onBeforeUnmount(() => {
  destroyUppy()
})

watch(dialogOpen, async (open) => {
  if (open) {
    // 실제 DOM 이 만들어진 다음에 Uppy 를 붙여야 함
    await nextTick()
    initUppy()
  } else {
    destroyUppy()
  }
})

</script>