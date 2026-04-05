# Remaining React Migration Plan

## Purpose

This document defines the remaining feature migration plan after the core `2.x` React runtime, shared infrastructure, and baseline page migrations were completed.

The goal is to migrate the remaining domain-specific Vue functionality into React without reopening the completed runtime migration work.

## Current Baseline

- The active `2.x` runtime is React-only.
- Shared runtime concerns are already migrated:
  - auth/session (`src/react/auth/`)
  - routing shell (`src/react/router/AppRouter.tsx`)
  - feedback providers (`src/react/feedback/`)
  - query adapters (`src/react/query/`)
  - AG Grid wrapper (`src/react/components/ag-grid/`)
- The following page groups are already migrated:
  - login (`src/react/pages/LoginPage.tsx`)
  - dashboard (`src/react/pages/DashboardPage.tsx`)
  - public community pages (`src/react/pages/community/`)
  - admin list pages (`src/react/pages/admin/` — `UsersPage`, `GroupsPage`, `RolesPage`)
  - document editor and preview (`src/react/pages/documents/`)
  - file list and upload (`src/react/pages/files/`)

### Established React Patterns

These patterns are already in use and must be followed in all new files:

- **API layer**: feature-local `api.ts` using `apiRequest` from `src/react/query/fetcher.ts`
- **Query keys**: feature-local `queryKeys.ts` using `createQueryKeys` from `src/react/query/keys.ts`
- **Paginated grids**: `ReactPageDataSource` subclass in feature-local `datasource.ts` (see `src/react/pages/admin/datasource.ts`)
- **Feedback**: `useToast`, `useConfirm` from `src/react/feedback/`
- **Auth state**: `useAuthStore` from `src/react/auth/store.ts`
- **Routing**: new routes registered in `src/react/router/AppRouter.tsx` or a feature sub-router

## Scope Principle

- Existing Vue files are treated as source material only.
- New implementation should be added as new React files under `src/react/**`.
- Do not reopen completed runtime migration concerns unless a remaining feature is blocked on them.
- Keep each migration track traceable, reviewable, and independently verifiable.

---

## Remaining Feature Inventory

### 1. Profile

| Vue source | Target React path |
|---|---|
| `src/views/studio/profile/MyProfilePage.vue` | `src/react/pages/profile/MyProfilePage.tsx` |

### 2. Admin Detail And Assignment Flows

| Vue source | Target React path |
|---|---|
| `src/views/studio/mgmt/security/UserPage.vue` | `src/react/pages/admin/users/UserDetailPage.tsx` |
| `src/views/studio/mgmt/security/GroupPage.vue` | `src/react/pages/admin/groups/GroupDetailPage.tsx` |
| `src/views/studio/mgmt/security/RolePage.vue` | `src/react/pages/admin/roles/RoleDetailPage.tsx` |
| `src/views/studio/mgmt/security/UserRolesDialog.vue` | `src/react/pages/admin/users/UserRolesDialog.tsx` |
| `src/views/studio/mgmt/security/GroupMembershipDialog.vue` | `src/react/pages/admin/groups/GroupMembershipDialog.tsx` |
| `src/views/studio/mgmt/security/GroupRolesDialog.vue` | `src/react/pages/admin/groups/GroupRolesDialog.tsx` |
| `src/views/studio/mgmt/security/RoleGrantedUserDialog.vue` | `src/react/pages/admin/roles/RoleGrantedUsersDialog.tsx` |
| `src/views/studio/mgmt/security/RoleGrantedGroupDialog.vue` | `src/react/pages/admin/roles/RoleGrantedGroupsDialog.tsx` |
| `src/views/studio/mgmt/security/UserSearchDialog.vue` | `src/react/pages/admin/UserSearchDialog.tsx` |
| `src/views/studio/mgmt/security/PasswordResetDialog.vue` | `src/react/pages/admin/users/PasswordResetDialog.tsx` |
| `src/views/studio/mgmt/security/GroupDialog.vue` | `src/react/pages/admin/groups/GroupDialog.tsx` |
| `src/views/studio/mgmt/security/RoleDialog.vue` | `src/react/pages/admin/roles/RoleDialog.tsx` |

### 3. ACL And Audit

| Vue source | Target React path |
|---|---|
| `src/views/studio/mgmt/security/acl/AclPage.vue` | `src/react/pages/acl/AclPage.tsx` |
| `src/views/studio/mgmt/security/acl/CreateClassDialog.vue` | `src/react/pages/acl/CreateClassDialog.tsx` |
| `src/views/studio/mgmt/security/acl/CreateEntryDialog.vue` | `src/react/pages/acl/CreateEntryDialog.tsx` |
| `src/views/studio/mgmt/security/acl/CreateObjectDialog.vue` | `src/react/pages/acl/CreateObjectDialog.tsx` |
| `src/views/studio/mgmt/security/acl/CreateSidDialog.vue` | `src/react/pages/acl/CreateSidDialog.tsx` |
| `src/views/studio/mgmt/audit/LoginFailureLogPage.vue` | `src/react/pages/audit/LoginFailureLogPage.tsx` |
| `src/views/studio/mgmt/application/forums/ForumAuditLogPage.vue` | `src/react/pages/forums/admin/ForumAuditLogPage.tsx` |

### 4. Content Management

| Vue source | Target React path |
|---|---|
| `src/views/studio/mgmt/application/document/DocumentListPage.vue` | `src/react/pages/documents/DocumentListPage.tsx` |
| `src/views/studio/mgmt/application/document/CreateDocumentDialog.vue` | `src/react/pages/documents/CreateDocumentDialog.tsx` |
| `src/views/studio/mgmt/application/files/FileDialog.vue` | `src/react/pages/files/FileDetailDialog.tsx` |
| `src/views/studio/mgmt/application/template/TemplatesPage.vue` | `src/react/pages/templates/TemplatesPage.tsx` |
| `src/views/studio/mgmt/application/template/TemplateDetails.vue` | `src/react/pages/templates/TemplateDetailsPage.tsx` |
| `src/views/studio/mgmt/application/template/CreateTemplateDialog.vue` | `src/react/pages/templates/CreateTemplateDialog.tsx` |
| `src/views/studio/mgmt/application/template/PreviewTemplateDialog.vue` | `src/react/pages/templates/PreviewTemplateDialog.tsx` |
| `src/views/studio/mgmt/policy/objecttype/ObjectTypeListPage.vue` | `src/react/pages/objecttype/ObjectTypeListPage.tsx` |
| `src/views/studio/mgmt/policy/objecttype/ObjectTypeDetailPage.vue` | `src/react/pages/objecttype/ObjectTypeDetailPage.tsx` |

### 5. Forum Management

| Vue source | Target React path |
|---|---|
| `src/views/studio/mgmt/application/forums/ForumListPage.vue` | `src/react/pages/forums/admin/ForumListPage.tsx` |
| `src/views/studio/mgmt/application/forums/ForumSettingsPage.vue` | `src/react/pages/forums/admin/ForumSettingsPage.tsx` |
| `src/views/studio/mgmt/application/forums/TopicDetailsPage.vue` | `src/react/pages/forums/admin/TopicDetailsPage.tsx` |
| `src/views/studio/mgmt/application/forums/ForumAclPage.vue` | `src/react/pages/forums/admin/ForumAclPage.tsx` |
| `src/views/studio/mgmt/application/forums/ForumCreateDialog.vue` | `src/react/pages/forums/admin/ForumCreateDialog.tsx` |
| `src/views/studio/mgmt/application/forums/ForumCategoryDialog.vue` | `src/react/pages/forums/admin/ForumCategoryDialog.tsx` |
| `src/views/studio/mgmt/application/forums/ForumMembershipDialog.vue` | `src/react/pages/forums/admin/ForumMembershipDialog.tsx` |
| `src/views/studio/mgmt/application/forums/ForumRoleMatrixGuide.vue` | `src/react/pages/forums/admin/ForumRoleMatrixGuide.tsx` |

### 6. Mail And Service Operations

| Vue source | Target React path |
|---|---|
| `src/views/studio/mgmt/application/mail/MailSyncPage.vue` | `src/react/pages/mail/MailSyncPage.tsx` |
| `src/views/studio/mgmt/application/mail/MailInboxPage.vue` | `src/react/pages/mail/MailInboxPage.tsx` |
| `src/views/studio/mgmt/application/mail/MailPage.vue` | `src/react/pages/mail/MailPage.tsx` |
| `src/views/studio/mgmt/services/objectstorage/ObjectStorageListPage.vue` | `src/react/pages/objectstorage/ObjectStorageListPage.tsx` |
| `src/views/studio/mgmt/services/objectstorage/ObjectStoragePage.vue` | `src/react/pages/objectstorage/ObjectStoragePage.tsx` |
| `src/views/studio/mgmt/services/objectstorage/ObjectDialog.vue` | `src/react/pages/objectstorage/ObjectDialog.tsx` |
| `src/views/studio/mgmt/services/ai/ChatPage.vue` | `src/react/pages/ai/ChatPage.tsx` |
| `src/views/studio/mgmt/services/ai/RagPage.vue` | `src/react/pages/ai/RagPage.tsx` |

---

## Recommended Migration Tracks

### Track A. Admin Detail Completion

**Scope:**
- Profile page
- User / Group / Role detail pages
- Assignment and membership dialogs
- Password reset and user search helpers

**Why first:**
- Directly extends the already-migrated admin list pages (`UsersPage`, `GroupsPage`, `RolesPage`).
- List-to-detail navigation (clicking a username in UsersPage) is already wired but currently has no destination.
- Closes the highest-frequency operational admin flows with minimal runtime risk.

**New routes to add** (in `AdminRoutes.tsx` and `AppRouter.tsx`):

```
/profile
/admin/users/:userId
/admin/groups/:groupId
/admin/roles/:roleId
```

**New files:**

```
src/react/pages/profile/
  MyProfilePage.tsx         ← GET/PATCH /api/self
  api.ts
  queryKeys.ts

src/react/pages/admin/
  UserSearchDialog.tsx      ← GET /api/mgmt/users (search, shared)

src/react/pages/admin/users/
  UserDetailPage.tsx        ← GET/PUT /api/mgmt/users/:userId
  UserRolesDialog.tsx       ← GET/POST/DELETE /api/mgmt/users/:userId/roles
  PasswordResetDialog.tsx   ← POST /api/mgmt/users/:userId/password
  api.ts
  queryKeys.ts

src/react/pages/admin/groups/
  GroupDetailPage.tsx       ← GET/PUT /api/mgmt/groups/:groupId
  GroupMembershipDialog.tsx ← GET/POST/DELETE /api/mgmt/groups/:groupId/members
  GroupRolesDialog.tsx      ← GET/POST/DELETE /api/mgmt/groups/:groupId/roles
  GroupDialog.tsx           ← POST /api/mgmt/groups (create)
  api.ts
  queryKeys.ts

src/react/pages/admin/roles/
  RoleDetailPage.tsx        ← GET/PUT /api/mgmt/roles/:roleId
  RoleGrantedUsersDialog.tsx  ← GET/POST/DELETE /api/mgmt/roles/:roleId/users
  RoleGrantedGroupsDialog.tsx ← GET/POST/DELETE /api/mgmt/roles/:roleId/groups
  RoleDialog.tsx            ← POST /api/mgmt/roles (create)
  api.ts
  queryKeys.ts
```

**Key API endpoints:**

| Endpoint | Usage |
|---|---|
| `GET /api/self` | Profile fetch |
| `PATCH /api/self` | Profile update |
| `GET /api/self/password-policy` | Password validation rules |
| `GET /api/mgmt/users/:userId` | User detail fetch |
| `PUT /api/mgmt/users/:userId` | User detail save |
| `POST /api/mgmt/users/:userId/password` | Admin password reset |
| `GET /api/mgmt/groups/:groupId` | Group detail |
| `PUT /api/mgmt/groups/:groupId` | Group update |
| `GET /api/mgmt/roles/:roleId` | Role detail |
| `PUT /api/mgmt/roles/:roleId` | Role update |

**Implementation notes:**

- `UserDetailPage`: form fields are `username` (read-only), `name`, `email`, `emailVisible`, `nameVisible`, `enabled`. Validation rules: username `^[a-z0-9._-]+$` 3-32 chars, name max 64, email format. The `properties` key-value grid is optional for first pass but the type `UserDto.properties: Record<string, any>` is already defined.
- `MyProfilePage`: two sections — (1) profile form (name, email, firstName, lastName), (2) auto-refresh preference stored in `localStorage`. The auth preference section is browser-local state only, no API call.
- `UserSearchDialog`: reusable across `GroupMembershipDialog` and `RoleGrantedUsersDialog`. Accepts an `onSelect` callback. Uses the existing `UsersDataSource` from `src/react/pages/admin/datasource.ts`.
- `PasswordResetDialog`: uses `GET /api/self/password-policy` (or `/api/mgmt/users/password-policy`) for validation checklist display. Password policy type `PasswordPolicyDto` is already defined in `src/types/studio/user.ts`.

**Acceptance goals:**
- React supports list-to-detail navigation for users, groups, and roles.
- Role/group membership and assignment flows work without Vue dialogs.
- Profile editing and password reset no longer depend on Vue pages.

---

### Track B. Content Management

**Scope:**
- Document list and create dialog
- File detail dialog
- Template list, detail, create, preview
- Object type list and detail

**Why second:**
- Builds directly on the already-migrated document editor (`DocumentEditorPage`) and file upload (`FilesPage`, `FileUploadDialog`).
- The document API adapter (`src/react/pages/documents/api.ts`) wrapping `documentApi` is already in place.

**New routes to add:**

```
/application/documents                        ← DocumentListPage
/application/templates                        ← TemplatesPage
/application/templates/:templateId            ← TemplateDetailsPage
/policy/object-types                          ← ObjectTypeListPage
/policy/object-types/:objectTypeId            ← ObjectTypeDetailPage
```

**New files:**

```
src/react/pages/documents/
  DocumentListPage.tsx        ← GET /api/mgmt/documents (paginated)
  CreateDocumentDialog.tsx    ← POST /api/mgmt/documents

src/react/pages/files/
  FileDetailDialog.tsx        ← GET /api/mgmt/files/:attachmentId, PATCH metadata

src/react/pages/templates/
  TemplatesPage.tsx           ← GET /api/mgmt/templates (paginated)
  TemplateDetailsPage.tsx     ← GET/PUT /api/mgmt/templates/:templateId
  CreateTemplateDialog.tsx    ← POST /api/mgmt/templates
  PreviewTemplateDialog.tsx   ← POST /api/mgmt/templates/:templateId/render/body
  api.ts                      ← wraps src/data/studio/mgmt/template.ts
  queryKeys.ts

src/react/pages/objecttype/
  ObjectTypeListPage.tsx      ← GET /api/mgmt/objecttypes (paginated)
  ObjectTypeDetailPage.tsx    ← GET/PUT /api/mgmt/objecttypes/:objectTypeId
  api.ts
  queryKeys.ts
```

**Key API endpoints:**

| Endpoint | Usage |
|---|---|
| `GET /api/mgmt/documents` | Document list (paginated) |
| `POST /api/mgmt/documents` | Create document |
| `GET/PUT /api/mgmt/templates/:id` | Template detail/update |
| `POST /api/mgmt/templates/:id/render/body` | Template preview |
| `POST /api/mgmt/templates/:id/render/subject` | Subject preview |
| `GET /api/mgmt/objecttypes` | Object type list |
| `GET/PUT /api/mgmt/objecttypes/:id` | Object type detail/update |

**Implementation notes:**

- `DocumentListPage`: use `ReactPageDataSource` subclass `DocumentsDataSource` with base URL `/api/mgmt/documents`. Clicking a document row navigates to `/application/documents/:documentId` (already handled by `DocumentEditorPage`).
- `TemplatesPage`: the existing `src/data/studio/mgmt/template.ts` functions (`createTemplate`, `updateTemplate`, `deleteTemplate`, `renderBody`, `renderSubject`) should be wrapped in a feature-local `api.ts` using `apiRequest`, following the pattern in `src/react/pages/documents/api.ts`.
- `PreviewTemplateDialog`: renders the template body/subject via POST. Render model input is a JSON key-value form.

**Acceptance goals:**
- Operators can browse and create documents in React.
- Template management works fully in React.
- Object type policy screens no longer depend on Vue.

---

### Track C. ACL And Audit

**Scope:**
- ACL management page (4-section grid UI)
- ACL creation dialogs (class, SID, object identity, entry)
- Login failure audit log page
- Forum audit log page

**Why third:**
- These flows are important but more specialized.
- The ACL page has the highest UI complexity (four independent AG Grid instances on a single page), so it benefits from admin and content patterns being stable first.

**New routes to add:**

```
/admin/acl                                    ← AclPage
/admin/audit/login-failures                   ← LoginFailureLogPage
/admin/forums/:forumSlug/audit                ← ForumAuditLogPage
```

**New files:**

```
src/react/pages/acl/
  AclPage.tsx                 ← orchestrates the four grid sections
  CreateClassDialog.tsx       ← POST /api/security/acl/admin/classes
  CreateSidDialog.tsx         ← POST /api/security/acl/admin/sids
  CreateObjectDialog.tsx      ← POST /api/security/acl/admin/objects
  CreateEntryDialog.tsx       ← POST /api/security/acl/admin/entries
  api.ts
  queryKeys.ts

src/react/pages/audit/
  LoginFailureLogPage.tsx     ← GET /api/mgmt/audit/login-failures (paginated)
  api.ts
  queryKeys.ts
```

**Key API endpoints (`/api/security/acl/admin`):**

| Endpoint | Usage |
|---|---|
| `GET /api/security/acl/admin/classes` | List ACL classes |
| `POST /api/security/acl/admin/classes` | Create class |
| `DELETE /api/security/acl/admin/classes/:id` | Delete class |
| `GET /api/security/acl/admin/sids` | List SIDs |
| `POST /api/security/acl/admin/sids` | Create SID |
| `DELETE /api/security/acl/admin/sids/:id` | Delete SID |
| `GET /api/security/acl/admin/objects` | List object identities |
| `POST /api/security/acl/admin/objects` | Create object identity |
| `DELETE /api/security/acl/admin/objects/:id` | Delete object identity |
| `GET /api/security/acl/admin/entries` | List ACL entries |
| `POST /api/security/acl/admin/entries` | Create entry |
| `DELETE /api/security/acl/admin/entries/:id` | Delete entry |
| `GET /api/security/acl/admin/actions` | List action mask definitions |

**Implementation notes:**

- `AclPage` has four independent AG Grid sections (classes, SIDs, objects, entries) on a single page. Each section has its own `useRef` for the grid, independent data load, and independent delete handler. Use React `useRef<AgGridReact>` per section — do not share a single grid ref.
- The "entries" grid uses a cell renderer that cross-references loaded object identity data (`objectByOid`) and action mask data (`actionByMask`). Both lookup maps must be loaded before the entries grid renders.
- `CreateEntryDialog` is the most complex dialog: it requires dropdowns populated from the already-loaded classes, SIDs, and objects data. Pass these as props from `AclPage`.
- The `AclObjectIdentityDto.objectIdIdentity` field accepts the special string value `"__root__"` in addition to numeric IDs. Render this distinctly in the objects grid.
- ACL types are fully defined in `src/types/studio/acl.ts`.

**Acceptance goals:**
- ACL management and audit lookup work in React.
- Security and audit operations no longer require Vue pages.

---

### Track D. Forum Management

**Scope:**
- Admin forum list, settings, topic details, and per-forum ACL
- Forum create, category, membership, and role matrix guide dialogs

**Why fourth:**
- Public community pages (`src/react/pages/community/`) are already migrated, so forum data types (`ForumResponse`, `TopicResponse`, etc.) and the public API pattern (`reactForumsPublicApi` in `src/react/pages/community/api.ts`) can be directly reused.
- Admin forum management adds settings and permission complexity and should remain a separate lane from the public-facing community work.

**New routes to add:**

```
/admin/forums                                 ← ForumListPage (admin)
/admin/forums/:forumSlug/settings             ← ForumSettingsPage
/admin/forums/:forumSlug/topics/:topicId      ← TopicDetailsPage (admin)
/admin/forums/:forumSlug/acl                  ← ForumAclPage
```

**New files:**

```
src/react/pages/forums/admin/
  ForumListPage.tsx           ← GET /api/mgmt/forums (paginated)
  ForumSettingsPage.tsx       ← GET/PUT /api/mgmt/forums/:slug/settings
  TopicDetailsPage.tsx        ← GET /api/mgmt/forums/:slug/topics/:id
  ForumAclPage.tsx            ← GET/POST/PUT/DELETE /api/mgmt/forums/:slug/permissions
  ForumCreateDialog.tsx       ← POST /api/mgmt/forums
  ForumCategoryDialog.tsx     ← POST/DELETE /api/mgmt/forums/:slug/categories
  ForumMembershipDialog.tsx   ← GET/POST/PATCH/DELETE /api/mgmt/forums/:slug/members
  ForumRoleMatrixGuide.tsx    ← static role permission matrix display
  ForumAuditLogPage.tsx       ← GET /api/mgmt/forums/:slug/audit (paginated)
  api.ts                      ← wraps forumsAdminApi from src/data/studio/mgmt/forums.ts
  queryKeys.ts
```

**Key API endpoints:**

| Endpoint | Usage |
|---|---|
| `GET /api/mgmt/forums` | Admin forum list |
| `POST /api/mgmt/forums` | Create forum |
| `GET/PUT /api/mgmt/forums/:slug/settings` | Settings fetch/save (ETag-based) |
| `GET /api/mgmt/forums/:slug/permissions` | List ACL rules |
| `POST/PUT/DELETE /api/mgmt/forums/:slug/permissions/:ruleId` | Manage ACL rules |
| `GET /api/mgmt/forums/:slug/members` | Member list |
| `POST/PATCH/DELETE /api/mgmt/forums/:slug/members/:userId` | Manage members |
| `PATCH /api/mgmt/forums/:slug/topics/:topicId/status` | Change topic status |
| `PATCH /api/mgmt/forums/:slug/topics/:topicId/pin` | Pin topic |
| `PATCH /api/mgmt/forums/:slug/topics/:topicId/lock` | Lock topic |

**Implementation notes:**

- `forumsAdminApi` in `src/data/studio/mgmt/forums.ts` is the canonical API object. Wrap it in a feature-local `api.ts` using the same pattern as `src/react/pages/documents/api.ts` (thin re-export with explicit return types).
- `ForumSettingsPage` uses ETag-based optimistic concurrency: load the ETag with the settings fetch, then send `If-Match` header on save. The `forumsAdminApi.getForum` and `updateForumSettings` methods already handle ETag extraction from response headers.
- `ForumRoleMatrixGuide` is a pure display component. The `rolePermissionsMatrix` and `ROLE_PERMISSION_ACTIONS` constants are already exported from `src/data/studio/mgmt/forums.ts` and can be imported directly.
- `ForumAclPage`: the `listPermissionActions` call returns available `PermissionActionMetadata[]` for the action dropdown in the create/edit rule form.

**Acceptance goals:**
- Admin forum operations work fully in React.
- Public and admin forum experiences share React-side data and UI patterns where appropriate.

---

### Track E. Mail And Service Operations

**Scope:**
- Mail sync, inbox, and detail pages
- Object storage provider and bucket/object browser
- AI chat and RAG pages

**Why last:**
- These flows are operationally specialized and interaction-heavy (SSE stream for mail sync, presigned URL lifecycle for object storage, streaming responses for AI chat).
- They are good candidates for dedicated, isolated validation because of API and state complexity.

**New routes to add:**

```
/application/mail                             ← MailPage (layout/index)
/application/mail/sync                        ← MailSyncPage
/application/mail/inbox                       ← MailInboxPage
/services/object-storage                      ← ObjectStorageListPage
/services/object-storage/:providerId          ← ObjectStoragePage (bucket/object browser)
/services/ai/chat                             ← ChatPage
/services/ai/rag                              ← RagPage
```

**New files:**

```
src/react/pages/mail/
  MailPage.tsx                ← layout wrapper with sub-navigation
  MailSyncPage.tsx            ← POST /api/mgmt/mail/sync + SSE /api/mgmt/mail/sync/stream
  MailInboxPage.tsx           ← GET /api/mgmt/mail (paginated)
  api.ts
  queryKeys.ts

src/react/pages/objectstorage/
  ObjectStorageListPage.tsx   ← GET /api/mgmt/objectstorage/providers
  ObjectStoragePage.tsx       ← GET /api/mgmt/objectstorage/providers/:id/buckets/:bucket/objects
  ObjectDialog.tsx            ← object detail + presigned URL generation
  api.ts                      ← wraps src/data/studio/mgmt/storage.ts
  queryKeys.ts

src/react/pages/ai/
  ChatPage.tsx                ← POST /api/ai/chat
  RagPage.tsx                 ← POST /api/ai/chat/rag + POST /api/ai/vectors/search
  api.ts
  queryKeys.ts
```

**Key implementation notes:**

- **MailSyncPage SSE**: `subscribeMailSync` in `src/data/studio/mgmt/mail.ts` uses `EventSourcePolyfill` with the JWT `Authorization` header. In React, manage the subscription in a `useEffect` with cleanup. The SSE event name is `"mail-sync"` and delivers `MailSyncLogDto` payloads.
- **ObjectStoragePage**: uses a prefix-based folder navigation model. `buildBreadcrumb` and `toRows` helpers are already implemented in `src/data/studio/mgmt/storage.ts` and can be imported directly. The `hasMore` helper handles pagination token detection.
- **AI pages**: `src/data/studio/public/ai.ts` contains a Vue `ref` for caching providers — this cannot be imported directly in React. The `api.ts` for `src/react/pages/ai/` must re-implement provider fetching using `apiRequest` without the Vue ref cache.
- **ObjectDialog**: generates a presigned download URL via `presignGet` and a presigned inline view URL. Uses the existing `downloadFile` and `openInNewTab` helpers from `src/data/studio/mgmt/storage.ts` after verifying they have no Vue dependencies (they do not).

**Acceptance goals:**
- Mail operational workflows work in React.
- Object storage and AI operations no longer depend on Vue pages.

---

## Recommended Execution Order

Use the remaining work in parallel waves instead of a single sequential queue.

### Wave 0. Shared Wiring And Registration Rules

**Owner scope:**
- route registration ownership in `src/react/router/AppRouter.tsx`
- admin sub-route ownership in `src/react/router/AdminRoutes.tsx`
- shared admin helper ownership (`src/react/pages/admin/UserSearchDialog.tsx`)

**Why first:**
- `Track A` and `Track C` both need admin route additions.
- shared route ownership should be settled before multiple branches start editing the same files.

**Verify:**
```
# route tree remains explicit and conflict-free
# shared admin search dialog location and reuse rule are agreed
```

### Wave 1. First Parallel Delivery Set

Run these lanes in parallel after Wave 0:

1. Admin users/profile lane
2. Admin groups lane
3. Admin roles lane
4. Documents lane
5. Templates lane
6. Object types + file detail lane
7. Audit pages lane
8. ACL core lane start (page shell and lookup loading)

### Wave 2. Second Parallel Delivery Set

Run these after the first set stabilizes:

1. ACL core dialog completion
2. Forum admin lane

### Wave 3. Final Specialized Delivery Set

Run these last with isolated validation:

1. Mail lane
2. Object storage lane
3. AI chat / RAG lane
4. Final integration and legacy cleanup lane

---

## Proposed Issue Registration Set

Create one umbrella issue and a parallelizable set of child issues.

### Umbrella Issue

1. `React remaining migration umbrella`
   - Size: `Large`
   - Purpose: track all remaining child issues, route ownership, final integration, and validation closure

### Parallel Child Issues

#### Admin lanes

1. `React admin users and profile`
   - Suggested branch: `feature/react-admin-users-profile`
   - Deliverables:
     - `/profile`
     - `UserDetailPage`
     - `UserRolesDialog`
     - `PasswordResetDialog`
   - Validation:
   ```
   # navigate to /admin/users, click a username → UserDetailPage loads
   # edit name/email → save → changes persist
   # open Roles dialog from UserDetailPage → assign/remove role
   # open Password Reset dialog → reset works
   # navigate to /profile → profile form loads, save works
   ```

2. `React admin groups`
   - Suggested branch: `feature/react-admin-groups`
   - Deliverables:
     - `GroupDetailPage`
     - `GroupMembershipDialog`
     - `GroupRolesDialog`
     - `GroupDialog`
   - Validation:
   ```
   # /admin/groups/:groupId → detail loads
   # membership add/remove works
   # group role assignment works
   ```

3. `React admin roles`
   - Suggested branch: `feature/react-admin-roles`
   - Deliverables:
     - `RoleDetailPage`
     - `RoleGrantedUsersDialog`
     - `RoleGrantedGroupsDialog`
     - `RoleDialog`
   - Validation:
   ```
   # /admin/roles/:roleId → detail loads
   # granted users/groups add/remove works
   # role create dialog works
   ```

4. `React admin shared wiring`
   - Suggested branch: `feature/react-admin-shared-wiring`
   - Deliverables:
     - `UserSearchDialog`
     - route additions in `AdminRoutes.tsx` / `AppRouter.tsx`
     - shared export/import cleanup for admin lanes
   - Validation:
   ```
   # admin detail routes are registered without collisions
   # shared user search dialog is reusable from group/role flows
   ```

#### Content lanes

5. `React documents list and create`
   - Suggested branch: `feature/react-documents-list`
   - Deliverables:
     - `DocumentListPage`
     - `CreateDocumentDialog`
   - Validation:
   ```
   # /application/documents → list renders
   # create dialog opens and new document navigates to editor
   ```

6. `React templates management`
   - Suggested branch: `feature/react-templates`
   - Deliverables:
     - `TemplatesPage`
     - `TemplateDetailsPage`
     - `CreateTemplateDialog`
     - `PreviewTemplateDialog`
   - Validation:
   ```
   # /application/templates → list renders
   # template CRUD works
   # preview dialog renders body/subject
   ```

7. `React object types and file detail`
   - Suggested branch: `feature/react-content-policy-files`
   - Deliverables:
     - `ObjectTypeListPage`
     - `ObjectTypeDetailPage`
     - `FileDetailDialog`
   - Validation:
   ```
   # /policy/object-types → list and detail render
   # file detail dialog loads and metadata update works
   ```

#### Security and audit lanes

8. `React ACL core`
   - Suggested branch: `feature/react-acl-core`
   - Deliverables:
     - `AclPage`
     - `CreateClassDialog`
     - `CreateSidDialog`
     - `CreateObjectDialog`
     - `CreateEntryDialog`
   - Validation:
   ```
   # /admin/acl → all four grids load
   # create/delete class, SID, object, entry refreshes the correct grid
   ```

9. `React audit pages`
   - Suggested branch: `feature/react-audit-pages`
   - Deliverables:
     - `LoginFailureLogPage`
     - `ForumAuditLogPage`
   - Validation:
   ```
   # /admin/audit/login-failures → paginated log renders
   # /admin/forums/:forumSlug/audit → paginated log renders
   ```

#### Forum and service lanes

10. `React forum admin`
    - Suggested branch: `feature/react-forum-admin`
    - Deliverables:
      - `ForumListPage`
      - `ForumSettingsPage`
      - `TopicDetailsPage`
      - `ForumAclPage`
      - `ForumCreateDialog`
      - `ForumCategoryDialog`
      - `ForumMembershipDialog`
      - `ForumRoleMatrixGuide`
    - Validation:
    ```
    # /admin/forums → list loads, create dialog works
    # /admin/forums/:slug/settings → loads, save with ETag works
    # /admin/forums/:slug/acl → permission rules load, CRUD works
    # role matrix guide renders correctly
    ```

11. `React mail, object storage, and AI services`
    - Suggested branch: `feature/react-service-ops`
    - Deliverables:
      - `MailPage`, `MailSyncPage`, `MailInboxPage`
      - `ObjectStorageListPage`, `ObjectStoragePage`, `ObjectDialog`
      - `ChatPage`, `RagPage`
    - Validation:
    ```
    # /application/mail/sync → trigger sync, SSE events appear in real time
    # /services/object-storage → provider list renders
    # /services/object-storage/:providerId → bucket/object browser, download works
    # /services/ai/chat → send message, receive response
    # /services/ai/rag → vector search and RAG chat work
    ```

12. `React final integration and legacy cleanup`
    - Suggested branch: `refactor/react-migration-finalize`
    - Deliverables:
      - final route merge
      - final validation pass
      - delete only Vue files directly superseded by merged React features
    - Validation:
    ```
    # build/test/manual verification pass after all feature branches merge
    # only directly replaced Vue files are removed
    ```

### Registration Notes

- Use `.gitlab/issue_templates/default.md` for each issue.
- Mark the umbrella issue as `Large`.
- Mark most child issues as `Medium`.
- `React admin shared wiring` can be `Small` if kept limited to route and shared dialog registration.
- Set `AI-Assisted` to `Yes` for all of the above if AI is used for drafting, analysis, implementation, or validation planning.
- Register the umbrella issue first, then link the child issues from it.

---

## Implementation Rules

- Create new React files instead of editing legacy Vue files in place.
- Reuse existing React runtime patterns:
  - `src/react/query/**` for fetching and caching
  - `src/react/feedback/**` for toast and confirm dialogs
  - `src/react/components/ag-grid/**` for paginated grids
  - `src/react/auth/**` for auth state
- Prefer feature-local `api.ts` and `queryKeys.ts` modules for each new React page group.
- When a Vue file uses a function from `src/data/studio/**`, check whether that function has Vue-specific dependencies (`ref`, `reactive`, `computed`). If not, import it directly. If yes, re-implement in the feature-local `api.ts` using `apiRequest`.
- Keep URL compatibility decisions explicit; do not silently change route shapes while migrating behavior.
- ETag-based endpoints: always extract the ETag from the response and pass it back as `If-Match` on updates. The `api.getWithMeta` / `api.putWithMeta` / `api.patchWithMeta` pattern is established in the Vue-era API files.

## Residual Legacy Strategy

- Keep the remaining Vue files as reference during migration.
- After each track is merged, delete only the Vue files that are fully superseded by the new React implementation.
- Do not mix "feature migration" and "broad legacy deletion" in the same change set unless the deletion is directly traceable to the migrated feature.
