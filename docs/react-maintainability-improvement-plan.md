# React Maintainability Improvement Plan

## Purpose

이 문서는 `2.x` React 전환 이후 유지보수성과 향후 기능 추가를 개선하기 위한 디렉토리 구조 및 소스 코드 정리 방향을 정의한다.

`MIGRATION_2X.md`는 Vue에서 React로 전환한 이력과 마이그레이션 상태를 기록하는 문서로 유지한다. 이 문서는 마이그레이션 완료 이후의 구조 개선, 경계 정리, 점진적 리팩터링 순서를 다룬다.

## Current Assessment

- 활성 `2.x` 런타임은 `src/main.tsx`에서 React 앱을 부트스트랩한다.
- React 코드의 대부분은 `src/react/` 아래에 모여 있으며, 라우팅, 인증, query, feedback, layout, page가 React 기준으로 구성되어 있다.
- 일부 Vue-era 소스와 설정은 아직 저장소에 남아 있다.
  - `src/views/` — 35개 `.vue` 파일. 비활성 Vue 참조 소스이며 React 라우터에서 참조하지 않는다.
  - `src/components/` — 20개 `.vue` 파일(ag-grid 래퍼, 인증 폼, 토스트 등). React 트리에서 참조하지 않는다.
  - `src/data/`, `src/stores/`, `src/plugins/` — Vue 시기 데이터 레이어. `tsconfig.json` `include` 범위 밖이라 타입 검사가 되지 않는다.
  - `package.json` — `eslint-plugin-vue`, `@vue/eslint-config-prettier`, `@vue/eslint-config-typescript`, `@vue/tsconfig`, `@mdi/font` 5개 Vue devDependency 잔존.
  - `eslint.config.mjs` — Vue 전용 config(`pluginVue`, `vue/*` 규칙 전체)가 그대로 활성화되어 있어 React 코드에 대한 ESLint 검사가 실질적으로 동작하지 않는다.
  - `vite.config.ts` — `// Removed vuetify()` 주석 잔존. 런타임 영향은 없다.
  - `src/plugins/vuetify.ts`, `src/plugins/pinia.ts` — 완전한 데드코드. React 런타임에서 참조하지 않는다.
- 다음 세 React 파일이 타입 검사 범위 밖인 `src/data/` Vue-era 데이터 레이어를 직접 import한다.
  - `src/react/pages/documents/api.ts` → `@/data/studio/mgmt/document`
  - `src/react/pages/objectstorage/api.ts` → `@/data/studio/mgmt/storage`
  - `src/react/pages/forums/admin/ForumRoleMatrixGuide.tsx` → `@/data/studio/mgmt/forums`
  - `src/react/components/ag-grid/gridOptions.ts` → `@/components/ag-grid/locale/ko-KR` (`.ts` 파일이나 Vue-era 위치)
  - 이 파일들은 `src/data/` → `src/plugins/axios.ts` → `src/react/auth/store` 체인을 통해 동작하므로 런타임은 정상이나, tsconfig `include` 밖에 위치하여 타입 오류가 검출되지 않는 잠재 위험이 있다.
- 일부 React 기능은 `src/react/pages/<domain>/` 안에 page, dialog, API, query key, datasource가 함께 섞여 있어 기능 추가 시 변경 범위가 커질 수 있다.
- `AppRouter.tsx`와 `AdminRoutes.tsx`는 라우트가 계속 누적되는 구조라 향후 도메인별 route 분리가 필요하다. `AppRouter.tsx` 30개, `AdminRoutes.tsx` 15개 route 요소가 단일 파일에 나열되어 있다.
- 큰 화면 컴포넌트는 상태, 이벤트, API 호출, 렌더링이 한 파일에 집중된 곳이 있어 변경 충돌과 회귀 위험이 높다.
- `AclPage`는 `admin/acl` 라우트에 등록되어 있으나 파일 위치가 `src/react/pages/acl/`로 admin 경계 밖에 있어 구조적 불일치가 존재한다.

## Improvement Principles

- 동작 변경 없는 구조 개선은 기능 변경과 분리한다.
- 기존 React 런타임 패턴을 존중하고, 한 번에 전체 구조를 재작성하지 않는다.
- 신규 기능부터 목표 구조를 적용하고, 기존 코드는 해당 기능을 수정할 때 점진적으로 이동한다.
- Vue-era 코드와 React runtime 코드의 경계를 명확히 한다.
- 공용 코드는 실제로 여러 도메인에서 쓰이는 경우에만 `shared` 영역으로 이동한다.
- 큰 컴포넌트 분해는 재사용 추상화가 아니라 상태, 이벤트, 화면 단위 분리를 기준으로 한다.
- 각 변경 단위는 `npm run typecheck`, `npm run lint`, `npm run build` 중 최소 하나 이상의 실행 가능한 검증 기록을 남긴다.

## Recommended Target Structure

목표 구조는 새 기능과 리팩터링 대상부터 점진적으로 적용한다.

```text
src/react/
├── app/
│   ├── App.tsx
│   ├── providers/
│   └── routes/
├── shared/
│   ├── api/
│   ├── auth/
│   ├── feedback/
│   ├── grid/
│   ├── layout/
│   ├── query/
│   └── ui/
├── features/
│   └── <domain>/
│       ├── api/
│       ├── components/
│       ├── pages/
│       ├── queries/
│       └── routes.tsx
└── pages/
    └── legacy-route-owned-pages/
```

### Directory Roles

- `app/`: 애플리케이션 조립 계층이다. provider, top-level route composition, runtime bootstrap에만 사용한다.
- `shared/`: 여러 기능에서 실제로 공유하는 React 공용 코드만 둔다.
- `features/<domain>/`: 기능별 API, query key, 화면, dialog, datasource, route 정의를 함께 둔다.
- `pages/`: 즉시 feature 이동이 어려운 기존 route-owned page를 임시로 유지하는 위치다. 신규 기능의 기본 위치로 사용하지 않는다.

이 구조는 즉시 전체 이동을 요구하지 않는다. 기존 `src/react/auth`, `src/react/query`, `src/react/feedback`, `src/react/components/ag-grid`, `src/react/layouts`는 첫 단계에서 유지하고, 공용 경계 정리 이슈에서 `shared` 또는 `app`로 이동한다.

## Execution Plan

### 1. React-only cleanup

목표는 React 런타임과 무관한 Vue 전환 잔여물을 정리하는 것이다.

- `package.json`에서 더 이상 사용하지 않는 Vue devDependency를 제거한다.
  - 제거 대상: `eslint-plugin-vue`, `@vue/eslint-config-prettier`, `@vue/eslint-config-typescript`, `@vue/tsconfig`, `@mdi/font`
- `eslint.config.mjs`를 React/TypeScript 기준으로 전환하고 Vue rule을 제거한다.
  - 현재 `pluginVue.configs["flat/essential"]`, `vueTsConfigs.recommended`, `vue/*` 규칙 전체가 활성화되어 있어 React 코드에 ESLint가 실질적으로 동작하지 않는 상태다. 이 단계에서 React/TypeScript 규칙 세트로 교체하는 것이 최우선이다.
- `vite.config.ts`의 `// Removed vuetify()` 잔여 주석을 제거한다.
- `src/plugins/vuetify.ts`, `src/plugins/pinia.ts`를 삭제한다. 두 파일 모두 React 런타임에서 참조하지 않는 완전한 데드코드다.
- `src/views/` 등 비활성 Vue 참조 소스 삭제는 별도 cleanup 이슈로 분리한다.
- React 코드가 아직 참조하는 Vue-era 공용 코드가 있으면 먼저 React 공용 위치로 이동한 뒤 삭제한다.

검증:
- `npm install` 또는 lockfile 갱신 확인
- `npm run typecheck`
- `npm run lint` (전환 후 React 코드에서 새롭게 검출되는 lint 오류 확인)
- `npm run build`

### 2. Shared boundary cleanup

목표는 admin 또는 Vue-era 위치에 남아 있는 공용 코드를 React 공용 경계로 이동하는 것이다.

- 다음 React 파일들이 타입 검사 범위 밖인 `src/data/` Vue-era 레이어를 직접 import하고 있다. 이 파일들을 기능 변경 시 `src/react/query/fetcher.ts` 또는 `shared/api` 계층 기준으로 점진 전환한다.
  - `src/react/pages/documents/api.ts` → `@/data/studio/mgmt/document` 의존 제거
  - `src/react/pages/objectstorage/api.ts` → `@/data/studio/mgmt/storage` 의존 제거
  - `src/react/pages/forums/admin/ForumRoleMatrixGuide.tsx` → `@/data/studio/mgmt/forums` 의존 제거
- AG Grid locale/options는 Vue-era `src/components/ag-grid`가 아니라 React 공용 grid 영역에서 소유한다.
  - `src/react/components/ag-grid/gridOptions.ts`가 `@/components/ag-grid/locale/ko-KR`를 import하고 있다. React 공용 위치로 locale 파일을 이동한 뒤 참조를 교체한다.
- page-local datasource 파일(`acl/datasource.ts`, `admin/datasource.ts`, `mail/datasource.ts` 등)은 기능 이동 시 feature 모듈 안으로 함께 이동한다. 공용 베이스 클래스가 필요해지면 그때 `shared/grid`로 추출한다.
- `src/types/ag-gird`는 별도 refactor 이슈에서 `ag-grid`로 rename한다.
- React API 호출은 가능하면 `src/react/query/fetcher.ts` 또는 이후 `shared/api` 계층 기준으로 통일한다.

검증:
- `npm run typecheck`
- `npm run lint`
- 주요 grid 화면 smoke test (문서 목록, 오브젝트 스토리지, 메일 인박스)

### 3. Feature module cleanup

목표는 기능 추가와 유지보수 시 변경 범위를 도메인 단위로 좁히는 것이다.

- 신규 기능은 `features/<domain>/` 구조로 추가한다.
- 기존 기능은 수정이 발생하는 도메인부터 API, query, dialog, page를 같은 feature 폴더로 이동한다.
- feature 내부 파일명은 역할이 드러나게 유지한다.
  - `api/`
  - `queries/`
  - `components/`
  - `pages/`
  - `routes.tsx`
- 단순히 파일 수를 줄이기 위한 barrel export는 추가하지 않는다. import 경계가 명확해질 때만 사용한다.

검증:
- 이동 대상 도메인의 route 진입 smoke test
- `npm run typecheck`
- `npm run lint`

### 4. Large component split

목표는 큰 컴포넌트의 변경 위험을 줄이는 것이다.

우선 검토 대상 (라인 수 기준):
- `DocumentEditorPage.tsx` — 828줄. 상태, 편집, API 호출, 렌더링이 단일 파일에 집중. 최우선 분해 대상.
- `ForumAclPage.tsx` — 619줄
- `AclPage.tsx` — 603줄
- `FullLayout.tsx` — 593줄. 레이아웃 컴포넌트로서 비정상적으로 큰 크기이며 도메인 로직 혼재 가능성이 높다.

분해 기준:
- API 호출과 query/mutation 로직은 feature query 또는 hook으로 분리한다.
- dialog/form은 독립 컴포넌트로 분리한다.
- 화면의 선택 상태, 편집 상태, filter 상태는 hook으로 분리하되 재사용을 전제로 과도하게 일반화하지 않는다.
- 레이아웃 전용 컴포넌트와 도메인 전용 컴포넌트를 섞지 않는다.

검증:
- 대상 화면 route 진입
- 주요 조회/생성/수정/삭제 action smoke test
- `npm run typecheck`
- `npm run lint`

### 5. Router cleanup

목표는 top-level router 파일의 비대화를 줄이고 도메인별 route ownership을 명확히 하는 것이다.

- `AppRouter.tsx`는 top-level layout과 feature route composition만 담당하게 한다. 현재 30개 route 요소가 단일 파일에 나열되어 있다.
- `AdminRoutes.tsx`는 admin 도메인 route를 직접 모두 나열하지 않고 admin feature route 모듈을 조합한다. 현재 15개 route 요소가 단일 파일에 나열되어 있다.
- 각 feature는 필요한 경우 `routes.tsx`를 export한다.
- `AclPage`는 `admin/acl` 라우트에 등록되어 있으나 `src/react/pages/acl/`에 위치한다. Feature 구조 이동 시 `features/admin/acl/` 또는 `features/acl/`로 위치를 통일하고 라우트 등록 위치와 일치시킨다.
- route path 변경은 구조 개선 범위에 포함하지 않는다. URL 호환성을 유지한다.

검증:
- 기존 route 목록 smoke test (주요 admin, 공개 포럼, 대시보드 경로)
- `/404`, `/unauthorized`, `/auth/login` fallback 확인
- `npm run typecheck`

## Recommended Work Order

1. `refactor/react-only-cleanup`
2. `refactor/react-shared-boundaries`
3. `refactor/react-feature-structure-guideline`
4. `refactor/react-large-page-split-documents`
5. `refactor/react-large-page-split-admin-acl`
6. `refactor/react-router-modules`

각 작업은 별도 이슈와 MR로 분리한다. Issue 생성이 불가능한 경우 커밋 본문 또는 MR 본문에 사유와 배경을 기록한다.

## Validation Record Template

각 MR에는 다음 형식으로 검증 기록을 남긴다.

```text
Validation:
- npm run typecheck: pass
- npm run lint: pass
- npm run build: pass
- Smoke test: <tested route and action>
```

## Assumptions

- `2.x`의 활성 런타임은 React-only로 간주한다.
- Vue 소스는 삭제 전까지 참조 자료로만 취급하며, 신규 기능은 React 기준으로 작성한다.
- 구조 개선은 사용자 동작 변경을 목표로 하지 않는다.
- 기능 추가와 리팩터링은 가능한 한 별도 작업 단위로 분리한다.
