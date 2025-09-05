<script setup lang="ts">
import { ref } from "vue";
import { FileUploadClient } from "@/components/file/FileUploadClient"; // 앞서 작성한 클래스
import type { UploadMeta, UploadResult } from "@/types/upload";
import { VFileUpload } from 'vuetify/labs/VFileUpload';

const files = ref<File[]>([]);
const uploadProgress = ref<number[]>([]);
const uploadResults = ref<UploadResult[]>([]);
const uploading = ref(false);

// 업로드 메타 정보 (필요에 따라 동적 변경 가능)

const uploadMeta: UploadMeta = {
    module: "board",
    refId: "12345",
    tag: "main",
};

const error = ref(false);
const errorMessage = ref('');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// 1. drag and drop area 읠 위한 벨리데이션 
function handleFileChange(newFiles: File[]) {
    error.value = false;
    errorMessage.value = '';
    for (const file of newFiles) {
        if (file.size > MAX_FILE_SIZE) {
            error.value = true;
            errorMessage.value = '최대 파일 크기는 5MB입니다.';
            files.value = [];
            return;
        }
    }
}

// 2) file input 을 위한 벨리데이션 
const rules = [
    value => {
      // Multiple files
      if (value && Array.isArray(value)) {
        const totalSize = value.reduce((acc, current) => acc + current.size, 0)
        if( totalSize > MAX_FILE_SIZE )
            errorMessage.value = '최대 파일 크기는 5MB입니다.';
        else
            errorMessage.value = '';
        return totalSize < MAX_FILE_SIZE || errorMessage
      }
      // Single file (if multiple is undefined or set to false)
      return !value || value.size < MAX_FILE_SIZE || errorMessage
    },
  ]

const uploadClient = new FileUploadClient();
const handleUpload = async () => {
    if (files.value.length === 0) return;
    uploading.value = true;
    uploadProgress.value = Array(files.value.length).fill(0);
    try {
        const results = await uploadClient.uploadMany(files.value, uploadMeta, {
            concurrency: 2,
            onItemProgress: (idx, pct) => {
                uploadProgress.value[idx] = pct;
            },
        });
        uploadResults.value = results;
    } catch (e) {
        console.error("업로드 실패:", e);
    } finally {
        files.value = [];
        uploading.value = false;
    }
};
</script>
<template>
    <v-container>
        <v-row>
            <v-col>
                <v-card title="파일업로드" variant="outlined">
                    <v-card-text>
                        공통 파일 업로드는 모듈, 모듈에 따른 참조 아이디, 태그 값을 같이 서버에 전달하여 저장합니다.
                        예를 들어 게시판의 경우라면 board , 게시물아이디, attachment 형태로 값을 같이 저장하여
                        게시판의 특정 아이디에 해당하는 게시물 첨부를 구분합니다.
                        <br>
                        파일 업로드 UI 는 1) drag and drop area 과 2) file input 을 지원합니다. (vuetify3 지원)
                    </v-card-text>
                    <v-card-text>
                        <v-row>
                            <v-col cols="12" md="4">
                                <v-text-field clearable label="모듈명" v-model="uploadMeta.module"
                                    placeholder="예: board"></v-text-field>
                            </v-col>
                            <v-col cols="12" md="4">
                                <v-text-field clearable label="참조 객체 아이디" v-model="uploadMeta.refId"
                                    placeholder="예: 게시물 ID"></v-text-field>
                            </v-col>
                            <v-col cols="12" md="4"><v-text-field clearable label="테그" v-model="uploadMeta.tag"
                                    placeholder="예: main, thumbnail"></v-text-field>
                            </v-col>
                        </v-row>
                    </v-card-text>
                </v-card>
            </v-col>
        </v-row>
        <v-row>
            <v-col>
                <v-card title="1. drag and drop area" variant="outlined">
                    <v-card-text>
                        <v-file-upload v-model="files" multiple show-size title="첨부할 파일을 여기에 끌어다 놓거나"
                            divider-text="파일 선택 버튼을 눌러 파일을 직접 선택해주세요." accept="image/*,application/pdf"
                            browse-text="파일선택" @update:model-value="handleFileChange" :error="error"
                            :error-messages="errorMessage" prepend-icon="mdi-upload" clearable></v-file-upload>
                    </v-card-text>
                    <v-card-text>
                        <div v-if="uploading" class="mt-4">
                            <div v-for="(p, idx) in uploadProgress" :key="idx" class="my-2">
                                <div>파일 {{ idx + 1 }}: {{ p }}%</div>
                                <v-progress-linear :model-value="p" height="8" color="green"
                                    rounded></v-progress-linear>
                            </div>
                        </div>
                    </v-card-text>
                    <v-card-actions>
                        <v-spacer></v-spacer>
                        <v-btn :disabled="uploading || files.length === 0" color="primary" class="mt-4"
                            @click="handleUpload">
                            업로드
                        </v-btn>
                    </v-card-actions>
                </v-card>
            </v-col>
        </v-row>
        <v-row>
            <v-col>
                <v-card title="2. file input" variant="outlined">
                    <v-card-text>
                        <v-file-input clearable label="클릭하여 파일을 직접 선택해주세요."  
                            v-model="files"
                            :rules="rules"
                            accept="image/*,application/pdf" chips multiple show-size :error="error"
                            :error-messages="errorMessage"></v-file-input>
                    </v-card-text>
                    <v-card-text>
                        <div v-if="uploading" class="mt-4">
                            <div v-for="(p, idx) in uploadProgress" :key="idx" class="my-2">
                                <div>파일 {{ idx + 1 }}: {{ p }}%</div>
                                <v-progress-linear :model-value="p" height="8" color="green"
                                    rounded></v-progress-linear>
                            </div>
                        </div>
                    </v-card-text>
                    <v-card-actions>
                        <v-spacer></v-spacer>
                        <v-btn :disabled="uploading || files.length === 0" color="primary" class="mt-4"
                            @click="handleUpload">
                            업로드
                        </v-btn>
                    </v-card-actions>
                </v-card>
            </v-col>
        </v-row>
        <v-card title="파일 업로드 결과" variant="outlined" class="mt-5">
            <v-card-text>
            <div v-if="uploadResults.length > 0" class="mt-6">
                <h3>업로드 완료된 파일</h3>
                <v-list density="compact">
                    <v-list-item v-for="(item, i) in uploadResults" :key="i" :title="item.originalName"
                        :subtitle="`${(item.size / 1024).toFixed(1)} KB - ${item.contentType}`">
                        <template #prepend>
                            <v-icon icon="mdi-file" />
                        </template>
                    </v-list-item>
                </v-list>
            </div>
            </v-card-text>
        </v-card>
    </v-container>
</template>