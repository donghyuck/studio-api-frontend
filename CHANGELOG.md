# Changelog

## 2026-08-20

### Added

- 파일 상세 Metadata 탭에서 비한국어 문서 요약을 `한국어로 보기`로 번역하고 `원문으로 보기`로 전환할 수
  있게 했다. 원문 summary·keywords는 유지하며 서버에 저장된 revision-bound 한국어 번역을 재사용한다.
  번역 진행·실패는 원문 표시와 분리하고 클릭당 요청 1회만 실행한다.

## 2026-08-14

### Changed

- Markdown 보기의 기본 탭에서는 metadata API를 선조회하지 않는다. Metadata 탭은 compact summary와
  pipeline progress만 먼저 읽고, 큰 resource/locator payload는 사용자가 `상세 데이터 불러오기`를 선택한
  뒤에만 현재 revision 기준으로 조회하며 같은 dialog 세션에서는 캐시를 재사용한다.
- Markdown RAG 색인 요청은 LLM keyword extraction을 활성화해 서버가 문서·chunk keyword 신호를 생성할 수
  있게 했다.
- 파일 상세 문서 Q&A의 고정 대표질문을 서버의 현재 revision 기반 `question-suggestions` 응답으로
  교체했다. 추천 질문을 클릭하면 반환된 `query`를 그대로 기존 RAG 질문 경로에 전송하며,
  `AVAILABLE`, `NOT_READY`, `NO_SIGNALS`, 조회 실패를 구분해 표시하고 고정 질문으로 대체하지 않는다.

### Verification

- `npm test -- --run src/react/pages/files/DocumentQaWorkspace.test.tsx --pool=threads --maxWorkers=1 --no-file-parallelism` 5건 통과
- `npm run typecheck` 통과

## 2026-08-11

### Fixed

- EPUB 미리보기에서 비동기 `epubjs` 팩토리의 반환값을 `Book`으로 잘못 사용해 발생하던
  `book.renderTo is not a function` 오류를 수정했다. 리더 종료 중 정리 오류도 격리해 창을 닫은 뒤
  전체 화면이 흰색으로 남지 않도록 했다.

### Verification

- `npx vitest run src/react/pages/files/epubReaderSession.test.ts --pool=threads --maxWorkers=1 --no-file-parallelism --reporter=verbose` 3건 통과
- `npm run typecheck` 통과
- attachment `19` EPUB 미리보기의 본문 iframe 렌더링과 종료 후 파일 상세 화면 복구 확인
- `npm run build` 통과

## 2026-08-10

### Changed

- 파일 상세의 문서 Q&A를 공용 대화 목록과 단일 composer 중심으로 재구성했다. 문서·웹 자료와
  응답 설정은 각각 하나의 진입점으로 모으고, 빈 화면에는 자주 쓰는 질문을 제공한다.
- 자료나 답변 표현 설정을 바꿔도 기존 대화를 유지하며, 요청 실패는 중복 assistant 메시지 대신
  composer 위의 재시도 가능한 오류 상태로 표시한다.
- `AGENTS.md`의 범위를 실제 프런트엔드 저장소에 맞게 바로잡고, 서버 저장소는 별도 요청이 없는 한
  API 계약 확인을 위한 읽기 전용 대상으로 명시했다.
- 마크다운 보기의 메타데이터 상태를 서버 `usability` 판정으로 통합하고, 문서 품질·색인 허용·색인
  실행·검색 가능·자동 평가 상태를 분리해 표시한다. 측정값 `0`은 실제 값으로 유지하고 EPUB의 고정
  페이지 지표는 적용 대상 아님으로 표시한다.
- 검색 가능한 현재 리비전에 대해 자동 RAG 평가를 실행하고 완료 후 `usability` 상태를 다시 조회한다.
  과거 리비전을 보고 있을 때는 기준 불일치를 안내하고 평가 실행을 막는다.

### Verification

- `npx vitest run src/react/pages/files/documentUsabilityView.test.ts src/react/pages/files/DocumentUsabilityPanel.test.tsx --pool=threads --maxWorkers=1 --no-file-parallelism --reporter=verbose` 통과
- `npm test -- --pool=threads --maxWorkers=1 --no-file-parallelism` 55건 통과
- `npm run typecheck` 통과
- `npm run build` 통과

## 2026-08-03

### Changed

- RAG 채팅과 첨부 상세 Q&A에 `자동 구성 | 텍스트 중심 | 시각 자료 우선` 선택을 추가하고, 질문에서
  명시한 표·차트 형식 요청은 서버 grounding 정책을 유지한 채 우선 적용한다.
- canonical 답변의 GFM 표와 행별 근거 링크를 표시하고, 서버가 검증된 숫자 표에서 투영한 bounded
  차트만 렌더링한다. 각 표 우측 상단에 마우스를 올리면 나타나는 버튼으로 인용 번호를 포함한 표
  내용을 탭 구분 형식으로 복사할 수 있다. 인용된 PDF page의 `SOURCE_IMAGE`는 canonical
  fingerprint가 일치하고 서버가 발급한 동일
  출처 경로일 때만 표시한다. 모델이 만든 외부 링크·이미지·HTML/SVG는 활성화하지 않는다.

### Fixed

- SITE 웹 자료의 옵션 수정 화면을 서버가 반환한 저장 `crawlPolicy`로 초기화한다. 기존처럼
  capabilities 기본값으로 덮어써 다음 재수집의 깊이·페이지 수와 경로 필터가 의도치 않게 바뀌는
  문제를 수정했다.

### Verification

- `npm test -- --run src/react/pages/ai/components/RagEvidenceSourcePicker.test.tsx` 통과
- `npm test -- --run src/react/pages/ai/components/RagMarkdownRenderer.test.tsx src/react/pages/ai/components/RagAnswerPresentationSelector.test.tsx src/react/pages/ai/components/RagAnswerBlocks.test.tsx` 통과
- `npm run typecheck` 통과
- 전체 Vitest 43건과 production build 통과
- `npm audit --omit=dev`는 기존 `react-router` 및 `epubjs`/`xmldom` 계열 4건 때문에 실패하며,
  breaking downgrade/major upgrade가 필요한 별도 의존성 정비 항목으로 남긴다.

## 2026-07-27

### Changed

- RAG 답변 방식과 별도로 `문서만 사용 | 문서 + 공식 외부 자료` 검색 자료 범위를 선택하고,
  서버 capabilities에 따라 사용할 수 없는 외부 자료 모드를 안내한다. 범위 변경 시 이전 대화와
  근거가 섞이지 않도록 새 대화를 시작하며 공식 외부 근거는 발행기관·기준일·검증된 HTTPS 링크를 표시한다.
- RAG canonical 답변을 제목·문단·목록·인용문·코드·수식 구조가 구분되는 안전한 Markdown으로
  표시한다. 원문 HTML은 실행하지 않으며 검증 완료된 근거 번호만 기존 근거 상세 동작에 연결한다.
- RAG 응답의 `ANSWERED | EVIDENCE_ONLY | ABSTAINED` outcome을 공통 view model로 해석하고 검색 실패,
  packing 실패, 인용 실패를 구분해 표시한다.
- 검증 실패 시 inline citation 대신 “검색된 근거 후보”와 500자 이하 `exactText`를 표시하며 검색
  score는 백분율 관련도가 아닌 raw 값으로 표시한다.
- RAG SSE는 `complete.canonicalContent` 수신 전 답변 본문과 citation을 표시하지 않는다.
- 첨부 상세 Q&A의 고정 `minScore=0.35`와 일반 사용자 요청의 `debug=true`를 제거해 서버 검색
  기본값과 공개 응답 계약을 사용한다.
- `FACTUAL_LIST` 부분 답변의 `partial`과 제외 항목 수를 표시하면서 검증된 canonical 인용 링크는
  정상적으로 활성화한다.

### Verification

- `npm test` 통과
- `npm run typecheck` 통과
- `npm run build` 통과

## 2026-07-20

### Added

- 마크다운 상세 드로어 내 RAG Q&A (Ask Gemini) 질문답변 탭 및 스크롤 이동 플로팅 화살표 버튼 추가.
- Q&A 답변 생성 시 토큰 사용량(Token Usage) 및 응답 속도(Latency) 실시간 표기 지원.
- RAG 색인 완료 시 임베딩 프로파일 및 문서 종류 선택 드롭다운 변경 비활성화(disabled) 잠금 처리.
- 파이프라인 부하 추산(estimate) API DTO 및 페이로드 누락 필드 매핑 보강.
- 자동 감지(AUTO) 및 프로필 변경 시 추천 처리 계획(processingPlan.effectiveOptions) 체크박스 실시간 동기화.

### Verification

- `npm run typecheck` 통과
- `git diff --check` 통과

## 2026-07-04

### Added

- 마크다운 생성 및 재추출 화면에서 OCR 모드(AUTO, FORCE, DISABLED)와 Vision LLM 수식 보정(mathVisionCorrection)을 지원하는 추출 옵션 제공.
- OCR 적용 시 활성화되는 고급 옵션 "Vision LLM 수식 보정 사용" 체크박스(설명 문구 포함) 추가.
- 마크다운 메타데이터 보기 화면에 "Vision LLM 수식 보정" 상태 카드 및 세부 속성(요청, 적용, Provider, 수식 블록 수, 미적용 사유) 렌더링 추가.
- 신규 재추출 영역에 "OCR 적용 후 재추출" 및 "수식 OCR 적용 후 재추출" 분리 버튼 제공.

### Verification

- `npm run typecheck` 통과

## 2026-04-28

### Changed

- AI RAG management now uses a job-list-first screen with `sourceName` document display and a dedicated job detail route for logs, chunks, and metadata.
- AI RAG management now exposes the chunking simulation dialog from the job list toolbar.
- AI RAG job list and detail pages now follow the admin users list/detail layout pattern with icon-only list actions and right-side detail contents navigation.
- AI RAG job list status chips now include status icons so failed and warning jobs are distinguishable beyond background color.
- AI RAG job detail now renders the indexed chunk result grid directly instead of hiding it behind an accordion.
- AI RAG job detail chunk grid now follows the ACL entry grid pattern with a section header, taller grid, and row tooltips.
- AI RAG job detail summary now shows the chunking strategy, falling back to chunk metadata when the job response does not include explicit chunking fields.
- AI RAG search validation now lives on the job list page and runs against the selected job scope, while the job detail page focuses on progress, chunks, logs, and metadata.
- AI RAG job detail summary now includes a progress stepper for pending, extraction, chunking, embedding, indexing, and completion states.
- AI RAG job detail now shows selected chunk details in a structured inspector with content, provenance, chunk links, embedding fields, and collapsed raw metadata.
- AI RAG job detail no longer shows a separate object metadata section because selected chunk metadata is available in the chunk inspector.
- AI RAG job detail now shows failure and warning logs as a direct grid section instead of an accordion.
- AI RAG job detail chunk review now uses compact provenance, length quality bars, a smaller status chip, a two-column chunk inspector, image-caption cues, and a selected-chunk similarity test action.

### Verification

- AI RAG job list/detail split: `npm run typecheck`
- AI RAG job list/detail split: `npm run lint`
- AI RAG job list/detail split: `npm run build`
- AI RAG chunking simulation dialog: `npm run typecheck`
- AI RAG chunking simulation dialog: `npm run lint`
- AI RAG admin-users layout alignment: `npm run typecheck`
- AI RAG admin-users layout alignment: `npm run lint`
- AI RAG status icon chips: `npm run typecheck`
- AI RAG status icon chips: `npm run lint`
- AI RAG direct chunk grid detail: `npm run typecheck`
- AI RAG chunk grid ACL-entry alignment: `npm run typecheck`
- AI RAG chunk grid ACL-entry alignment: `npm run lint`
- AI RAG chunking strategy summary: `npm run typecheck`
- AI RAG search validation list move and detail stepper: `npm run typecheck`
- AI RAG search validation list move and detail stepper: `npm run lint`
- AI RAG chunk detail inspector: `npm run typecheck`
- AI RAG chunk detail inspector: `npm run lint`
- AI RAG detail metadata section removal: `npm run typecheck`
- AI RAG detail metadata section removal: `npm run lint`
- AI RAG direct failure and warning log grid: `npm run typecheck`
- AI RAG direct failure and warning log grid: `npm run lint`
- AI RAG chunk review efficiency UI: `npm run typecheck`
- AI RAG chunk review efficiency UI: `npm run lint`

## 2026-04-13

### Changed

- File management now restores Vue-parity creator display, multi-select deletion, Uppy upload, drawer-based file details with thumbnails, text extraction, and RAG indexing metadata workflows.
- Template management now aligns list selection/deletion and object type selection with the file management UI.
- ACL management API calls now use the server-aligned `/api/mgmt/acl` base path.
- ACL management now maps object identity DTO fields to the server contract to avoid undefined OID labels.
- ACL entry rows now provide explanatory tooltips for target object, SID, action, decision, order, and audit behavior.

### Verification

- File management UI improvements: `npm run typecheck`
- File management UI improvements: `npm run lint`
- File management UI improvements: `npm run build`
- Template management UI alignment: `npm run typecheck`
- Template management UI alignment: `npm run lint`
- Template management UI alignment: `npm run build`
- ACL management API path alignment: `npm run typecheck`
- ACL management API path alignment: `npm run lint`
- ACL management API path alignment: `npm run build`
- ACL object identity field mapping: `npm run typecheck`
- ACL object identity field mapping: `npm run lint`
- ACL entry explanatory tooltips: `npm run typecheck`
- ACL entry explanatory tooltips: `npm run lint`
- ACL entry explanatory tooltips: `npm run build`

## 2026-04-10

### Changed

- Object Storage list and detail pages now disable AG Grid column filters, the provider detail page uses the shared PageToolbar header, the object path uses an active-last breadcrumb, file and folder rows show icons in the object name column, object sizes use readable byte units, and object details open in a drawer with metadata, share URL copy/expiry, preview gating, and automatic image/video preview support.
- Issue `#95` aligns role-group assignment calls with the group-based role replacement API to avoid unsupported role-based group POST calls.
- Issue `#93` simplifies the role detail group assignment dialog to a transfer-list style flow for smaller group sets.
- Issue `#93` prevents stale role group assignment state from remaining after load failures and disables transfer actions while loading or saving.
- Issue `#91` restores group detail properties editing with the shared accordion-based AG Grid editor and dedicated group properties API.
- Issue `#89` restores user detail properties editing with a reusable accordion-based AG Grid editor backed by the dedicated user properties API.
- Issue `#87` improves role detail user/group assignment dialogs with search-driven multi-select assign/revoke flows and current assignment grids.
- Issue `#85` standardized dialog shell rounding and footer action button variants across create/edit and admin management dialogs.
- Issue `#83` aligned React group member deletion with the server contract by sending `DELETE /api/mgmt/groups/{id}/members` requests with `{ userIds: [...] }` bodies for both single and multiple deletion.
- Neutral outlined close/cancel button styling is now provided by the MUI theme instead of per-dialog overrides.

### Verification

- Object Storage toolbar and grid filters: `npm run typecheck`
- Object Storage toolbar and grid filters: `npm run lint`
- Object Storage toolbar and grid filters: `npm run build`
- Issue `#95`: `npm run typecheck`
- Issue `#95`: `npm run lint`
- Issue `#95`: `npm run build`
- Issue `#95`: manual check - role group assignment no longer calls `POST /api/mgmt/roles/{roleId}/groups`
- Issue `#93`: `npm run typecheck`
- Issue `#93`: `npm run lint`
- Issue `#93`: `npm run build`
- Issue `#93`: manual check - role group assignment transfer-list flow reviewed in code
- Issue `#93`: review fix - stale role group assignment state is cleared and save/transfer actions are guarded during load/save
- Issue `#93` review fix: `npm run typecheck`
- Issue `#91`: `npm run typecheck`
- Issue `#91`: `npm run lint`
- Issue `#91`: `npm run build`
- Issue `#91`: manual check - group detail properties accordion, save flow, and side nav reviewed in code
- Issue `#89`: `npm run typecheck`
- Issue `#89`: `npm run lint`
- Issue `#89`: `npm run build`
- Issue `#89`: manual check - user detail properties accordion, separate properties save flow, and key validation reviewed in code
- Issue `#87`: `npm run typecheck`
- Issue `#87`: `npm run lint`
- Issue `#87`: `npm run build`
- Issue `#87`: manual check - role detail user/group assignment dialog flows reviewed in code
- Issue `#85`: `npm run typecheck`
- Issue `#85`: `npm run lint`
- Issue `#85`: `npm run build`
- Issue `#85`: manual check - create/edit and admin management dialog shell/action consistency reviewed in code
- Issue `#83`: `npm run typecheck`
- Issue `#83`: `npm run lint`
- Issue `#83`: `npm run build`
- Issue `#83`: manual check - group member delete flow keeps success toast, selection reset, and grid refresh behavior in code
- Neutral button theme: `npm run typecheck`

## 2026-04-07

### Changed
- React login failure audit page header now follows the user list PageToolbar layout pattern.
- React login failure audit page now uses the server-aligned route and field mapping, with toolbar-aligned search controls and grid column filters disabled.
- React login failure audit list now uses `/api/mgmt/audit/login-failure-log` to match the server route.
- Issue `#81` updates group member and role dialogs with batch member selection and transfer-list role editing.
- Issue `#79` stabilizes the user roles dialog loading layout with section skeletons and fixed content heights.
- User roles management dialog now distinguishes group-inherited roles from directly granted roles and uses a transfer-list style editor for direct assignments.
- Managed detail pages for groups, roles, object types, and templates now follow the user detail page layout standard.
- ACL management page and create dialogs now restore explanatory guidance from the legacy Vue implementation.
- Issue `#59` split FullLayout navigation and user menu responsibilities into dedicated layout components.
- Issue `#54` introduced a profile feature module pilot under `src/react/features/profile` while preserving the `/profile` route.
- Issue `#66` restored object type creation in the React `/policy/object-types` page, including Vue-parity ID/code validation fields, array-backed list loading, list ID display, PageToolbar detail header, and detail deletion.
- Issue `#58` removed inactive legacy Vue view sources, Vue component files, and the dangling legacy Vue AG Grid options file outside the React runtime.
- Issue `#60` renamed the misspelled AG Grid shared type path to `src/types/ag-grid`.
- Issue `#53` moved React-facing document, object storage, forum role matrix, and AG Grid locale dependencies into the React TypeScript runtime boundary.
- Issue `#52` removed React-inactive Vue ESLint/Vite cleanup leftovers, deleted dead Vuetify/Pinia plugin entry files, and switched ESLint to a React/TypeScript flat config.
- Issue `#50` added `docs/react-maintainability-improvement-plan.md` to define the post-migration React structure improvement direction for the `2.x` runtime.

### Verification
- Login failure audit toolbar layout: `npm run typecheck`
- Login failure audit page cleanup: `npm run typecheck`
- Login failure audit route: `npm run typecheck`
- Issue `#81`: `npm run typecheck`
- Issue `#81`: `npm run lint`
- Issue `#81`: `npm run build`
- Issue `#81`: manual check - group member and role dialog flows reviewed in code
- Issue `#79`: `npm run typecheck`
- Issue `#79`: `npm run lint`
- Issue `#79`: `npm run build`
- Issue `#79`: manual check - user roles dialog loading layout reviewed in code
- User roles dialog UX: `npm run typecheck`
- User roles dialog UX: `npm run lint`
- User roles dialog UX: `npm run build`
- Admin detail standardization: `npm run typecheck`
- Admin detail standardization: `npm run lint`
- Admin detail standardization: `npm run build`
- Admin detail standardization: manual check - groups/roles/object type/template detail routes reviewed in code
- ACL guidance restore: `npm run typecheck`
- ACL guidance restore: `npm run lint`
- Issue `#59`: `npm run typecheck`
- Issue `#59`: `npm run lint`
- Issue `#59`: `npm run build`
- Issue `#59`: manual check - dashboard/profile/admin route and navigation behavior reviewed in code
- Issue `#54`: `npm run typecheck`
- Issue `#54`: `npm run lint`
- Issue `#54`: `npm run build`
- Issue `#54`: manual check - `/profile` route path reviewed
- Issue `#66`: `npm run typecheck`
- Issue `#66`: `npm run lint`
- Issue `#66`: `npm run build`
- Issue `#66`: manual check - `/policy/object-types` create dialog validation path reviewed
- Issue `#58`: confirmed React runtime paths do not import `src/views` or deleted Vue component files
- Issue `#58`: `npm run typecheck`
- Issue `#58`: `npm run lint`
- Issue `#58`: `npm run build`
- Issue `#58`: smoke test N/A (no React route changes)
- Issue `#60`: confirm no legacy AG Grid type path references remain
- Issue `#60`: `npm run typecheck`
- Issue `#60`: `npm run lint`
- Issue `#60`: `npm run build`
- Issue `#53`: `npm run typecheck`
- Issue `#53`: `npm run lint`
- Issue `#53`: `npm run build`
- Issue `#52`: `npm run typecheck`
- Issue `#52`: `npm run lint`
- Issue `#52`: `npm run build`
- Reviewed the new document against the current React source tree and migration policy documents.
- `npm run typecheck`

## 2026-04-06

### Changed

- React admin/app shell now uses a collapsible left navigation layout, and AG Grid row/pagination alignment was refined for the `2.x` runtime.
- React migration cleanup restored a read-only React admin topic detail page and removed directly superseded Vue mail/object-storage/AI service pages after their React replacements were merged.
- React migration issue `#38` added React mail operations, object storage browsing, and AI chat/RAG pages with route wiring for the `2.x` runtime.
- React migration issue `#39` cleanup removed directly superseded Vue admin pages for ACL, forum admin, and login-failure audit after their React replacements were merged.
- Repository policy documents and issue/MR templates were updated to tighten single-selection rules, add subagent usage recording, and expand policy source precedence.
- `docs/remaining-react-migration-plan.md` now defines a parallel wave-based execution order instead of a purely sequential five-track order.
- The remaining React migration plan now includes an umbrella issue plus child issue registration set for parallel delivery planning.

### Verification

- `npm run typecheck`
- `npm run build`
- Confirmed the React router and page tree now cover the removed ACL/forum-admin/login-failure paths before deleting the legacy Vue files.
- Reviewed updated policy/template diffs for `AGENTS.md`, `AI_DEVELOPMENT_POLICY.md`, `CONTRIBUTING.md`, `.gitlab/issue_templates/default.md`, and `.gitlab/merge_request_templates/default.md`.
- Reviewed the updated migration plan structure against `AGENTS.md`, `AI_DEVELOPMENT_POLICY.md`, and `.gitlab/issue_templates/default.md`.

## 2026-04-03

### Changed

- React migration Phase 1 completed with issue `#4` (`PR #16`): bootstrap baseline established.
- React migration Phase 2 completed with issue `#5` (`PR #16`): routing shell and base layouts migrated.
- React migration Phase 3 completed with issue `#6` (`PR #16`): auth bootstrap gate and session flow migrated.
- React migration Phase 4 completed with issue `#7` (`PR #18`): shared feedback providers migrated.
- React migration Phase 4 completed with issue `#8` (`PR #17`): TanStack Query adapters and conventions migrated.
- React migration Phase 4 completed with issue `#9` (`PR #20`): shared AG Grid wrapper migrated.
- React migration Phase 5 completed with issue `#10` (`PR #19`): auth pages migrated to the React shell.
- React migration Phase 5 completed with issue `#11` (`PR #22`): dashboard migrated to React.
- React migration Phase 5 completed with issue `#12` (`PR #21`): public community pages migrated to React.
- React migration Phase 5 completed with issue `#13` (`PR #24`): admin and security pages migrated to React.
- React migration Phase 5 completed with issue `#14` (`PR #23`): editor and upload integration migrated to React.
- React migration Phase 6 completed with issue `#15` (`PR #25`): Vue runtime cleanup and dependency removal finished.

### Verification

- Migration tracker in `MIGRATION_2X.md` reflects issues `#4` through `#15` as complete.
