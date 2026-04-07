import { Route } from "react-router-dom";
import { MyProfilePage } from "@/react/features/profile/pages/MyProfilePage";

export const profileRoutes = (
  <Route path="profile" element={<MyProfilePage />} />
);
