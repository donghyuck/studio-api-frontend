<template>
    <v-breadcrumbs class="pa-0" :items="['시스템관리', '보안관리', '그룹']" density="compact"></v-breadcrumbs>
    <PageToolbar title="Group" :label="name" :previous="true" :closeable="false" :divider="true" :items="[
        { icon: 'mdi-refresh', event: 'refresh', }]"></PageToolbar>
    <v-row>
        <v-col cols="12" md="12">
            <v-skeleton-loader :loading="overlay" type="article, actions">
                <v-card>
                    <v-card-text>
                        <form @submit.prevent="">
                            <v-text-field label="Name*" v-model="name" :error-messages="nameError" />
                            <v-textarea label="Description" rows="3" v-model="description"
                                :error-messages="descError" />
                            <PropertiesGrid :rowData="properties" @change="handleChange" height="200px"/>
                        </form>
                    </v-card-text>
                    <v-card-actions>
                        <v-btn prepend-icon="mdi-shield-account-variant" variant="tonal" color="primary" rounded="xl" width="100">
                            Roles
                            <GroupRolesDialog activator="parent"  v-model="groupRolesDialog.visible" :groupId="groupId" @close="groupRolesDialog.visible = false"  @updated="refresh"></GroupRolesDialog>
                        </v-btn>
                        <v-spacer />
                        <v-btn variant="tonal" color="grey" rounded="xl" width="100"
                            @click="hasHistory() ? $router.go(-1) : $router.push('/')">
                            Cancel
                        </v-btn>
                        <v-btn variant="outlined" prepend-icon="mdi-content-save" rounded="xl" color="primary"
                            :loading="saving" @click="onSubmit" width="100">
                            Save
                        </v-btn>
                    </v-card-actions>
                </v-card>
            </v-skeleton-loader>
            <v-overlay v-model="overlay" contained class="align-center justify-center">
                <v-progress-circular color="primary" indeterminate size="64" />
            </v-overlay>
        </v-col>
    </v-row> 
</template>
<script setup lang="ts">
import PageToolbar from '@/components/buttons/PageToolbar.vue';
import { onMounted, ref } from 'vue';
import { fromRowData, hasHistory, toRowData } from '@/utils/helpers';
// vee-validate
import * as yup from 'yup'
import { useConfirm } from '@/plugins/confirm';
import { useToast } from '@/plugins/toast';
import { usePageableGroupsStore } from '@/stores/studio/groups.store';
import { useField, useForm } from 'vee-validate';
import PropertiesGrid from '../PropertiesGrid.vue';
import GroupRolesDialog from './GroupRolesDialog.vue';
import type { Property } from '@/types/studio';

const props = defineProps({
    groupId: { type: Number, default: 0 },
});

const store = usePageableGroupsStore();
const toast = useToast();
const confirm = useConfirm();
// define overlays
const overlay = ref(false);
const saving = ref(false);

const schema = yup.object({
    name: yup.string().required('Name은 필수입니다.').min(2, '최소 2자 이상').max(50, '최대 50자'),
    description: yup.string().max(500, '최대 500자').nullable(),
})

const { handleSubmit } = useForm({ validationSchema: schema })

const { value: name, errorMessage: nameError } = useField<string>('name')
const { value: description, errorMessage: descError } = useField<string>('description')

const properties = ref<Property[]>([]);

const groupRolesDialog = ref({
    visible: false,
    groupId: 0,
});

async function getData(force: boolean = false) {
    overlay.value = true;
    try {
        const data = await store.byId(props.groupId, { revalidate: false })
        if (data) {
            name.value = data.name ?? ''
            description.value = data.description ?? ''
            if (data.properties) {
                properties.value = toRowData(data.properties)
            }else{
                properties.value = []
            }
        }
    } finally {
        overlay.value = false;
    }

}
const refresh = () => {
    getData()
}

const onSubmit = handleSubmit(async (form) => {
    if (!Number.isFinite(props.groupId)) return
    const ok = await confirm({
        title: '저장 확인',
        message: '현재 내용을 저장하시겠습니까?',
        okText: '저장',
        cancelText: '취소',
        color: 'primary',
    });
    if (!ok) return;
    saving.value = true
    try {
        await store.update(props.groupId, {
            name: name.value,
            description: description.value,
            properties: fromRowData(properties.value)
        }, { refreshList: false }) // 필요시 true로 목록 재조회 
        toast.success('저장 완료!');
    } finally {
        saving.value = false
    }
})

function handleChange(all: Property[]) {
  // 전체 변경된 데이터가 여기로 들어옴
  // 서버 저장/검증/동기화 등 처리
  console.log('changed rows:', all)
  properties.value = all;
}

onMounted(() => {
    if (props.groupId > 0) {
        getData();
    }
    console.log('group mounted.')
});

</script>