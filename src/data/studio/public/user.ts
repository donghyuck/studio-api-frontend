import { api } from "@/data/http";
import type { UserPublicDto } from "@/types/studio/user";
import NO_USER_PROFILE_IMAGE from "@/assets/images/users/no-avatar.png";

export const PUBLIC_USER_BASE = "/api/users";

export const usersPublicApi = {
  async getUserByUsername(username: string) {
    return api.get<UserPublicDto>(`${PUBLIC_USER_BASE}/${encodeURIComponent(username)}`);
  },

  async getUserById(id: number | string) {
    return api.get<UserPublicDto>(`${PUBLIC_USER_BASE}/${id}`, {
      params: { byId: true },
    });
  },
};

export function getProfileImageUrl(usernameOrId: string | number | undefined) {
  if (usernameOrId == null) {
    return NO_USER_PROFILE_IMAGE;
  }
  if (typeof usernameOrId === "number") {
    if (usernameOrId <= 0) {
      return NO_USER_PROFILE_IMAGE;
    }
    return `${import.meta.env.VITE_API_BASE_URL}/api/profile/${usernameOrId}/avatar?byId`;
  }
  const identifier = usernameOrId.trim();
  if (!identifier) {
    return NO_USER_PROFILE_IMAGE;
  }
  return `${import.meta.env.VITE_API_BASE_URL}/api/profile/${encodeURIComponent(
    identifier
  )}/avatar`;
}
