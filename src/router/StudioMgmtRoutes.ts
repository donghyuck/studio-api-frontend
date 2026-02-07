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
            component: () => import('@/views/studio/mgmt/security/UsersPage.vue')
        },
        {
            name: 'UserDetails',
            path: 'security/users/:userId',
            component: () => import('@/views/studio/mgmt/security/UserPage.vue'),
            props: (r: any) => ({ userId: Number(r.params.userId) })
        },              
        {
            name: 'Groups',
            path: 'security/groups',
            component: () => import('@/views/studio/mgmt/security/GroupsPage.vue')
        },  
        {
            name: 'GroupDetails',
            path: 'security/groups/:groupId(\\d+)',  
            component: () => import('@/views/studio/mgmt/security/GroupPage.vue'),
            props: (r: any) => ({ groupId: Number(r.params.groupId) })
        },                 
        {
            name: 'Roles',
            path: 'security/roles',
             component: () => import('@/views/studio/mgmt/security/RolesPage.vue'),
        }, 
        {
            name: 'RoleDetails',
            path: 'security/roles/:roleId(\\d+)',   
            component: () => import('@/views/studio/mgmt/security/RolePage.vue'),
            props: (r: any) => ({ roleId: Number(r.params.roleId) }) 
        },   
        // security:acl
         {
            name: 'Acl',
            path: 'security/acl',
             component: () => import('@/views/studio/mgmt/security/acl/AclPage.vue'),
        }, 
        // security:audit 
        {
            name: 'LoginFailureLog',
            path: 'audit/login-failure-log',
             component: () => import('@/views/studio/mgmt/audit/LoginFailureLogPage.vue'),
        },   
        {
            name: 'ForumAuditLog',
            path: 'application/forums/audit-log',
            component: () => import('@/views/studio/mgmt/application/forums/ForumAuditLogPage.vue'),
        },
        // services:objectstorage
        {
            name: 'ObjectStorgaeProviders',
            path: 'services/objectstorage/providers',
             component: () => import('@/views/studio/mgmt/services/objectstorage/ObjectStorageProvidersPage.vue'),
        },    
        {
            name: 'ObjectStorage',
            path: 'services/objectstorage/providers/:providerId', 
            component: () => import('@/views/studio/mgmt/services/objectstorage/ObjectStoragePage.vue'),
            props: true
        },   
        // services:ai
        {
            name: 'Chat',
            path: 'services/ai/chat', 
            component: () => import('@/views/studio/mgmt/services/ai/ChatPage.vue'),
            props: true
        }, 
        {
            name: 'Rag',
            path: 'services/ai/rag', 
            component: () => import('@/views/studio/mgmt/services/ai/RagPage.vue'),
            props: true
        }, 
        // application:files
        {
            name: "Files",
            path: "application/files",
            component: () => import("@/views/studio/mgmt/application/files/FilesPage.vue"),
        },
        // application:mail
        {
            name: "MailSync",
            path: "application/mail-sync",
            component: () => import("@/views/studio/mgmt/application/mail/MailSyncPage.vue"),
        },
        {
            name: "MailInbox",
            path: "application/mail-inbox",
            component: () => import("@/views/studio/mgmt/application/mail/MailInboxPage.vue"),
        },
        {
            name: 'MailDetails',
            path: 'application/mail-inbox/:mailId',
            component: () => import('@/views/studio/mgmt/application/mail/MailPage.vue'),
            props: (r: any) => ({ mailId: Number(r.params.mailId) })
        },   
        // application:template
        {
            name: "Templates",
            path: "application/templates",
            component: () => import("@/views/studio/mgmt/application/template/TemplatesPage.vue"),
        },
        {
            name: 'TemplateDetails',
            path: 'application/templates/:templateId',
            component: () => import('@/views/studio/mgmt/application/template/TemplateDetails.vue'),
            props: (r: any) => ({ templateId: Number(r.params.templateId) })
        }, 
        // application:document
        {
            name: "Documents",
            path: "application/documents",
            component: () => import("@/views/studio/mgmt/application/document/DocumentListPage.vue"),
        },
        {
            name: "DocumentEditor",
            path: "application/documents/:documentId",
            component: () => import("@/views/studio/mgmt/application/document/DocumentEditor.vue"),
        },
        // policy:objecttype
        {
            name: "ObjectTypes",
            path: "policy/object-types",
            component: () => import("@/views/studio/mgmt/policy/objecttype/ObjectTypeListPage.vue"),
        },
        {
            name: "ObjectTypeCreate",
            path: "policy/object-types/new",
            component: () => import("@/views/studio/mgmt/policy/objecttype/ObjectTypeDetailPage.vue"),
            props: { objectType: 0, isCreate: true },
        },
        {
            name: "ObjectTypeDetails",
            path: "policy/object-types/:objectType(\\d+)",
            component: () => import("@/views/studio/mgmt/policy/objecttype/ObjectTypeDetailPage.vue"),
            props: (r: any) => ({ objectType: Number(r.params.objectType), isCreate: false }),
        },
         // application:forums
        {
            name: "Forums",
            path: "application/forums",
            component: () => import("@/views/studio/mgmt/application/forums/ForumListPage.vue"),
        },
        {
            name: "ForumDetails",
            path: "application/forums/:forumSlug",
            component: () => import("@/views/studio/mgmt/application/forums/ForumSettingsPage.vue"),
        }, 
        {
            name: "TopicDetails",
            path: "application/forums/:forumSlug/topics/:topicId",
            component: () => import("@/views/studio/mgmt/application/forums/TopicDetailsPage.vue"),
        },
        {
            name: "ForumAcl",
            path: "application/forums/:forumSlug/acl",
            component: () => import("@/views/studio/mgmt/application/forums/ForumAclPage.vue"),
        },
    ]
};
export default StudioRoutes;
