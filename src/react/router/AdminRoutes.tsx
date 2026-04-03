import { Route, Routes } from "react-router-dom";
import { GroupsPage, RolesPage, UsersPage } from "@/react/pages/admin";

export function AdminRoutes() {
  return (
    <Routes>
      <Route path="users" element={<UsersPage />} />
      <Route path="groups" element={<GroupsPage />} />
      <Route path="roles" element={<RolesPage />} />
    </Routes>
  );
}
