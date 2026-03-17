const AuthRoutes = {
    path: '/auth',
    component: () => import('@/layouts/blank/BlankLayout.vue'),
    meta: {
        requiresAuth: false
    },
    children: [
        {
            name: 'Login',
            path: 'login',
            component: () => import('@/views/auth/Login.vue')
        },
        {
            name: 'Register',
            path: 'register',
            component: () => import('@/views/auth/Register.vue')
        },
    ]
};
export default AuthRoutes;
