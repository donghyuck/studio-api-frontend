import type { ResetPasswordRequest } from "@/types/studio/user";
import { api } from "@/utils/http";
 
const API_BASE = "/api/mgmt/users";

export async function resetPassword( userId:number ,  payload:ResetPasswordRequest ): Promise<void> {
  await api.post<void>( `${API_BASE}/${userId}/password`, payload );
}

import NO_USER_PROFILE_IMAGE from "@/assets/images/users/no-avatar.png";

export function getProfileImageUrl ( username :string | undefined ) {
  if ( !username ) {
    return NO_USER_PROFILE_IMAGE;
  }
  return `${import.meta.env.VITE_API_BASE_URL}/api/profile/${username}/avatar`;
}
 