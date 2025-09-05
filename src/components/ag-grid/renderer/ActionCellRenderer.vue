<template>
    <div>
        <v-btn v-if="isEdit || isNew" variant="tonal" density="default" size="small" color="primary" @click="saveRow" prepend-icon="mdi-content-save" style="margin-right: 2px;">Save</v-btn>
        <v-btn v-if="!isNew" variant="tonal" density="default" size="small" color="red" @click="deleteRow" prepend-icon="mdi-close">Delete</v-btn>
    </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    data?: { [key: string]: any };
    api?: any;
    node?: any;
    params: {
        data: { [key: string]: any };
        api: any;
        node: any;
    }
}>();

const isEdit = computed(() => {
    if (props.params && props.params.data && props.params.data.isEdit) {
        return props.params.data.isEdit;
    }
    return false;
});

const isNew = computed(() => {
    if (props.params && props.params.data && props.params.data.isNew) {
        return props.params.data.isNew;
    }
    return false;
});

const emits = defineEmits(['save', 'delete']);

const saveRow = () => {
    props.params.api.dispatchEvent({
            type: 'actionCellRenderer:save',
            data: props.params.data
    });
};
const deleteRow = () => {
    emits('delete', props.params.data);
    props.params.api.dispatchEvent({
            type: 'actionCellRenderer:delete',
            data: props.params.data
    });
};
</script>