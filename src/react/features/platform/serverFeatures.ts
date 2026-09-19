export type ServerFeatures = Readonly<Record<string, boolean>>;

const routes: ReadonlyArray<readonly [string, string]> = [
  ["/admin/audit/attachment-download-links", "attachment-audit"],
  ["/admin/audit/login-failures", "login-audit"],
  ["/services/ai/vector-visualization", "ai-vector-visualization"],
  ["/services/ai/rag-visualization", "ai-vector-visualization"],
  ["/services/ai/rag-chat", "ai-chat"],
  ["/services/ai/rag", "ai-rag"],
  ["/services/ai/chat", "ai-chat"],
  ["/services/object-storage", "objectstorage"],
  ["/application/files", "attachment"],
  ["/application/workspaces", "workspace"],
  ["/application/mail", "mail"],
  ["/application/documents", "document"],
  ["/application/templates", "template"],
  ["/admin/teams", "team"],
  ["/admin/users", "user"],
  ["/admin/groups", "group"],
  ["/admin/roles", "role"],
  ["/admin/companies", "company"],
  ["/admin/forums", "forum"],
  ["/admin/acl", "acl"],
  ["/policy/object-types", "objecttype"],
];

export function routeFeature(path: string): string | undefined {
  return routes.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[1];
}

export function supportsRoute(path: string, features: ServerFeatures): boolean {
  const feature = routeFeature(path);
  return !feature || features[feature] === true;
}
