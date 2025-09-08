<template>
    <v-toolbar density="compact" class="bg-white">
        <v-btn v-if="previous" size="small" icon="mdi-chevron-left" @click="hasHistory() ? $router.go(-1) : $router.push('/')"></v-btn>
        
        <v-toolbar-title class="ml-4" v-if="title != null ">{{title}}<v-chip size="x-small" variant="plain" v-if="label != null ">{{label}}</v-chip> 
        </v-toolbar-title>
        <v-spacer></v-spacer>
        <v-for v-for="(item, index) of items" :key="index" >
        <v-btn v-if="isVisible(item.visible)" icon variant="text" size="small" :disabled="item.disabled" @click="emit( item.event )"> 
            <v-icon :color="item.color" >{{item.icon}}</v-icon>
        </v-btn>
        </v-for>
        <v-btn icon variant="text" size="small" @click="emit('close')" v-if="closeable">
            <v-icon>mdi-close</v-icon>
        </v-btn> 
    </v-toolbar>
    <v-divider v-if="divider" class="border-opacity-100" color="success"></v-divider>
</template>
<script setup lang="ts">
import { hasHistory } from '@/utils/helpers'; 

interface Item {
    icon: string, 
    disabled?: boolean, 
    visible?:boolean|true,
    event: string, 
    text?: string,
    color?:string
}

// define props with default values.
interface Props {
    title?: string,
    subtitle?:string,
    label?:string,
    divider?: boolean,
    divider_margin? : false,
    closeable?: boolean, 
    previous?:boolean,
    items?:Item[],
}
const props = withDefaults(defineProps<Props>(), {
    title: undefined,
    subtitle: undefined,
    label:undefined,
    divider: true,
    closeable: false,
    previous: false, 
    items: (): Item[] => [],
});

const isVisible = (visible : boolean = true) => {
    return visible;
};

// define emits
const emit = defineEmits( ['close', 'refresh', 'delete' , 'create', 'update', 'options' , 'upload' , 'download', 'play', 'fullscreenOn', 'fullscreenOff', 'custom'] );                                                                    

</script>