const MgmtRoutes = {
    path: '/mgmt',
    component: () => import("@/layouts/full/FullLayout.vue"),
    meta: {
        requiresAuth: true,
        roles: ['ROLE_ADMINISTRATOR']
    },
    children: [
        {
            name: 'Users',
            path: 'security/users',
            component: () => import('@/views/mgmt/security/UsersPage.vue')
        }, 
        {
            name: 'Roles',
            path: 'security/roles',
            component: () => import('@/views/mgmt/security/RolesPage.vue')
        }, 
    ]
};
export default MgmtRoutes;