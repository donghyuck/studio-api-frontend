import type { ResetPasswordRequest, UserBasicDto } from "@/types/studio/user";
import { api } from "@/utils/http";
 
const API_BASE = "/api/mgmt/users";

export async function resetPassword( userId:number ,  payload:ResetPasswordRequest ): Promise<void> {
  await api.post<void>( `${API_BASE}/${userId}/password`, payload );
}

import NO_USER_PROFILE_IMAGE from "@/assets/images/users/no-avatar.png";

export function getProfileImageUrl(usernameOrId: string | number | undefined) {
  if (usernameOrId == null) {
    return NO_USER_PROFILE_IMAGE;
  }
  if (typeof usernameOrId === "number") {
    if (usernameOrId <= 0) {
      return NO_USER_PROFILE_IMAGE;
    }
    return `${import.meta.env.VITE_API_BASE_URL}/api/profile/${usernameOrId}/avatar`;
  }
  const identifier = usernameOrId.trim();
  if (!identifier) {
    return NO_USER_PROFILE_IMAGE;
  }
  return `${import.meta.env.VITE_API_BASE_URL}/api/profile/${encodeURIComponent(
    identifier
  )}/avatar`;
}
export async function getUserBasic( userId:number): Promise<UserBasicDto> {
  const basic = await api.get<UserBasicDto>( `${API_BASE}/basic/${userId}` );
  return basic;
}