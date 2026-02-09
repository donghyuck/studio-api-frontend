export interface ResetPasswordRequest {
    currentPassword:string;
    newPassword:string;
    reason?: string | null;
}

export interface PasswordPolicyDto {
  minLength: number;
  maxLength: number;
  requireUpper: boolean;
  requireLower: boolean;
  requireDigit: boolean;
  requireSpecial: boolean;
  allowedSpecials?: string | null;
  allowWhitespace: boolean;
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

export interface MeProfileDto {
  userId: number;
  username: string;
  name: string;
  email?: string | null;
  enabled?: boolean;
  roles?: string[];
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface MeProfilePatchRequest {
  name?: string;
  email?: string | null;
  emailVisible?: boolean;
  nameVisible?: boolean;
  firstName?: string | null;
  lastName?: string | null;
  properties?: Record<string, string>;
}
