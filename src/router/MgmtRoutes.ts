const MgmtRoutes = {
    path: '/mgmt',
    component: () => import("@/layouts/full/FullLayout.vue"),
    meta: {
        requiresAuth: true,
        roles: [`${import.meta.env.VITE_REQUIRED_ADMIN_ROLE}`]
    },
    children: [
        {
            name: 'Users',
            path: 'security/users',
            component: () => import('@/views/mgmt/security/UsersPage.vue')
        }, 
        {
            name: 'Groups',
            path: 'security/groups',
            component: () => import('@/views/mgmt/security/GroupsPage.vue')
        },         
        {
            name: 'Roles',
            path: 'security/roles',
            component: () => import('@/views/mgmt/security/RolesPage.vue')
        }, 
    ]
};
export default MgmtRoutes;