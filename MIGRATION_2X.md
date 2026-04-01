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
- Auth and session state: Zustand
- Ephemeral UI state: local component state first, shared UI state via React Context only when cross-tree control is required
- Forms: React Hook Form
- Grid: AG Grid React
- Rich text editor: Tiptap React

## Coexistence Strategy

The migration will use a shell-first strategy instead of route-by-route dual runtime.

- Phase 1 and 2 replace the root entry with React and establish the React shell.
- During the transition, React becomes the application owner for bootstrapping, routing, auth gating, and layout composition.
- Vue pages are not mounted side-by-side under separate runtime subtrees such as `/react/*`.
- Existing Vue implementation is treated as source material for rewrite, not as a long-lived co-running frontend inside the same app shell.
- Page migration remains incremental at the implementation level, but runtime ownership moves to React early to avoid split routing and split auth behavior.

This choice is intentional because the current application relies on centralized router guards, shared plugin registration, and app-wide auth/session behavior. A mixed Vue/React runtime would add complexity to routing, token refresh, and layout consistency without reducing the core rewrite cost enough.

## Parallel Work Strategy

Parallel execution is allowed, but only after the foundational runtime path is established.

### Sequential Foundation

The following work should be treated as the critical path and completed first, or at least stabilized enough to become the shared baseline for other branches:

1. React bootstrap
   - React entry point
   - Root app mounting
   - Basic build success
2. Routing shell
   - React Router ownership
   - Base route tree
   - Blank/full layout skeleton
   - 404 and unauthorized pages
3. Auth bootstrap gate
   - Session restoration at startup
   - Protected route entry control
   - Role and redirect handling

These items are prerequisites because all later page migrations depend on a single runtime owner, stable navigation behavior, and correct auth/session control.

### Safe Parallel Tracks After Foundation

Once the foundation is in place, the following tracks can run in parallel with separate `feature/*` branches:

- Shared feedback UI
  - Toast
  - Confirm
  - Dialog host/provider
- Shared data adapters
  - Query key conventions
  - Shared API access patterns built on the approved auth/session flow
- Shared grid wrapper
  - React replacement for common AG Grid wrapper behavior
- Feature page migrations
  - Auth pages
  - Dashboard
  - Public community pages
  - Admin/security pages
- Editor and upload integrations
  - Rich text editor replacement
  - File upload replacement

### High-Conflict Areas

The following areas should not be implemented independently in multiple branches at the same time unless responsibilities are explicitly separated:

- Auth/session store
- Axios interceptor and token refresh queue
- App-level router configuration
- Full layout, sidebar, and topbar shell
- Global feedback providers
- Shared form abstraction

These areas should have one baseline implementation first, and later branches should integrate against that baseline rather than redefining it.

### Recommended Branch Order

Recommended early branch sequence:

1. `feature/react-bootstrap`
2. `feature/react-routing`
3. `feature/react-auth-core`

Recommended parallel branches after that baseline:

- `feature/react-shared-feedback`
- `feature/react-grid-wrapper`
- `feature/react-public-community`
- `feature/react-admin-security`
- `feature/react-editor-upload`

### Merge Rule for Parallel Work

- Merge foundational branches first.
- Merge parallel branches only after rebasing onto the current `2.x` baseline.
- Keep each branch focused on one migration concern.
- Do not mix foundational runtime work with page migration in the same branch unless there is a clear blocker.

## Migration Phases

### Phase 1. Bootstrap

Goal:

- Establish the React app baseline on `2.x`

Work:

- **Current Vue Entry Point (`src/main.ts`)**:
  The existing Vue application bootstraps via `src/main.ts`. This file initializes Vue with `createApp(App)`, registers global plugins (Pinia, Vuetify, Vue Router, Toast, Confirm), and mounts the application to the `#app` element.
  ```typescript
  // src/main.ts
  import { createApp, watch } from "vue";
  import App from "./App.vue";
  import router from "@/router";
  import { vuetify, pinia } from "./plugins";
  // ... other imports
  const app = createApp(App);
  // ... plugin registrations
  app.use(pinia);
  app.use(vuetify);
  app.use(router);
  // ...
  app.mount("#app");
  ```
- **Current Core Application Component (`src/App.vue`)**:
  The root Vue component is `src/App.vue`, which typically contains the main layout structure and router view.
- **Initial Project Structure**:
  The core source code resides under the `src/` directory, with subdirectories for components, data, layouts, plugins, router, stores, types, and views. This structure will need to be adapted for a React project, maintaining logical separation.
  ```
  src/
  ├── App.vue               // Root Vue component
  ├── main.ts               // Vue application entry point
  ├── assets/
  ├── components/           // Reusable Vue components
  ├── config/
  ├── data/                 // Data services, http clients
  ├── layouts/              // Application layouts (blank, full)
  ├── messages/
  ├── plugins/              // Vue plugins (axios, pinia, vuetify, toast, confirm)
  ├── router/               // Vue Router configuration
  ├── scss/                 // Global styles, theme overrides
  ├── stores/               // Pinia stores for state management
  ├── theme/
  ├── types/                // TypeScript type definitions
  ├── utils/
  ├── validators/
  └── views/                // Vue page components
  ```
- **React Implementation**:
  - Add React runtime and build dependencies (e.g., `react`, `react-dom`, `@types/react`, `@types/react-dom`).
  - Create a new React entry point (e.g., `src/main.tsx` or `src/index.tsx`) to initialize React with `ReactDOM.createRoot()` and render the root React component.
  - Replace Vue as the root runtime owner early, so that bootstrapping, routing, and auth/session orchestration move to React in Phase 1 and 2.
  - Define an initial React project structure that aligns with the migration goal and preserves reusable TypeScript modules where possible.
  - Keep the setup minimal and migration-focused, avoiding the introduction of new features.

Verify:

- `npm run build`
- React app mounts successfully

### Phase 2. Routing and Shell

Goal:

- Rebuild the application shell and base routes

Work:

- **Current Vue Router Configuration**:
  The application uses `vue-router` (v5.0.3). The main router configuration is in `src/router/index.ts`, which imports and combines several route modules like `AuthRoutes.ts`, `MainRoutes.ts`, `StudioMgmtRoutes.ts`, and `StudioPublicRoutes.ts`.
  ```typescript
  // src/router/index.ts (excerpt)
  import { createRouter, createWebHistory } from "vue-router";
  import AuthRoutes from "./AuthRoutes";
  import MainRoutes from "./MainRoutes";
  // ... other imports
  const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
      {
        path: "/:pathMatch(.*)*",
        component: () => import("@/views/pages/Error404.vue"),
      },
      MainRoutes,
      AuthRoutes,
      // ...
    ],
  });
  ```
- **Global Navigation Guards**:
  A global `beforeEach` guard in `src/router/index.ts` is responsible for authentication, authorization, and session restoration. It uses the `useAuthStore` (Pinia) to check authentication status, refresh tokens, fetch user profiles, and enforce `requiresAuth` and role-based access defined in route meta fields.
  ```typescript
  // src/router/index.ts (excerpt)
  router.beforeEach(async (to, from, next) => {
    const auth = useAuthStore();
    // ... session restoration logic ...
    if (to.meta.requiresAuth && !auth.isAuthenticated) {
      return next(`/auth/login?returnUrl=${encodeURIComponent(to.fullPath)}`);
    }
    // ... role-based access control ...
    next();
  });
  ```
- **Layout Structure (`src/layouts/`)**:
  The application utilizes two primary layouts:
  - `BlankLayout.vue` (`src/layouts/blank/BlankLayout.vue`): Used for authentication pages (e.g., login, register) as seen in `AuthRoutes.ts`.
  - `FullLayout.vue` (`src/layouts/full/FullLayout.vue`): Used for the main application content, including the dashboard and other protected routes, as seen in `MainRoutes.ts`. This layout likely includes components like a Topbar and Sidebar.
    The 404 (`src/views/pages/Error404.vue`) and Unauthorized (`src/views/pages/Unauthorized.vue`) pages are also key components to consider in this phase.
- **React Implementation**:
  - Introduce `react-router-dom` for declarative routing.
  - Recreate the `BlankLayout` and `FullLayout` components in React.
  - Implement a central routing configuration that maps to the existing paths and integrates with React components.
  - Replace the Vue `beforeEach` model with a bootstrap auth gate plus route-level protection so session restoration, role checks, and redirect decisions complete before protected screens render.
  - Keep routing ownership centralized in React to avoid split navigation behavior during the migration.
  - Rebuild the 404 and Unauthorized pages as React components.

Verify:

- Route transitions work
- Base layout renders without runtime errors

### Phase 3. Auth and API Foundation

Goal:

- Recreate authentication and shared API behavior

Work:

- **Current Axios Configuration (`src/plugins/axios.ts`)**:
  The application configures an Axios instance (`api`) with a `baseURL` from `API_BASE_URL` (`src/config/backend.ts`).
  A critical aspect is the **request interceptor** that manages access token lifecycle:
  - It checks if the current `auth.token` is expired (`isTokenExpired` utilizing `parseJwtExp` from `src/utils/jwt.ts`).
  - If expired, it triggers `auth.refreshTokens()` to obtain a new access token.
  - A queuing mechanism (`isRefreshing`, `failedQueue`) ensures that only one token refresh request is active at a time, and subsequent requests wait for the refresh to complete.
  - The `Authorization: Bearer <token>` header is added to all outgoing requests.
  ```typescript
  // src/plugins/axios.ts (excerpt)
  api.interceptors.request.use(async (config) => {
    const auth = useAuthStore();
    if (auth.token && isTokenExpired(auth.token)) {
      // ... token refresh logic with queuing ...
      await new Promise<void>((resolve, reject) => {
        /* ... */
      });
    }
    if (auth.token) {
      config.headers.Authorization = `Bearer ${auth.token}`;
    }
    return config;
  });
  ```
- **Current Authentication State Management (`src/stores/studio/mgmt/auth.store.ts`)**:
  The `useAuthStore` (Pinia) manages the `token` and `user` state. Key actions include:
  - `login(username, password)`: Authenticates with the backend, receives an `accessToken`, and then calls `fetchUser()`. This action uses a direct `axios` call, bypassing the `api` interceptor to prevent circular dependencies during initial token acquisition.
  - `refreshTokens()`: Sends a request to the backend `/api/auth/refresh` endpoint. This call relies on an `HttpOnly` cookie for the refresh token and updates the `accessToken`. This action is central to maintaining session validity.
  - `fetchUser()`: Retrieves the `UserProfileDto` from `/api/self`, setting `this.user`. It handles 401/403 responses by calling `logout()`.
  - `logout()`: Clears local `token` and `user` state. `logoutEverywhere()` provides a server-side invalidation.
  - `isAuthenticated`: A getter that simply checks for the presence of a `token`.
  ```typescript
  // src/stores/studio/mgmt/auth.store.ts (excerpt)
  export const useAuthStore = defineStore("auth", {
    state: () => ({
      token: null as string | null,
      user: null as UserProfileDto | null,
    }),
    getters: { isAuthenticated: (state) => !!state.token /* ... */ },
    actions: {
      async login(username: string, password: string) {
        /* ... */
      },
      async refreshTokens() {
        /* ... */
      },
      async fetchUser() {
        /* ... */
      },
      logout() {
        /* ... */
      },
      // ... other actions for explicit logout management ...
    },
  });
  ```
- **Protected-Route Behavior**:
  As described in Phase 2, the `router.beforeEach` guard (`src/router/index.ts`) enforces protected routes by checking `to.meta.requiresAuth` and redirecting unauthenticated users to `/auth/login`. It also handles session restoration (`restoreSessionIfNeeded`) and role-based access control.
- **React Implementation**:
  - Reconfigure Axios in React, implementing similar interceptor logic for token management, expiry checks, and refresh queuing.
  - Port the authentication state management (`login`, `logout`, `refreshTokens`, `fetchUser`) into a dedicated Zustand store so auth/session state has one consistent home.
  - Implement startup session restoration in a bootstrap auth gate before protected routes render.
  - Reimplement route protection on top of that bootstrap flow, using route-level guards only after auth restoration has resolved.

Verify:

- Login succeeds
- Refresh flow works
- Protected routes redirect correctly

### Phase 4. Shared UI and State

Goal:

- Rebuild reusable app infrastructure needed by pages

Work:

- **Current Global UI Components**:
  The application implements global UI elements using a combination of Vue plugins and host components, often leveraging Vuetify.
  - **Toast Notifications**:
    - **Plugin (`src/plugins/toast.ts`)**: Defines `useToast` composable and a global `$toast` property. It manages toast state (message, color, timeout, etc.) using Vue `reactive` and provides methods like `show`, `success`, `error`.
    - **Host Component (`src/components/toast/ToastHost.vue`)**: Renders a Vuetify `v-snackbar` using `teleport` to the `body`, consuming the reactive state from the plugin.
    ```typescript
    // src/plugins/toast.ts (excerpt)
    const state = reactive({
      show: false,
      message: "",
      color: "success" /* ... */,
    });
    function show(message: string, opts: ToastOptions = {}) {
      /* ... */
    }
    // ...
    export const useToast = () => inject<typeof api>(TOAST_API)!;
    ```
    ```vue
    <!-- src/components/toast/ToastHost.vue (excerpt) -->
    <template>
      <teleport to="body">
        <v-snackbar v-model="s.show" :timeout="s.timeout" :color="s.color" /* ... */ >
          <span>{{ s.message }}</span>
          <!-- ... -->
        </v-snackbar>
      </teleport>
    </template>
    <script setup lang="ts">
    import { useToastState } from '@/plugins/toast';
    const s = useToastState();
    </script>
    ```
  - **Confirmation Dialogs**:
    - **Plugin (`src/plugins/confirm.ts`)**: Defines `useConfirm` composable and a global `$confirm` property. It manages dialog state and returns a `Promise<boolean>`, allowing for awaitable confirmations.
    - **Host Component (`src/components/dialog/ConfirmHost.vue`)**: Renders a Vuetify `v-dialog` using `teleport`, consuming state from the plugin and resolving the promise based on user interaction.
    ```typescript
    // src/plugins/confirm.ts (excerpt)
    const state = reactive({
      open: false,
      title: "확인",
      message: "" /* ... */,
    });
    function confirm(opts: ConfirmOptions = {}): Promise<boolean> {
      /* ... */
    }
    // ...
    export const useConfirm = () =>
      inject<{ confirm: typeof confirm; resolve: typeof resolve }>(API)!
        .confirm;
    ```
- **Current Shared Table/Grid Wrappers (`src/components/ag-grid/`)**:
  The application uses `ag-grid-vue3` and provides a wrapper component, `GridContent.vue`, to encapsulate common AG Grid functionalities.
  - `src/components/ag-grid/GridContent.vue`: This component handles props for `columns`, `options`, `rowData`, `rowSelection`, and provides features like dynamic height resizing, `GridApi` exposure, and event handling (`@row-selected`, `@selectionChanged`).
  ```vue
  <!-- src/components/ag-grid/GridContent.vue (excerpt) -->
  <template>
    <div ref="gridContainer" /* ... */ >
      <AgGridVue /* ... */ :gridOptions="gridOptionsDefs" :rowData="rowData" />
    </div>
  </template>
  <script setup lang="ts">
  import { AgGridVue } from 'ag-grid-vue3';
  // ... props, computed, refs, onMounted, defineExpose ...
  </script>
  ```
- **Current State Management (`src/stores/`)**:
  The application uses Pinia for state management.
  - `src/stores/notifications.store.ts`: An example of a Pinia store using the Composition API style, managing an array of `NotificationItem`s, `unreadCount` getter, and actions like `add`, `markRead`, `remove`, `clear`.
  ```typescript
  // src/stores/notifications.store.ts (excerpt)
  export const useNotificationsStore = defineStore("app-notifications", () => {
    const items = ref<NotificationItem[]>([]);
    const unreadCount = computed(
      () => items.value.filter((n) => !n.read).length,
    );
    const add = (
      payload: Omit<NotificationItem, "id" | "createdAt" | "read">,
    ) => {
      /* ... */
    };
    // ... other actions ...
    return { items, unreadCount, add /* ... */ };
  });
  ```
- **React Implementation**:
  - Reimplement global UI components (Toast, Confirm, Dialog) using React Context and custom hooks only where imperative cross-tree access is required.
  - Port shared table/grid wrapper logic from `GridContent.vue` to a React component using `ag-grid-react`, adapting its props, event handling, and exposed methods.
  - Use TanStack Query for server state, Zustand for auth/session state, and local component state by default for page-local UI concerns.
  - Introduce additional global stores only when local state or React Context is demonstrably insufficient.

Verify:

- Shared components render and behave correctly
- No page depends on removed Vue runtime objects

### Phase 5. Page-by-Page Migration

Goal:

- Move user-facing pages incrementally inside the React-owned shell

Work:

- **Example: Auth Pages (`src/views/auth/Login.vue`)**:
  Auth pages, such as `Login.vue`, serve as a good starting point for page migration. These pages typically compose smaller, focused components.
  - `src/views/auth/Login.vue`: This component primarily acts as a wrapper, using Vuetify's layout components (`v-container`, `v-card`) to structure the page, and embedding the `Logo.vue` and `LoginForm.vue` components.
  - `src/components/auth/LoginForm.vue`: This is a more complex component that demonstrates:
    - **State Management**: Uses `useAuthStore` (Pinia) for the actual login logic (`auth.login(username, password)`).
    - **Routing**: Employs `useRouter` (Vue Router) for redirection after successful login.
    - **Form Handling & Validation**: Utilizes `vee-validate` (`useField`, `useForm`) with `yup` for client-side form validation. This involves defining a `yup` schema, associating form fields with `useField`, and handling error messages.
    - **Local Component State**: Manages UI-specific state using Vue `ref` (e.g., `errorMessage`, `loading`, `remember`, `showPassword`).
    - **Vuetify Components**: Heavily relies on Vuetify components for its UI (e.g., `v-form`, `v-text-field`, `v-btn`, `v-alert`).
    - **External Dialogs**: Integrates `PasswordResetDialog.vue` and controls its visibility.
  ```vue
  <!-- src/components/auth/LoginForm.vue (excerpt) -->
  <script setup lang="ts">
  import { useAuthStore } from '@/stores/studio/mgmt/auth.store';
  import { useField, useForm } from 'vee-validate';
  import { useRouter } from 'vue-router';
  import * as yup from 'yup';
  // ...
  const auth = useAuthStore();
  const router = useRouter();
  const schema = yup.object({ /* ... */ });
  const { handleSubmit } = useForm({ validationSchema: schema });
  const { value: username, errorMessage: usernameError } = useField('username');
  // ... login function calls auth.login and router.push ...
  </script>
  <template>
    <v-form @submit.prevent="login">
      <v-text-field v-model="username" :error-messages="usernameErrors" /* ... */ />
      <v-btn type="submit" :loading="loading" /* ... */ >로그인</v-btn>
    </v-form>
    <PasswordResetDialog v-model="dialog.visible" /* ... */ />
  </template>
  ```
- **Migration Strategy for Pages**:
  - For each page, identify its direct and indirect dependencies (components, stores, utility functions, external libraries).
  - Reimplement the page as a React component, replacing Vue/Vuetify components with React components (using a chosen UI library) and porting local state, form logic, and external integrations.
  - Replace Pinia store interactions according to the fixed state model: TanStack Query for server data, Zustand for auth/session state, and local state or React Context for UI concerns.
  - Adapt `vee-validate`/`yup` logic to `React Hook Form`/`yup` or a similar React-friendly form validation library.

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

- **Delete Obsolete Vue Entry Files**:
  - `src/main.ts` (the original Vue entry point)
  - `src/App.vue` (the root Vue component)
  - Only `.vue` files that have confirmed React replacements and no remaining runtime references.
  - Vue-specific plugin files in `src/plugins/` only when their runtime responsibilities have been replaced in React.
  - Vue Router configuration files in `src/router/` only after equivalent React routing is in production use on `2.x`.
  - Pinia store files in `src/stores/` only after their logic has either moved to React state management or been preserved as framework-agnostic TypeScript modules elsewhere.
- **Remove Vue-only Dependencies from `package.json`**:
  Based on the current `package.json`, the following dependencies will need to be removed:
  - `vue`: `3.5.30`
  - `vue-router`: `5.0.3`
  - `pinia`: `3.0.4`
  - `vuetify`: `4.0.2`
  - `ag-grid-vue3`: `35.1.0`
  - `@tiptap/vue-3`: `3.20.4`
  - `@iconify/vue`: `5.0.0`
  - `vue-filepond`: `7.0.4`
  - `vue-tabler-icons`: `2.21.0`
  - `vue3-ace-editor`: `2.2.4`
  - `vue3-apexcharts`: `1.11.1`
  - `vue3-perfect-scrollbar`: `2.0.0`
  - `@vitejs/plugin-vue`: `6.0.5` (dev dependency)
  - `vue-tsc`: `3.2.6` (dev dependency)
  - `@vue/eslint-config-prettier`: `10.2.0` (dev dependency)
  - `@vue/eslint-config-typescript`: `14.7.0` (dev dependency)
  - `@vue/tsconfig`: `0.9.0` (dev dependency)
  - `eslint-plugin-vue`: `10.8.0` (dev dependency)
- **Remove Dead Code Created by the Migration**:
  - Any remaining framework-specific utility functions or configuration that are no longer referenced.
  - Old test files specifically written for Vue components that are now removed.
  - Do not delete reusable TypeScript types, API clients, helpers, message catalogs, or other framework-agnostic modules solely because they were previously imported by Vue files.

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
