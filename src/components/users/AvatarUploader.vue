<!-- src/components/AvatarUploader.vue -->
<script setup lang="ts">
import { FilePond } from '@/plugins/filepond'
import { useAuthStore } from '@/stores/studio/mgmt/auth.store'
import { type AvatarPresence, useUserAvatarsStore } from '@/stores/studio/mgmt/user.avatars.store'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { guessFilenameFromUrl, parseFilenameFromContentDisposition } from '@/components/images/filename'
import type { FilePondFile } from 'filepond'
import { useConfirm } from '@/plugins/confirm';

interface Props {
    userId: number
    width?: number
    height?: number
    /** 서버 multipart form 필드명 */
    fieldName?: string
    /** 초기 표시할 이미지 URL (없으면 대표 이미지 URL 사용) */
    initialUrl?: string
    /** 초기 URL이 보호(인증 필요)인지 여부 */
    protectedInitial?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    width: 512,
    height: 512,
    fieldName: 'file',
    protectedInitial: false,
})

// Avatar
const confirm = useConfirm();
const useAvatars = useUserAvatarsStore(props.userId)
const avatars = useAvatars()

// 인증 토큰
const auth = useAuthStore()
const { token } = storeToRefs(auth)

// 엔드포인트
const base = import.meta.env.VITE_API_BASE_URL
const uploadUrl = computed(() => `${base}/api/mgmt/users/${props.userId}/avatars`)
const sourceUrl = computed(() => props.initialUrl ?? `${base}/api/mgmt/users/${props.userId}/avatars/primary`)

// FilePond 파일 리스트 (reactive)
const pondFiles = ref<any[]>([])

// server.load에서 파싱한 정확 파일명을 임시로 저장할 Map
const lastResolvedNameMap = new Map<string, string>()

// 초기 표시 이름(추정값). 서버에서 정확값을 얻으면 file-rename 플러그인으로 대체.
const displayNameGuess = ref(guessFilenameFromUrl(sourceUrl.value, 'avatar.jpg'))

// 초기 files: URL을 "로컬 파일처럼 보이게" 세팅 (FilePond가 server.load를 호출)
const files = computed(() =>
    presence.value?.hasAvatar ?
        [{
            source: sourceUrl.value,
            options: {
                type: 'local',
                metadata: {
                    fromServer: true,
                    imageId: presence.value.primaryImageId,
                    primary: true,
                },
            }
        }] : []
)
/** 서버 옵션: 업로드(process) + 초기 로드(load) */
const server = computed(() => ({
    process: {
        url: uploadUrl.value,
        method: 'POST',
        withCredentials: false,
        headers: token.value ? { Authorization: `Bearer ${token.value}` } : {},
        timeout: 10000,
        onload: (res: string) => {
            try {
                const parsed = typeof res === 'string' ? JSON.parse(res) : res;
                const id = parsed?.id ?? parsed?.imageId ?? parsed?.data?.id;
                if (id != null) {
                    console.log('AvatarUploader: upload complete, server returned', id);
                    return String(id);
                }
            } catch (e) {
                if (typeof res === 'string' && res.trim()) {
                    console.log('AvatarUploader: upload complete (plain id)', res.trim());
                    return res.trim();
                }
            }
            throw new Error('Unexpected upload response format');
        },
        onerror: (res: any) => {
            console.error('AvatarUploader: upload error', res)
            return `Upload failed: ${res}`
        },
    },
    // (source, load, error, progress, abort)
    load: (
        source: string,
        loadCb: (b: Blob) => void,
        errorCb: (e: any) => void,
        progress: (computable: boolean, received: number, total: number) => void,
        _abort: any
    ) => {
        console.log('AvatarUploader: load called for', source)
        const controller = new AbortController()
        fetch(source, {
            method: 'GET',
            headers: (props.protectedInitial && token.value) ? { Authorization: `Bearer ${token.value}` } : {},
            signal: controller.signal,
        })
            .then(async (res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                // 1) 파일명 파싱 (CORS: Access-Control-Expose-Headers 필요)
                const disp = res.headers.get('Content-Disposition')
                const name = parseFilenameFromContentDisposition(disp)
                if (name) lastResolvedNameMap.set(source, name)
                // 2) 바디를 Blob으로 변환 (진행률 계산 가능)
                const ct = res.headers.get('Content-Type') || 'image/jpeg'
                const len = Number(res.headers.get('Content-Length') || 0)
                if (!res.body) {
                    const ab = await res.arrayBuffer()
                    loadCb(new Blob([ab], { type: ct }))
                    return
                }
                const reader: ReadableStreamDefaultReader<Uint8Array> = res.body.getReader()
                const parts: BlobPart[] = []
                let received = 0
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break
                    if (value) {
                        const ab = new Uint8Array(value).buffer;
                        parts.push(ab);
                        received += value.byteLength
                        if (len) progress(true, received, len)
                    }
                }

                loadCb(new Blob(parts, { type: ct }))
            })
            .catch(errorCb)

        return { abort: () => controller.abort() }
    },

    revert: null,
}))

async function beforeRemoveFile(file: FilePondFile): Promise<boolean> {
    const imageId = file.getMetadata('imageId') ?? 0;
    console.log('beforeRemoveFile called for', file.getMetadata(), file.serverId, file.getMetadata('imageId'));
    const ok = await confirm({
        title: '확인',
        message: `이미지를 삭제하시겠습니까?`,
        okText: '예',
        cancelText: '아니오',
        color: 'primary',
    });
    if( ok )
    {
        await avatars.delete(imageId);
        return true;
    }
    return false;
}

const fileRenameFn = (file: any) => {
    console.log('fileRenameFn called with', file)
    const src = (file?.source ?? undefined) as string | undefined
    console.log('fileRenameFn called for', file, 'resolved name:', lastResolvedNameMap.get(src || ''))
    if (src && lastResolvedNameMap.has(src)) {
        return lastResolvedNameMap.get(src)!
    }
    return file?.name ?? 'avatar.jpg'
}

// 상위 알림
const emit = defineEmits<{
    (e: 'uploaded', imageId: string): void
    (e: 'error', err: unknown): void
}>()

function onProcessFile(error: any, file: any) {
    if (error) emit('error', error)
    else emit('uploaded', file.serverId)
}

const presence = ref<AvatarPresence>();

async function getData(force: boolean = false) {
    const data = await avatars.checkPresence();
    presence.value = data;
}
onMounted(async () => {
    if (props.userId > 0) {
        getData(true);
    }
});
</script>
<template>
    <FilePond :name="fieldName" :server="server" :files="files" :allow-multiple="false" accepted-file-types="image/*"
        max-files="1" instant-upload :credits="false" :image-resize-target-width="width"
        :image-resize-target-height="height" image-resize-mode="cover" image-transform-output-quality="0.9"
        image-transform-output-mime-type="image/jpeg" :label-idle="'이미지를 끌어놓거나 클릭하여 선택'"
        :label-file-processing="() => '업로드 중...'" :label-file-processing-complete="'완료'" :label-tap-to-cancel="'취소'"
        :label-tap-to-retry="'재시도'" :allow-revert="false" :label-tap-to-undo="'되돌리기'" @processfile="onProcessFile"
        :before-remove-file="beforeRemoveFile" :file-rename-function="fileRenameFn" />
</template>
