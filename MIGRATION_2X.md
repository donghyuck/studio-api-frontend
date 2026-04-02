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

## 진행 현황 (Progress Tracker)

> 마지막 업데이트: 2026-04-02

### 이슈 및 PR 현황

| Issue | 제목 | Phase | 브랜치 | PR | PR 상태 | 이슈 상태 |
|-------|------|-------|--------|----|---------|---------|
| [#4](../../issues/4) | React bootstrap baseline | Phase 1 | `feature/react-migration-phase4-6` | [#16](../../pull/16) | ✅ MERGED | ✅ CLOSED |
| [#5](../../issues/5) | React routing shell | Phase 2 | `feature/react-migration-phase4-6` | [#16](../../pull/16) | ✅ MERGED | ✅ CLOSED |
| [#6](../../issues/6) | React auth bootstrap gate | Phase 3 | `feature/react-migration-phase4-6` | [#16](../../pull/16) | ✅ MERGED | ✅ CLOSED |
| [#7](../../issues/7) | Shared feedback providers (Toast/Confirm) | Phase 4 | `feature/react-shared-feedback` | [#18](../../pull/18) | ✅ MERGED | ✅ CLOSED |
| [#8](../../issues/8) | TanStack Query adapters | Phase 4 | `feature/react-query-adapters` | [#17](../../pull/17) | ✅ MERGED | ✅ CLOSED |
| [#9](../../issues/9) | AG Grid shared wrapper | Phase 4 | — | [#20](../../pull/20) | 🔍 OPEN (리뷰 대기) | 🔄 OPEN |
| [#10](../../issues/10) | Auth pages migration (Login/Password Reset) | Phase 5 | — | [#19](../../pull/19) | 🔍 OPEN (리뷰 대기) | 🔄 OPEN |
| [#11](../../issues/11) | Dashboard migration | Phase 5 | — | — | ⏳ 미시작 | 🔄 OPEN |
| [#12](../../issues/12) | Public community pages | Phase 5 | — | — | ⏳ 미시작 | 🔄 OPEN |
| [#13](../../issues/13) | Admin/security pages | Phase 5 | — | — | ⏳ 미시작 | 🔄 OPEN |
| [#14](../../issues/14) | Editor/upload integration | Phase 5 | — | — | ⏳ 미시작 | 🔄 OPEN |
| [#15](../../issues/15) | Vue cleanup & dependency removal | Phase 6 | — | — | ⏳ 미시작 | 🔄 OPEN |

### Phase별 완료율

| Phase | 내용 | 상태 |
|-------|------|------|
| Phase 1 — Bootstrap | React 진입점, 빌드 기반 확립 | ✅ 완료 (Issue #4, PR#16) |
| Phase 2 — Routing & Shell | React Router, 레이아웃 골격, 404/Unauthorized | ✅ 완료 (Issue #5, PR#16) |
| Phase 3 — Auth & API Foundation | Zustand auth store, Axios interceptor, 세션 복원 | ✅ 완료 (Issue #6, PR#16) |
| Phase 4 — Shared UI & State | Toast/Confirm providers, TanStack Query, AG Grid wrapper | 🔄 진행 중 (Issues #7✅ #8✅ #9🔍) |
| Phase 5 — Page Migration | 인증 페이지, Dashboard, Community, Admin, Editor | 🔄 진행 중 (Issue #10🔍 / #11~#14 미시작) |
| Phase 6 — Vue Removal | Vue 런타임 제거, 패키지 정리 | ⏳ 미시작 (Issue #15) |

### 현재 블로커 및 주의사항

- **PR#20 (Issue #9)**: AG Grid wrapper 리뷰 완료 후 merge 필요. Phase 5 페이지들이 그리드를 사용하기 전에 먼저 완료되어야 함.
- **PR#19 (Issue #10)**: 로그인 페이지 리뷰 완료 후 merge 필요. Issue #11 (Dashboard) 착수의 선행 조건.
- **PR#17 (Issue #8) 후속 반영 완료**: `unwrapData` 옵션 추가, `appQueryKeys.auth` 제거, retry 정책 주석 보강까지 반영됨.
- **Issue #11~#14**: Phase 4가 완전히 완료(PR#20 merge)된 후 착수 권장.

## 현재 React 구현 구조

> `src/react/` 하위에 실제로 존재하는 파일 트리와 각 모듈의 역할입니다.
> 신규 기여자는 이 구조를 기준으로 파일을 배치하고 기존 패턴을 따르세요.

```
src/
├── main.tsx                        # React 진입점 (ReactDOM.createRoot)
└── react/
    ├── App.tsx                     # 루트 컴포넌트: BrowserRouter > FeedbackProvider > AuthBootstrapGate > AppRouter
    │
    ├── api/
    │   └── client.ts               # Axios 인스턴스 (apiClient) + 토큰 갱신 인터셉터 큐
    │
    ├── auth/
    │   ├── store.ts                # Zustand auth store: token, user, bootstrapState, login/logout/refresh
    │   ├── AuthBootstrapGate.tsx   # 앱 시작 시 세션 복원 완료까지 전체 화면 로딩 표시
    │   └── ProtectedRoute.tsx      # 미인증 → /auth/login 리디렉트, roles prop으로 역할 제한
    │
    ├── feedback/
    │   ├── FeedbackProvider.tsx    # ToastProvider + ConfirmProvider 합성
    │   ├── ToastProvider.tsx       # Snackbar 기반 전역 토스트 (key remount 방식)
    │   ├── ConfirmProvider.tsx     # Promise<boolean> 다이얼로그 (큐 방식 순차 처리)
    │   └── index.ts                # 외부 공개 API: FeedbackProvider, toast, useToast, confirm, useConfirm
    │
    ├── query/
    │   ├── client.ts               # QueryClient 설정 (401/403 재시도 없음, 그 외 1회)
    │   ├── provider.tsx            # QueryClientProvider 래퍼
    │   ├── fetcher.ts              # apiRequest / apiQuery / createApiQueryFn (응답 envelope 언래핑 포함)
    │   └── keys.ts                 # createQueryKeys() 팩토리 + normalizeKeyRecord()
    │
    ├── layouts/
    │   ├── BlankLayout.tsx         # 인증 전 페이지용 (로그인 등): <Outlet /> 단순 래핑
    │   └── FullLayout.tsx          # 인증 후 페이지용: AppBar(로고·유저명·로그아웃) + <Outlet />
    │                               #   ⚠ 향후 사이드바·내비게이션 추가 필요 (Issue #11 착수 시)
    │
    ├── router/
    │   └── AppRouter.tsx           # 전체 Route 트리 정의 (현재: /auth/login, /, /unauthorized, /404)
    │
    ├── pages/
    │   ├── LoginPage.tsx           # 로그인 폼 + 비밀번호 재설정 Dialog (PR#19)
    │   ├── DashboardPage.tsx       # 대시보드 (스텁 상태, Issue #11에서 구현)
    │   ├── UnauthorizedPage.tsx    # 403 페이지
    │   └── NotFoundPage.tsx        # 404 페이지
    │
    └── components/
        └── ag-grid/
            ├── GridContent.tsx         # 일반 그리드 래퍼 (forwardRef, GridContentHandle 노출)
            ├── PageableGridContent.tsx # 페이지네이션 그리드 래퍼
            ├── CustomLoadingOverlay.tsx
            ├── gridOptions.ts          # defaultGridOptions 프리셋
            ├── types.ts                # GridContentProps, GridContentHandle 등 타입 정의
            ├── utils.ts                # getAutoGridHeight, normalizeRowSelection 등
            ├── styles.css
            └── index.ts
```

### 모듈 간 의존 관계

```
main.tsx
  └── App.tsx
        ├── BrowserRouter (react-router-dom)
        ├── FeedbackProvider  ← feedback/index.ts
        └── AuthBootstrapGate ← auth/store.ts
              └── AppRouter   ← router/AppRouter.tsx
                    ├── ProtectedRoute ← auth/store.ts
                    ├── BlankLayout / FullLayout ← auth/store.ts (user, logout)
                    └── Page components
                          ├── useAuthStore() ← auth/store.ts
                          ├── useQuery / useMutation ← query/fetcher.ts + query/keys.ts
                          ├── apiClient ← api/client.ts  (auth store와 순환 의존 없음)
                          └── toast / confirm ← feedback/index.ts (명령형 접근)

api/client.ts (apiClient)
  └── authStore.getState()  ← auth/store.ts  (subscribe 없이 getState만 호출하여 순환 방지)
```

> **핵심 설계 결정:** `auth/store.ts`의 `login`, `refreshTokens`, `fetchUser`는 모두 **raw `axios`** 직접 호출.
> `apiClient`에서는 `authStore.getState()`만 호출하여 토큰을 읽음.
> 이 구조가 "auth store → apiClient → auth store" 순환 의존을 차단합니다.

## Branch Strategy

### Roles

- `main`
  - Stable Vue maintenance line
- `2.x`
  - React migration integration line
- `feature/*`
  - Working branches created from `2.x`

### Recommended Branch Names

아래는 권장 브랜치명과 실제 사용된 브랜치명을 병기한 목록입니다.

| 목적 | 권장 브랜치명 | 실제 사용 브랜치명 |
|------|-------------|-----------------|
| Bootstrap + Routing + Auth 기반 (Issues #4–#6) | `feature/react-bootstrap`, `feature/react-routing`, `feature/react-auth` | `feature/react-migration-phase4-6` |
| Shared feedback (Toast/Confirm) | `feature/react-shared-feedback` | `feature/react-shared-feedback` |
| TanStack Query adapters | `feature/react-query-adapters` | `feature/react-query-adapters` |
| AG Grid wrapper | `feature/react-grid-wrapper` | `feature/react-grid-wrapper` |
| Auth pages | `feature/react-auth-pages` | `feature/react-auth-pages` |
| Dashboard | `feature/react-dashboard` | — |
| Public community pages | `feature/react-public-community` | — |
| Admin/security pages | `feature/react-admin-security` | — |
| Editor & upload | `feature/react-editor-upload` | — |
| Vue cleanup | `feature/vue-cleanup` | — |

> **참고:** Issues #4–#6은 단일 브랜치로 묶어 처리했으나, 이후 작업은 이슈별로 독립 브랜치를 사용하여 추적성을 높이고 있습니다.

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

> **이슈:** [#4](../../issues/4) | **PR:** [#16](../../pull/16) | **상태:** ✅ 완료

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

> **이슈:** [#5](../../issues/5) | **PR:** [#16](../../pull/16) | **상태:** ✅ 완료

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

> **이슈:** [#6](../../issues/6) | **PR:** [#16](../../pull/16) | **상태:** ✅ 완료

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

> **이슈:** [#7](../../issues/7) PR [#18](../../pull/18) ✅, [#8](../../issues/8) PR [#17](../../pull/17) ✅, [#9](../../issues/9) PR [#20](../../pull/20) 🔍 | **상태:** 🔄 진행 중

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

> **이슈:** [#10](../../issues/10) PR [#19](../../pull/19) 🔍, [#11](../../issues/11) ⏳, [#12](../../issues/12) ⏳, [#13](../../issues/13) ⏳, [#14](../../issues/14) ⏳ | **상태:** 🔄 진행 중

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

> **이슈:** [#15](../../issues/15) | **상태:** ⏳ 미시작 (Phase 5 완료 후 착수)

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

## 핵심 구현 패턴 (Page Authors Guide)

> 새 페이지를 마이그레이션할 때 반드시 따라야 하는 확립된 패턴입니다.
> 아래 패턴을 벗어나는 구현은 PR 리뷰에서 반려될 수 있습니다.

### 1. 라우트 등록

새 페이지는 `src/react/router/AppRouter.tsx`에 Route를 추가해야 합니다.

```tsx
// AppRouter.tsx의 기본 구조
<Routes>
  {/* 인증 불필요 페이지: BlankLayout 아래 배치 */}
  <Route element={<BlankLayout />}>
    <Route path="/auth/login" element={<LoginPage />} />
  </Route>

  {/* 인증 필요 페이지: ProtectedRoute > FullLayout 아래 배치 */}
  <Route element={<ProtectedRoute />}>
    <Route element={<FullLayout />}>
      <Route index element={<DashboardPage />} />
      {/* 여기에 새 페이지 Route 추가 */}
    </Route>
  </Route>

  {/* 특정 역할 필요 페이지 */}
  <Route element={<ProtectedRoute roles={["ROLE_ADMIN"]} />}>
    <Route element={<FullLayout />}>
      {/* 관리자 전용 페이지 */}
    </Route>
  </Route>
</Routes>
```

### 2. 인증 상태 접근

컴포넌트에서 인증 정보가 필요하면 `useAuthStore` selector를 사용합니다.

```tsx
import { useAuthStore } from "@/react/auth/store";

// 필요한 값만 selector로 구독 (불필요한 리렌더링 방지)
const user = useAuthStore((state) => state.user);
const token = useAuthStore((state) => state.token);
const logout = useAuthStore((state) => state.logoutEverywhere);
```

> **주의:** 컴포넌트 바깥(Axios interceptor, 초기화 함수 등)에서는 `authStore.getState().token`을 사용합니다.

### 3. API 데이터 조회 (TanStack Query)

서버 데이터를 조회하는 표준 패턴은 `apiQuery` + `useQuery` 조합입니다.

```tsx
import { useQuery } from "@tanstack/react-query";
import { apiQuery, apiRequest } from "@/react/query/fetcher";
import { appQueryKeys } from "@/react/query/keys";

// 조회
function usePostList() {
  return useQuery({
    queryKey: appQueryKeys.posts.list(),
    queryFn: () => apiQuery<PostDto[]>("/api/studio/public/posts"),
  });
}

// 변이 (생성/수정/삭제)
function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePostDto) =>
      apiRequest<PostDto, CreatePostDto>("post", "/api/studio/public/posts", { data: body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appQueryKeys.posts.list() });
    },
  });
}
```

> **`unwrapData`:** 기본값 `true`. 응답이 `{ data: T }` envelope 구조가 아닌 경우 `apiQuery(url, { unwrapData: false })`로 호출합니다.

### 4. 피드백 (Toast / Confirm)

```tsx
import { toast, confirm } from "@/react/feedback";
// 또는 React 컴포넌트 안에서는 훅도 사용 가능:
// import { useToast, useConfirm } from "@/react/feedback";

// Toast: 명령형 (컴포넌트 밖에서도 호출 가능)
toast.success("저장되었습니다.");
toast.error("오류가 발생했습니다.", { timeout: 5000 });

// Confirm: await 가능한 Promise 반환
async function handleDelete(id: number) {
  const ok = await confirm({
    title: "삭제 확인",
    message: "정말 삭제하시겠습니까?",
    okText: "삭제",
    cancelText: "취소",
  });
  if (!ok) return;

  try {
    await apiRequest("delete", `/api/posts/${id}`);
    toast.success("삭제되었습니다.");
  } catch (error) {
    toast.error(resolveAxiosError(error));
  }
}
```

### 5. AG Grid 사용

```tsx
import { useRef } from "react";
import { GridContent } from "@/react/components/ag-grid";
import type { GridContentHandle } from "@/react/components/ag-grid";
import type { ColDef } from "ag-grid-community";

// 컬럼 정의는 useMemo 또는 컴포넌트 외부 상수로 정의 (리렌더마다 재정의 방지)
const columns: ColDef<MyDto>[] = [
  { field: "id", headerName: "ID", width: 80 },
  { field: "name", headerName: "이름", flex: 1 },
];

function MyPage() {
  const gridRef = useRef<GridContentHandle<MyDto>>(null);
  const { data = [] } = useQuery({ ... });

  return (
    <GridContent<MyDto>
      ref={gridRef}
      columns={columns}
      rowData={data}
      rowSelection="single"   // "single" | "multiple" | RowSelectionOptions
    />
  );
}

// 명령형 GridApi 접근
gridRef.current?.refresh();
gridRef.current?.selectedRows();    // 선택된 행 배열 반환
gridRef.current?.clearFilters();
```

### 6. 폼 처리 (React Hook Form + yup)

```tsx
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { TextField, Button } from "@mui/material";

const schema = yup.object({
  title: yup.string().required("제목을 입력하세요"),
});

type FormValues = yup.InferType<typeof schema>;

function MyForm() {
  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { title: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    // ...
  });

  return (
    <Box component="form" onSubmit={onSubmit} noValidate>
      <Controller
        name="title"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            label="제목"
            error={!!errors.title}
            helperText={errors.title?.message}
          />
        )}
      />
      <Button type="submit">저장</Button>
    </Box>
  );
}
```

> **MUI v7 주의:** `InputProps` 대신 `slotProps={{ input: { ... } }}`를 사용합니다.

### 7. 에러 처리 패턴

```tsx
import { resolveAxiosError } from "@/utils/helpers";

try {
  await someApiCall();
} catch (error) {
  // Axios 오류에서 사람이 읽을 수 있는 메시지 추출
  toast.error(resolveAxiosError(error) || "오류가 발생했습니다.");
}
```

### 8. 쿼리 키 추가

`src/react/query/keys.ts`의 `appQueryKeys`에 새 도메인 키를 추가합니다.

```typescript
// keys.ts 예시 구조
export const appQueryKeys = {
  // 기존 키들 ...
  posts: createQueryKeys("posts", {
    list: () => [],
    detail: (id: number) => [id],
  }),
};
```

> **주의:** `appQueryKeys.auth`처럼 auth 도메인을 Query Key로 관리하면 Zustand store와의 이중 관리가 발생할 수 있습니다. auth 관련 서버 상태(user 프로필 등)는 `useAuthStore`를 통해 접근하는 것이 원칙입니다.

## 남은 작업 세부 계획 검토

> 작성일: 2026-04-02. PR#19·PR#20 merge 기준으로 Phase 5 본격 착수 직전 단계.

### PR#20 — Issue #9: AG Grid Shared Wrapper (리뷰 대기)

**검토 포인트:**
- `GridContent.vue`의 `gridContainer` ref를 이용한 동적 높이 리사이징 로직이 `useEffect` + `ResizeObserver`로 올바르게 이식되었는지 확인.
- `GridApi` 노출(`useImperativeHandle` 또는 `ref` 포워딩)이 부모 컴포넌트에서 사용 가능한 형태인지 확인.
- `rowSelection` props 처리: `"single"` / `"multiple"` 타입이 AG Grid React v35 API(`rowSelection` 객체 타입)와 일치하는지 확인.
- AG Grid React의 `onGridReady` 콜백을 통해 `GridApi`를 획득하는 패턴인지 확인 (Vue의 `expose`와 달리 이벤트 기반).

**주의 사항:**
- AG Grid v35부터 `rowSelection`이 객체 타입으로 변경됨 — 문자열 `"single"` 사용 시 deprecation 경고 또는 타입 오류 발생 가능.
- `columnDefs` memoization 누락 시 리렌더링마다 컬럼이 재정의되어 성능 저하 발생.

---

### PR#19 — Issue #10: Auth Pages Migration (리뷰 대기)

**구현 완료 사항:**
- `LoginPage.tsx`: React Hook Form + yup, 비밀번호 표시/숨김, 비밀번호 재설정 Dialog.
- 재설정 성공/실패 피드백을 `toast.success()` / `toast.error()`로 처리 (inline Alert 제거).
- MUI v7 `slotProps.input` API 사용 (deprecated `InputProps` 대체).

**향후 검토 필요:**
- `PasswordResetConfirmPage` (재설정 링크 클릭 후 새 비밀번호 입력 화면) 구현 여부 — Issue #10 범위에 포함되어 있는지 확인 필요.
- `RegisterPage` (회원가입)가 Vue에 존재한다면 Issue #10 또는 별도 이슈로 처리 결정 필요.

---

### Issue #11: Dashboard Migration (미시작)

**범위 파악 필요:**
- Vue `src/views/dashboard/` 하위의 위젯 목록 확인 필요 (ApexCharts 기반 차트, 통계 카드, 알림 패널 등).
- `useNotificationsStore` (Pinia) → Zustand 혹은 TanStack Query로 대체 전략 결정 필요.
  - 폴링 기반이라면 TanStack Query `refetchInterval` 활용.
  - WebSocket/STOMP 기반이라면 별도 Zustand store 또는 Effect 기반 구독.
- ApexCharts → `react-apexcharts` 패키지 확인 (동일 벤더, 대응 API 유사).

**권장 브랜치:** `feature/react-dashboard`

**선행 조건:** PR#19, PR#20 merge 완료.

---

### Issue #12: Public Community Pages (미시작)

**범위 파악 필요:**
- 게시판 목록, 게시글 상세, 댓글 목록 등 `src/views/studio/public/` 하위 뷰 확인.
- 페이지네이션/무한스크롤 패턴 확인 — TanStack Query `useInfiniteQuery` 적용 여부 결정.
- AG Grid 사용 페이지가 있다면 Issue #9의 `GridContent` React wrapper 완료 후 착수.

**권장 브랜치:** `feature/react-public-community`

**주의 사항:**
- Vue `StudioPublicRoutes`에 정의된 경로와 React Router 트리의 경로가 1:1 매핑되어야 기존 공유 링크가 유효함.

---

### Issue #13: Admin/Security Pages (미시작)

**범위 파악 필요:**
- `src/views/studio/mgmt/` 하위 관리자 뷰 목록 확인.
- 역할 기반 접근 제어(role guard)가 React Router 레이어에서 올바르게 동작하는지 통합 테스트 필요.
- 사용자 관리 테이블이 AG Grid를 사용한다면 Issue #9 wrapper 완료 선행 필수.

**권장 브랜치:** `feature/react-admin-security`

**주의 사항:**
- 관리자 전용 API 엔드포인트는 403 응답 시 React Router redirect 처리가 auth guard와 이중으로 작동하지 않도록 주의.

---

### Issue #14: Editor & Upload Integration (미시작)

**범위 및 고위험 영역:**
- **TipTap**: `@tiptap/react` 패키지로 전환. Vue 3용 Extension 설정과 React용 설정이 대부분 동일하나 `EditorContent` 컴포넌트 API 차이 확인.
- **파일 업로드**: `vue-filepond` → `react-filepond` 또는 `@uppy/react` 전환. Uppy의 경우 `@uppy/core` + `@uppy/react` 조합으로 사용.
- **Ace Editor**: `vue3-ace-editor` → `react-ace` 전환.

**권장 브랜치:** `feature/react-editor-upload`

**주의 사항:**
- TipTap Extension 커스터마이징이 있다면 Vue 전용 NodeView를 React NodeView로 재구현 필요.
- 파일 업로드는 백엔드 API 엔드포인트 변경 없이 프론트엔드 라이브러리만 교체이므로 비교적 안전.
- 이 Phase는 다른 페이지 마이그레이션과 독립적이므로 Issue #12, #13과 병렬 진행 가능.

---

### Issue #15: Vue Cleanup & Dependency Removal (미시작)

**실행 순서 (순차 필수):**
1. `src/views/`, `src/components/`, `src/stores/`, `src/plugins/`, `src/router/` 에서 `.vue` 파일 및 Vue 전용 모듈 삭제.
2. `src/main.ts`, `src/App.vue` 삭제 (React `src/main.tsx`가 이미 진입점).
3. `package.json`에서 Vue 관련 패키지 제거 (`vue`, `vue-router`, `pinia`, `vuetify`, `ag-grid-vue3`, `@tiptap/vue-3`, `vue-filepond`, `vue3-ace-editor`, `vue3-apexcharts`, `@vitejs/plugin-vue`, `vue-tsc` 등).
4. `vite.config.ts`에서 `@vitejs/plugin-vue` 설정 제거.
5. `tsconfig.json`에서 Vue 전용 설정 제거 (`@vue/tsconfig` 참조 등).
6. ESLint config에서 `eslint-plugin-vue`, `@vue/eslint-config-*` 제거.
7. `npm run build` + `npm run lint` 통과 확인.

**주의 사항:**
- `src/config/`, `src/utils/`, `src/types/`, `src/data/`, `src/messages/` 하위의 순수 TypeScript 모듈은 Vue에 종속되지 않는 한 유지.
- Phase 5의 모든 이슈(#10~#14)가 완료·merge된 후에만 착수.

---

### 세부 계획 검토 요약

**현재 계획의 모호한 부분:**

1. **Issue #4~#6의 단일 브랜치 처리**: 세 이슈를 `feature/react-migration-phase4-6` 하나로 묶어 처리함. 이후 이슈는 각각 독립 브랜치로 분리하고 있어 일관성 개선이 필요. 추후 이슈에서는 이슈당 브랜치 1:1 원칙 유지 권장.

2. **Phase 4의 범위 확장**: 원래 계획에서 Phase 4는 "Shared UI and State"였으나 실제로는 TanStack Query(Issue #8), Toast/Confirm(Issue #7), AG Grid(Issue #9)까지 포함됨. 이는 타당한 범위이나, 각 항목의 완료 정의(acceptance criteria)가 충분히 구체화되어야 함.

3. **Issue #10 (Auth Pages) 범위**: LoginPage는 구현되었으나 PasswordResetConfirmPage 및 RegisterPage 포함 여부가 명시되지 않음. 이슈 닫기 전에 범위 재확인 필요.

4. **PR#17 (Issue #8) 미해결 지적사항**: `unwrapApiResponse` 취약성과 `appQueryKeys.auth` 충돌 가능성이 리뷰에서 지적되었으나 별도 이슈로 추적되지 않음. 페이지 마이그레이션 전에 Issue를 생성하여 해결 권장.

5. **테스트 전략 부재**: 현재 테스트 런너가 미구성 상태. 피드백 레이어(Toast/Confirm)의 singleton 경로 및 concurrent 호출 시나리오는 단위 테스트가 없으면 회귀 위험이 높음. Vitest + Testing Library 도입을 Issue로 등록하는 것을 권장하나 마이그레이션 블로커는 아님.

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

PR 및 커밋 메시지에 아래 형식을 사용하세요.

### 기본 체크리스트

```text
Validation
- [ ] npm run build  (타입 오류 없음)
- [ ] npm run lint   (ESLint 오류 없음)
- [ ] npm run typecheck
```

### Phase별 추가 검증 항목

**Phase 3 (Auth):**
```text
- [ ] manual: 로그인 성공 후 대시보드 이동
- [ ] manual: 잘못된 자격증명으로 로그인 시 오류 메시지 표시
- [ ] manual: 보호된 경로에 미인증 상태로 접근 시 /auth/login?returnUrl=... 리디렉트
- [ ] manual: 로그인 후 returnUrl로 정상 복귀
- [ ] manual: 로그아웃 후 재접근 시 리디렉트 유지
- [ ] manual: 탭/브라우저 새로고침 후 세션 유지 (리프레시 토큰 정상 작동)
```

**Phase 4 (Shared UI):**
```text
- [ ] manual: toast.success / toast.error 정상 표시 및 자동 닫힘
- [ ] manual: 연속 토스트 호출 시 각각 독립적인 타이머로 동작
- [ ] manual: confirm() 사용자 확인 → true 반환
- [ ] manual: confirm() 사용자 취소 → false 반환
- [ ] manual: confirm() 연속 2회 호출 시 순차 처리 (겹치지 않음)
- [ ] manual: GridContent 렌더링, 행 선택, 컬럼 자동 너비
```

**Phase 5 (Page Migration):**
```text
- [ ] manual: 페이지 핵심 시나리오 (CRUD 또는 조회) 완료
- [ ] manual: 폼 유효성 검사 오류 메시지 표시
- [ ] manual: API 오류 시 toast 피드백 표시
- [ ] manual: 역할 제한 페이지 접근 시 /unauthorized 리디렉트
- [ ] manual: 기존 Vue 경로와 동일한 URL 경로 유지
```

**Phase 6 (Vue Cleanup):**
```text
- [ ] npm run build  (.vue 파일 참조 없음)
- [ ] npm run lint   (Vue 플러그인 규칙 없음)
- [ ] manual: 전체 핵심 시나리오 재검증 (Phase 3 체크리스트 반복)
```

### AI-assisted 커밋 메시지 형식

```text
[ai-assisted] feat(react-pages): migrate community post list page

Validation
- npm run build ✅
- npm run lint ✅
- manual: 게시글 목록 조회 ✅
- manual: 페이지네이션 동작 ✅
- manual: 미인증 접근 시 리디렉트 ✅

Co-authored-by: Claude Sonnet 4.6 <noreply@anthropic.com>
```
