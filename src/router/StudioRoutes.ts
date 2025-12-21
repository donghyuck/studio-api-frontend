import { requiredAdminRoles } from "@/utils/helpers";

const StudioRoutes = {
    path: '/mgmt',
    component: () => import("@/layouts/full/FullLayout.vue"),
    meta: {
        requiresAuth: true,
        roles: requiredAdminRoles
    },
    children: [ 
        // security
        {
            name: 'Users',
            path: 'security/users',
            component: () => import('@/views/mgmt/security/UsersPage.vue')
        },
        {
            name: 'UserDetails',
            path: 'security/users/:userId',
            component: () => import('@/views/mgmt/security/UserPage.vue'),
            props: r => ({ userId: Number(r.params.userId) })
        },              
        {
            name: 'Groups',
            path: 'security/groups',
            component: () => import('@/views/mgmt/security/GroupsPage.vue')
        },  
        {
            name: 'GroupDetails',
            path: 'security/groups/:groupId(\\d+)',  
            component: () => import('@/views/mgmt/security/GroupPage.vue'),
            props: r => ({ groupId: Number(r.params.groupId) })
        },                 
        {
            name: 'Roles',
            path: 'security/roles',
             component: () => import('@/views/mgmt/security/RolesPage.vue'),
        }, 
        {
            name: 'RoleDetails',
            path: 'security/roles/:roleId(\\d+)',   
            component: () => import('@/views/mgmt/security/RolePage.vue'),
            props: r => ({ roleId: Number(r.params.roleId) }) 
        },   
        // security:acl
         {
            name: 'Acl',
            path: 'security/acl',
             component: () => import('@/views/mgmt/security/acl/AclPage.vue'),
        }, 
        // security:audit 
        {
            name: 'LoginFailureLog',
            path: 'audit/login-failure-log',
             component: () => import('@/views/mgmt/audit/LoginFailureLogPage.vue'),
        },   
        // services:objectstorage
        {
            name: 'ObjectStorgaeProviders',
            path: 'services/objectstorage/providers',
             component: () => import('@/views/mgmt/services/objectstorage/ObjectStorageProvidersPage.vue'),
        },    
        {
            name: 'ObjectStorage',
            path: 'services/objectstorage/providers/:providerId', 
            component: () => import('@/views/mgmt/services/objectstorage/ObjectStoragePage.vue'),
            props: true
        },   
        // services:ai
        {
            name: 'Chat',
            path: 'services/ai/chat', 
            component: () => import('@/views/mgmt/services/ai/ChatPage.vue'),
            props: true
        }, 
        {
            name: 'Rag',
            path: 'services/ai/rag', 
            component: () => import('@/views/mgmt/services/ai/RagPage.vue'),
            props: true
        }, 
        // application:files
        {
            name: "Files",
            path: "application/files",
            component: () => import("@/views/mgmt/application/files/FilesPage.vue"),
        },
        {
            name: "Mail",
            path: "application/mail",
            component: () => import("@/views/mgmt/application/mail/MailPage.vue"),
        },
        {
            name: "MailInbox",
            path: "application/mail-inbox",
            component: () => import("@/views/mgmt/application/mail/MailInboxPage.vue"),
        },
        {
            name: "Templates",
            path: "application/templates",
            component: () => import("@/views/mgmt/application/templates/TemplatesPage.vue"),
        }

    ]
};
export default StudioRoutes;