import { Navigate, Route, Routes } from "react-router-dom";
import { GroupsPage, RolesPage, UsersPage } from "@/react/pages/admin";
import { AclPage } from "@/react/pages/acl/AclPage";
import { GroupDetailPage } from "@/react/pages/admin/groups/GroupDetailPage";
import { RoleDetailPage } from "@/react/pages/admin/roles/RoleDetailPage";
import { UserDetailPage } from "@/react/pages/admin/users/UserDetailPage";
import { AttachmentDownloadUrlIssueLogPage } from "@/react/pages/audit/AttachmentDownloadUrlIssueLogPage";
import { LoginFailureLogPage } from "@/react/pages/audit/LoginFailureLogPage";
import { ForumAclPage } from "@/react/pages/forums/admin/ForumAclPage";
import { ForumAuditLogPage } from "@/react/pages/forums/admin/ForumAuditLogPage";
import { ForumListPage } from "@/react/pages/forums/admin/ForumListPage";
import { ForumSettingsPage } from "@/react/pages/forums/admin/ForumSettingsPage";
import { TopicDetailsPage } from "@/react/pages/forums/admin/TopicDetailsPage";

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
