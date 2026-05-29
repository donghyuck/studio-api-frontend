import type { SkillGraphRole } from "@/types/studio/skillgraph";

export const SKILLGRAPH_ROLES: SkillGraphRole[] = [
  "ROLE_SKILLGRAPH_VIEWER",
  "ROLE_SKILLGRAPH_OPERATOR",
  "ROLE_SKILLGRAPH_REVIEWER",
  "ROLE_SKILLGRAPH_ADMIN",
  "ROLE_ADMIN",
  "ROLE_DEVELOPER",
];

function hasPlatformAdminRole(userRoles: string[] | undefined) {
  return Boolean(
    userRoles?.includes("ROLE_ADMIN") ||
      userRoles?.includes("ROLE_DEVELOPER")
  );
}

export function hasAnySkillGraphRole(userRoles: string[] | undefined) {
  return SKILLGRAPH_ROLES.some((role) => userRoles?.includes(role));
}

export function canRunSkillGraphOperations(userRoles: string[] | undefined) {
  return Boolean(
    hasPlatformAdminRole(userRoles) ||
    userRoles?.includes("ROLE_SKILLGRAPH_OPERATOR") ||
      userRoles?.includes("ROLE_SKILLGRAPH_ADMIN")
  );
}

export function canReviewSkillGraph(userRoles: string[] | undefined) {
  return Boolean(
    hasPlatformAdminRole(userRoles) ||
    userRoles?.includes("ROLE_SKILLGRAPH_REVIEWER") ||
      userRoles?.includes("ROLE_SKILLGRAPH_ADMIN")
  );
}

export function canAdminSkillGraph(userRoles: string[] | undefined) {
  return Boolean(
    hasPlatformAdminRole(userRoles) ||
      userRoles?.includes("ROLE_SKILLGRAPH_ADMIN")
  );
}
