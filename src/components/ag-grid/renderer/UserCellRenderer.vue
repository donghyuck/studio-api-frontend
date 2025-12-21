<template>
    <v-list-item class="w-100" v-if="user">
        <template v-slot:prepend>
          <v-avatar
            size="24"
            color="grey-darken-3"
            :image="profileImageUrl"
          ></v-avatar>
        </template> 
        <v-list-item-title class="text-body-2">{{ profileName }}</v-list-item-title> 
        <v-list-item-subtitle>{{profileEmail}}</v-list-item-subtitle>  
      </v-list-item>
</template>
<script setup lang="ts">
import NO_AVATAR from "@/assets/images/users/no-avatar.png";
import { getProfileImageUrl } from "@/data/studio/user";
import type { UserDto } from "@/types/studio/user";
import { computed } from 'vue';

const props = defineProps<{ params: any }>();
const column = props.params.column; 

const user = computed<UserDto | undefined>(() => {
  return props.params.value ?? null
})
const profileImageUrl = computed(() => {
  if (!user.value || !user.value.username) {
    return NO_AVATAR
  }
  return getProfileImageUrl(user.value.username)
})
const profileName = computed(() => {
    if( user.value?.nameVisible ) {
        return user.value?.name ?? user.value?.username ?? ''
    }else {
        return user.value?.username ?? ''
    }
})
const profileEmail = computed(() => {
    if( user.value?.emailVisble ) {
        return user.value?.email ?? ''
    }else {
        return ""
    }
})

</script>
