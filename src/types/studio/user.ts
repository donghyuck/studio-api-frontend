export interface ResetPasswordRequest {
    currentPassword:string;
    newPassword:string;
    reason?: string | null;
}

export type UserStatus = string;

export interface UserBasicDto {
  userId?: number;
  username?: string;
  name?: string;
  email?: string | null;
  enabled: boolean;
  status?: UserStatus | null;
}

export interface UserPublicDto {
  userId?: number;
  username?: string;
  name?: string;
  email?: string | null;
}

export interface UserDto {
  userId: number;
  username: string;
  name: string;
  email?: string;
  emailVisble: boolean;
  nameVisible: boolean;
  enabled: boolean;
  creationDate: Date | null;
  modifiedDate: Date | null;
  properties?: Record<string, any>;
}
const _EMPTY_USER: UserDto = {
  userId: 0,
  username: "",
  name: "",
  email: "",
  emailVisble: true,
  nameVisible: true,
  enabled: true,
  creationDate: null,
  modifiedDate: null,
  properties: {},
};
export const EMPTY_USER: Readonly<UserDto> = Object.freeze(_EMPTY_USER);
