# React Migration Plan for `2.x`

## Purpose

This document defines the working rules and migration plan for converting the current Vue-based frontend into a React-based frontend on the `2.x` line.

## Current Assessment

- The current application is built on Vue 3, Vite, TypeScript, Vuetify, Pinia, and Vue Router.
- The project contains a large number of Vue single-file components and Vue-specific dependencies.
- Because of this, the move to React is not a small refactor. It should be treated as a major-version migration.

## Assumptions

- `main` remains the stable Vue line during migration.
- `2.x` is the integration branch for the React migration.
- Actual implementation work is done on `feature/*` branches created from `2.x`.
- Existing backend APIs remain reusable unless a separate backend change is explicitly planned.
- The migration should minimize unrelated refactors and keep each change traceable.

## Branch Strategy

### Roles

- `main`
  - Stable Vue maintenance line
- `2.x`
  - React migration integration line
- `feature/*`
  - Working branches created from `2.x`

### Recommended Branch Names

- `feature/react-bootstrap`
- `feature/react-routing`
- `feature/react-auth`
- `feature/react-layout`
- `feature/react-shared-components`
- `feature/react-forum-pages`
- `feature/react-admin-pages`

### Operating Rules

- Do not accumulate unfinished work directly on `2.x` unless there is a strong reason.
- Merge reviewed, scoped work from `feature/*` into `2.x`.
- Keep each branch limited to one migration concern.
- Record validation results for every AI-assisted change.

## Migration Scope

### Included

- Frontend framework migration from Vue to React
- Routing replacement
- State management replacement
- UI component strategy replacement
- Page-by-page migration

### Excluded Unless Explicitly Requested

- Backend API redesign
- Unrelated domain refactors
- Feature expansion beyond parity
- Design-system overhaul without migration need

## Recommended Technical Direction

- Build tool: keep Vite
- Framework: React + TypeScript
- Routing: React Router
- Server state: TanStack Query
- Client state: lightweight local store only where needed
- Forms: React Hook Form
- Grid: AG Grid React
- Rich text editor: Tiptap React

## Migration Phases

### Phase 1. Bootstrap

Goal:
- Establish the React app baseline on `2.x`

Work:
- Add React runtime and build dependencies
- Create React entry point
- Define initial project structure
- Keep the setup minimal and migration-focused

Verify:
- `npm run build`
- React app mounts successfully

### Phase 2. Routing and Shell

Goal:
- Rebuild the application shell and base routes

Work:
- Introduce React Router
- Recreate blank/full layout structure
- Implement 404 and unauthorized routes

Verify:
- Route transitions work
- Base layout renders without runtime errors

### Phase 3. Auth and API Foundation

Goal:
- Recreate authentication and shared API behavior

Work:
- Port axios configuration
- Rebuild token refresh and session restore logic
- Rebuild protected-route behavior

Verify:
- Login succeeds
- Refresh flow works
- Protected routes redirect correctly

### Phase 4. Shared UI and State

Goal:
- Rebuild reusable app infrastructure needed by pages

Work:
- Recreate toast, confirm, dialog, and shared utility behavior
- Recreate shared table/grid wrappers only where needed
- Introduce state strategy with clear boundaries

Verify:
- Shared components render and behave correctly
- No page depends on removed Vue runtime objects

### Phase 5. Page-by-Page Migration

Goal:
- Move user-facing pages incrementally

Suggested order:
1. Auth pages
2. Dashboard
3. Public community pages
4. Admin/security pages
5. Remaining management pages

Verify:
- Manual smoke test per migrated page
- No broken navigation to migrated areas
- Core page scenarios complete successfully

### Phase 6. Vue Dependency Removal

Goal:
- Remove Vue runtime and unused Vue-specific packages when parity is sufficient

Work:
- Delete obsolete Vue entry files
- Remove Vue-only dependencies
- Remove dead code created by the migration

Verify:
- `npm run build`
- `npm run lint`
- Application runs without Vue packages

## Definition of Done for `2.x`

The migration line is ready for merge review when:

- Core routes are React-based
- Authentication flow works end-to-end
- Priority pages have functional parity
- Vue runtime is no longer required
- Build and lint pass
- Validation records are documented

## Risks

- Vuetify components cannot be moved as-is to React
- Layout and form behavior may drift during migration
- Route guards and auth restore logic are easy regression points
- Grid, editor, and file-upload integrations need careful replacement

## Working Principles

- Keep changes minimal and scoped
- Prefer parity over redesign
- Migrate in slices that can be verified
- Avoid speculative abstractions
- Keep each changed line traceable to the migration

## Validation Record Template

Use this format in commits or merge requests:

```text
Validation
- npm run build
- npm run lint
- manual: login flow
- manual: route navigation
```
