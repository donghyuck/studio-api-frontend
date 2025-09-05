<template>
    <div>
        <v-btn v-if="isEdit" variant="tonal" size="small" color="red" @click="deleteRow" prepend-icon="mdi-close">Delete</v-btn>
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
    props.params.api.applyTransaction({ remove: [props.params.data] });
};
</script>