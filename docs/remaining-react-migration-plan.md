# Remaining React Migration Plan

## Purpose

This document defines the remaining feature migration plan after the core `2.x` React runtime, shared infrastructure, and baseline page migrations were completed.

The goal is to migrate the remaining domain-specific Vue functionality into React without reopening the completed runtime migration work.

## Current Baseline

- The active `2.x` runtime is React-only.
- Shared runtime concerns are already migrated:
  - auth/session
  - routing shell
  - feedback providers
  - query adapters
  - AG Grid wrapper
- The following page groups are already migrated:
  - login
  - dashboard
  - public community pages
  - admin list pages (`users`, `groups`, `roles`)
  - document editor and preview
  - file list and upload

## Scope Principle

- Existing Vue files are treated as source material only.
- New implementation should be added as new React files under `src/react/**`.
- Do not reopen completed runtime migration concerns unless a remaining feature is blocked on them.
- Keep each migration track traceable, reviewable, and independently verifiable.

## Remaining Feature Inventory

### 1. Profile

- `src/views/studio/profile/MyProfilePage.vue`

### 2. Admin Detail And Assignment Flows

- `src/views/studio/mgmt/security/UserPage.vue`
- `src/views/studio/mgmt/security/GroupPage.vue`
- `src/views/studio/mgmt/security/RolePage.vue`
- `src/views/studio/mgmt/security/UserRolesDialog.vue`
- `src/views/studio/mgmt/security/GroupMembershipDialog.vue`
- `src/views/studio/mgmt/security/GroupRolesDialog.vue`
- `src/views/studio/mgmt/security/RoleGrantedUserDialog.vue`
- `src/views/studio/mgmt/security/RoleGrantedGroupDialog.vue`
- `src/views/studio/mgmt/security/UserSearchDialog.vue`
- `src/views/studio/mgmt/security/PasswordResetDialog.vue`
- `src/views/studio/mgmt/security/GroupDialog.vue`
- `src/views/studio/mgmt/security/RoleDialog.vue`

### 3. ACL And Audit

- `src/views/studio/mgmt/security/acl/AclPage.vue`
- `src/views/studio/mgmt/security/acl/CreateClassDialog.vue`
- `src/views/studio/mgmt/security/acl/CreateEntryDialog.vue`
- `src/views/studio/mgmt/security/acl/CreateObjectDialog.vue`
- `src/views/studio/mgmt/security/acl/CreateSidDialog.vue`
- `src/views/studio/mgmt/audit/LoginFailureLogPage.vue`
- `src/views/studio/mgmt/application/forums/ForumAuditLogPage.vue`

### 4. Content Management

- Documents
  - `src/views/studio/mgmt/application/document/DocumentListPage.vue`
  - `src/views/studio/mgmt/application/document/CreateDocumentDialog.vue`
- Files
  - `src/views/studio/mgmt/application/files/FileDialog.vue`
- Templates
  - `src/views/studio/mgmt/application/template/TemplatesPage.vue`
  - `src/views/studio/mgmt/application/template/TemplateDetails.vue`
  - `src/views/studio/mgmt/application/template/CreateTemplateDialog.vue`
  - `src/views/studio/mgmt/application/template/PreviewTemplateDialog.vue`
- Object types
  - `src/views/studio/mgmt/policy/objecttype/ObjectTypeListPage.vue`
  - `src/views/studio/mgmt/policy/objecttype/ObjectTypeDetailPage.vue`

### 5. Forum Management

- `src/views/studio/mgmt/application/forums/ForumListPage.vue`
- `src/views/studio/mgmt/application/forums/ForumSettingsPage.vue`
- `src/views/studio/mgmt/application/forums/TopicDetailsPage.vue`
- `src/views/studio/mgmt/application/forums/ForumAclPage.vue`
- `src/views/studio/mgmt/application/forums/ForumCreateDialog.vue`
- `src/views/studio/mgmt/application/forums/ForumCategoryDialog.vue`
- `src/views/studio/mgmt/application/forums/ForumMembershipDialog.vue`
- `src/views/studio/mgmt/application/forums/ForumRoleMatrixGuide.vue`

### 6. Mail And Service Operations

- Mail
  - `src/views/studio/mgmt/application/mail/MailSyncPage.vue`
  - `src/views/studio/mgmt/application/mail/MailInboxPage.vue`
  - `src/views/studio/mgmt/application/mail/MailPage.vue`
- Object storage
  - `src/views/studio/mgmt/services/objectstorage/ObjectStorageListPage.vue`
  - `src/views/studio/mgmt/services/objectstorage/ObjectStoragePage.vue`
  - `src/views/studio/mgmt/services/objectstorage/ObjectDialog.vue`
- AI services
  - `src/views/studio/mgmt/services/ai/ChatPage.vue`
  - `src/views/studio/mgmt/services/ai/RagPage.vue`

## Recommended Migration Tracks

### Track A. Admin Detail Completion

Scope:
- profile page
- user/group/role detail pages
- assignment and membership dialogs
- password reset and search helpers

Why first:
- It extends the already-migrated admin list pages.
- It closes the highest-frequency operational admin flows with minimal runtime risk.

Acceptance goals:
- React supports list-to-detail navigation for users, groups, and roles.
- Role/group membership and assignment flows work without Vue dialogs.
- Profile editing and password reset no longer depend on Vue pages.

### Track B. Content Management

Scope:
- document list/create
- file detail
- templates list/detail/create/preview
- object type list/detail

Why second:
- It builds directly on the already-migrated document editor and file upload flows.
- It closes major content management flows with shared grid and dialog patterns.

Acceptance goals:
- Operators can browse and create documents in React.
- Template management works fully in React.
- Object type policy screens no longer depend on Vue.

### Track C. ACL And Audit

Scope:
- ACL page and creation dialogs
- login failure audit
- forum audit log

Why third:
- These flows are important but more specialized.
- They depend on admin completion patterns but should remain isolated from broader content work.

Acceptance goals:
- ACL management and audit lookup work in React.
- Security and audit operations no longer require Vue pages.

### Track D. Forum Management

Scope:
- admin forum list/settings/topic details/ACL
- forum create/category/membership/guide dialogs

Why fourth:
- Public community pages are already migrated, so forum display patterns can be reused.
- Admin forum management adds more settings and permission complexity and should remain a separate lane.

Acceptance goals:
- Admin forum operations work fully in React.
- Public and admin forum experiences share React-side data and UI patterns where appropriate.

### Track E. Mail And Service Operations

Scope:
- mail sync/inbox/detail
- object storage management
- AI service pages

Why last:
- These flows appear more operationally specialized and interaction-heavy.
- They are good candidates for dedicated, isolated validation because of API and state complexity.

Acceptance goals:
- Mail operational workflows work in React.
- Object storage and AI operations no longer depend on Vue pages.

## Recommended Execution Order

1. Track A. Admin Detail Completion
2. Track B. Content Management
3. Track C. ACL And Audit
4. Track D. Forum Management
5. Track E. Mail And Service Operations

## Proposed Issue Breakdown

### Issue 1. React admin detail and assignment flows

Suggested branch:
- `feature/react-admin-detail-flows`

Suggested outcome:
- Complete profile, user/group/role detail, and assignment dialogs in React.

### Issue 2. React content management pages

Suggested branch:
- `feature/react-content-management`

Suggested outcome:
- Complete document list/create, file detail, template management, and object type pages in React.

### Issue 3. React ACL and audit pages

Suggested branch:
- `feature/react-acl-audit`

Suggested outcome:
- Complete ACL and audit operations in React.

### Issue 4. React forum management pages

Suggested branch:
- `feature/react-forum-management`

Suggested outcome:
- Complete admin forum management in React.

### Issue 5. React mail and service operations

Suggested branch:
- `feature/react-mail-service-ops`

Suggested outcome:
- Complete mail, object storage, and AI service operations in React.

## Implementation Rules

- Create new React files instead of editing legacy Vue files in place.
- Reuse existing React runtime patterns:
  - `src/react/query/**`
  - `src/react/feedback/**`
  - `src/react/components/ag-grid/**`
  - `src/react/auth/**`
- Prefer feature-local `api.ts` and `queryKeys.ts` modules for each new React page group.
- Keep URL compatibility decisions explicit; do not silently change route shapes while migrating behavior.
- Record validation commands for each track.

## Residual Legacy Strategy

- Keep the remaining Vue files as reference during migration.
- After each track is merged, delete only the Vue files that are fully superseded by the new React implementation.
- Do not mix “feature migration” and “broad legacy deletion” in the same change set unless the deletion is directly traceable to the migrated feature.
