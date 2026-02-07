import { defineStore } from 'pinia'
import type { RouteLocationNormalized } from 'vue-router'

export const useNavStore = defineStore('nav', {
  state: () => ({
    previous: null as RouteLocationNormalized | null,
  }),
  actions: {
    setPreviousRoute(route: RouteLocationNormalized) {
      this.previous = route
    },
  },
})
