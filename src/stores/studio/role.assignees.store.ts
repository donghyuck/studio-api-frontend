import { createRoleAssigneesStore } from './role.assignees.store.factory'
export const useUserGrantedStore  = createRoleAssigneesStore('user')
export const useGroupGrantedStore = createRoleAssigneesStore('group')