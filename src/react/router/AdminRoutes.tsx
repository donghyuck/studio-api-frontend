import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

// Lazy-loaded Admin Pages
const GroupsPage = lazy(() => import("@/react/pages/admin").then(m => ({ default: m.GroupsPage })));
const RolesPage = lazy(() => import("@/react/pages/admin").then(m => ({ default: m.RolesPage })));
const UsersPage = lazy(() => import("@/react/pages/admin").then(m => ({ default: m.UsersPage })));
const AclPage = lazy(() => import("@/react/pages/acl/AclPage").then(m => ({ default: m.AclPage })));
const GroupDetailPage = lazy(() => import("@/react/pages/admin/groups/GroupDetailPage").then(m => ({ default: m.GroupDetailPage })));
const RoleDetailPage = lazy(() => import("@/react/pages/admin/roles/RoleDetailPage").then(m => ({ default: m.RoleDetailPage })));
const UserDetailPage = lazy(() => import("@/react/pages/admin/users/UserDetailPage").then(m => ({ default: m.UserDetailPage })));
const AttachmentDownloadUrlIssueLogPage = lazy(() => import("@/react/pages/audit/AttachmentDownloadUrlIssueLogPage").then(m => ({ default: m.AttachmentDownloadUrlIssueLogPage })));
const LoginFailureLogPage = lazy(() => import("@/react/pages/audit/LoginFailureLogPage").then(m => ({ default: m.LoginFailureLogPage })));
const CompanyDetailPage = lazy(() => import("@/react/pages/companies/CompanyDetailPage").then(m => ({ default: m.CompanyDetailPage })));
const CompanyListPage = lazy(() => import("@/react/pages/companies/CompanyListPage").then(m => ({ default: m.CompanyListPage })));
const ForumAclPage = lazy(() => import("@/react/pages/forums/admin/ForumAclPage").then(m => ({ default: m.ForumAclPage })));
const ForumAuditLogPage = lazy(() => import("@/react/pages/forums/admin/ForumAuditLogPage").then(m => ({ default: m.ForumAuditLogPage })));
const ForumListPage = lazy(() => import("@/react/pages/forums/admin/ForumListPage").then(m => ({ default: m.ForumListPage })));
const ForumSettingsPage = lazy(() => import("@/react/pages/forums/admin/ForumSettingsPage").then(m => ({ default: m.ForumSettingsPage })));
const TopicDetailsPage = lazy(() => import("@/react/pages/forums/admin/TopicDetailsPage").then(m => ({ default: m.TopicDetailsPage })));

export function AdminRoutes() {
  return (
    <Routes>
      <Route path="users" element={<UsersPage />} />
      <Route path="users/:userId" element={<UserDetailPage />} />
      <Route path="groups" element={<GroupsPage />} />
      <Route path="groups/:groupId" element={<GroupDetailPage />} />
      <Route path="acl" element={<AclPage />} />
      <Route path="roles" element={<RolesPage />} />
      <Route path="roles/:roleId" element={<RoleDetailPage />} />
      <Route path="companies" element={<CompanyListPage />} />
      <Route path="companies/:companyId" element={<CompanyDetailPage />} />
      <Route path="audit/login-failures" element={<LoginFailureLogPage />} />
      <Route
        path="audit/attachment-download-links"
        element={<AttachmentDownloadUrlIssueLogPage />}
      />
      <Route path="forums" element={<ForumListPage />} />
      <Route
        path="forums/:forumSlug"
        element={<Navigate to="settings" replace />}
      />
      <Route
        path="forums/:forumSlug/settings"
        element={<ForumSettingsPage />}
      />
      <Route path="forums/:forumSlug/acl" element={<ForumAclPage />} />
      <Route
        path="forums/:forumSlug/topics/:topicId"
        element={<TopicDetailsPage />}
      />
      <Route path="forums/:forumSlug/audit" element={<ForumAuditLogPage />} />
    </Routes>
  );
}
