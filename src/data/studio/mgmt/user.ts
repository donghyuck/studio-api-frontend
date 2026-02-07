import type { ResetPasswordRequest, UserBasicDto } from "@/types/studio/user";
import { api } from "@/data/http";
 
const API_BASE = "/api/mgmt/users";

export async function resetPassword( userId:number ,  payload:ResetPasswordRequest ): Promise<void> {
  await api.post<void>( `${API_BASE}/${userId}/password`, payload );
}

export async function getUserBasicByUserId( userId:number): Promise<UserBasicDto> {
  const basic = await api.get<UserBasicDto>( `${API_BASE}/basic/${userId}` );
  return basic;
}
