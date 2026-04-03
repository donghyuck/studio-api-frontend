# Studio-API-Front-End

Studio-API 를 위한 프론트엔드 저장소입니다.

현재 `2.x` 라인은 React 기반 런타임을 사용합니다. 기존 Vue 소스는 일부 레거시 참조 코드로 남아 있을 수 있지만, 활성 실행 경로와 빌드 경로는 React 기준입니다.

## Runtime

| Name | Role |
| --- | --- |
| React | 활성 애플리케이션 런타임 |
| TypeScript | 정적 타입 기반 구현 |
| Vite | 개발 서버 및 번들링 |
| MUI | 기본 UI 컴포넌트 |
| TanStack Query | 서버 상태 관리 |
| Zustand | 인증/세션 상태 관리 |
| AG Grid React | 그리드 렌더링 |
| Tiptap React | 문서 편집기 |
| Axios | HTTP 클라이언트 |

## Current Structure

```text
src/
├── main.tsx
├── react/
│   ├── App.tsx
│   ├── api/
│   ├── auth/
│   ├── components/
│   │   └── ag-grid/
│   ├── feedback/
│   ├── layouts/
│   ├── pages/
│   │   ├── admin/
│   │   ├── community/
│   │   ├── documents/
│   │   └── files/
│   ├── query/
│   └── router/
├── config/
├── data/
├── types/
└── utils/
```

## Implemented Migration Scope

- Auth pages
- Dashboard
- Public community pages
- Admin and security pages
- Document editor and file upload integration
- Vue runtime cleanup for the active `2.x` path

## Remaining Legacy

- `src/views`, `src/components`, `src/stores`, `src/router`, `src/App.vue` 등 일부 Vue 기반 파일은 저장소에 남아 있을 수 있습니다.
- 이 파일들은 현재 `2.x` 활성 런타임 또는 TypeScript 포함 범위의 일부가 아닙니다.

## Commands

- `npm install`
- `npm run dev`
- `npm run typecheck`
- `npm run build`
- `npm run lint`

## Notes

- 마이그레이션 진행 이력과 현재 상태는 `MIGRATION_2X.md` 를 기준으로 관리합니다.
- 변경 이력은 `CHANGELOG.md` 에 정리합니다.
