<template>
  <div class="custom-boolean-filter" style="margin: 10px;">
    <v-checkbox label="True" v-model="trueSelected" hide-details density="compact"
      @change="onFilterChanged"></v-checkbox>
    <v-checkbox label="False" v-model="falseSelected" hide-details density="compact"
      @change="onFilterChanged"></v-checkbox>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';

interface FilterParams {
  filterChangedCallback: () => void;
  valueGetter: (rowNode: any) => any;
  colDef: { field: string };
  api: any;
  columnApi: any;
}

interface Model {
  filter: boolean,
  filterType: string,
  type: string
}

const props = defineProps<{ params: FilterParams }>();

const trueSelected = ref(false);

const falseSelected = ref(false);

watch([trueSelected], () => {
  if (trueSelected.value === true) {
    falseSelected.value = false;
  }
});
watch([falseSelected], () => {
  if (falseSelected.value === true) {
    trueSelected.value = false;
  }
});

const onFilterChanged = () => {
  props.params.filterChangedCallback();
};

const isFilterActive = () => {
  return trueSelected.value || falseSelected.value;
};

const doesFilterPass = (params: any) => {
  const value = params.data[props.params.colDef.field];
  if (trueSelected.value && value === true) return true;
  if (falseSelected.value && value === false) return true;
  return false;
};

const setModel = (model: Model | null) => {
  if (model == null) {
    trueSelected.value = false;
    falseSelected.value = false;
  } else {
    trueSelected.value = model.filter === true;
    falseSelected.value = model.filter === false;
  }
};

const getModel = (): Model | null => {
  if (!isFilterActive()) {
    return null;
  }
  return {
    filter: getFinalValue(),
    filterType: 'boolean',
    type: 'equals'
  };
};

const getFinalValue = () => {
  if (trueSelected.value) {
    return true;
  } else
    if (falseSelected.value) {
      return false;
    }
  return false;
};

onMounted(() => {
  trueSelected.value = props.params.valueGetter({ data: true }) === true;
  falseSelected.value = props.params.valueGetter({ data: false }) === false;
});

watch([trueSelected, falseSelected], onFilterChanged);
</script>

<style scoped>
.custom-boolean-filter {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.custom-boolean-filter .v-label {
  font-size: 0.75rem !important;
  font-weight: 400;
  line-height: 1.425;
  letter-spacing: 0.0178571429em !important;
  font-family: inherit;
  text-transform: none !important;
}
</style>