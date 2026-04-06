import { Route, Routes } from "react-router-dom";
import { GroupsPage, RolesPage, UsersPage } from "@/react/pages/admin";
import { GroupDetailPage } from "@/react/pages/admin/groups/GroupDetailPage";
import { RoleDetailPage } from "@/react/pages/admin/roles/RoleDetailPage";
import { UserDetailPage } from "@/react/pages/admin/users/UserDetailPage";

export function AdminRoutes() {
  return (
    <Routes>
      <Route path="users" element={<UsersPage />} />
      <Route path="users/:userId" element={<UserDetailPage />} />
      <Route path="groups" element={<GroupsPage />} />
      <Route path="groups/:groupId" element={<GroupDetailPage />} />
      <Route path="roles" element={<RolesPage />} />
      <Route path="roles/:roleId" element={<RoleDetailPage />} />
    </Routes>
  );
}
