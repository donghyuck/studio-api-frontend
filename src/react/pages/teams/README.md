# Team UX server contract

Team 화면은 Company와 독립적인 협업·권한·RAG 경계를 전제로 한다.

## 현재 연동 계약

- `GET|POST /api/teams`
- `GET|PATCH /api/teams/{teamId}`
- `POST /api/teams/{teamId}/archive`
- `GET|POST /api/teams/{teamId}/members`
- `PATCH|DELETE /api/teams/{teamId}/members/{userId}`
- `POST /api/teams/{teamId}/join`
- `GET /api/teams/{teamId}/join-requests?status=PENDING`
- `POST /api/teams/{teamId}/join-requests/{requestId}/approve|reject`
- `GET /api/teams/{teamId}/workspaces/tree`
- `GET /api/teams/{teamId}/knowledge-sources`
- `GET /api/ai/chat/rag/capabilities`의 선택적 `teamRag`
- `POST /api/ai/chat/rag`의 필수 `teamId`와 선택적 `workspaceId` Team scope

Team Workspace 응답은 여러 독립 루트를 담는 forest 배열이다. Team Chat의 전체 범위는 읽을 수 있는
모든 root 트리를 포함하며, `workspaceId`를 지정하면 해당 트리 또는 하위 범위로 제한한다.
Workspace 탭은 `/application/workspaces`와 같은 `WorkspaceListPage`를 Team 고정 모드로 재사용한다.
따라서 트리·테이블·검색·root 생성·drag 이동·파일 목록·상세 관리 기능이 동일하게 동작하며 다른
Team으로 필터를 바꿀 수 없다. 트리에서 Workspace를 선택하면 하단 `파일`과 `외부 URL` 탭에서
첨부파일과 웹 수집 자료를 같은 Workspace 맥락으로 관리한다.

URL 등록·수집·정책 변경은 이 `외부 URL` 탭에서만 수행한다. 파일 상세의 문서 Q&A는 `추가 자료`
버튼으로 현재 문서가 속한 Workspace의 기존 URL 자료를 선택만 하며 새 URL 관리 기능을 노출하지 않는다.
관리 탭은 모든 embedding deployment의 기존 URL을 표시하고, 문서 Q&A는 현재 문서 embedding과 호환되는
URL만 표시한다.
SITE source의 `수집 페이지 목록`에서 각 페이지의 `상세`를 열면 revision·수집 metadata·본문 미리보기를
확인할 수 있으며 전체 normalized snapshot은 불러오지 않는다. `수집 실행 이력`은 AG Grid로 표시한다.

초기 Team domain 응답의 `id`는 API 경계에서 `teamId`로 정규화한다. `rootWorkspaceId`는 서버가
명시적으로 제공할 때만 표시하며, 기본적으로 Workspace tree endpoint에서 root 목록을 확인한다.
일반 Team 생성은 UI에 migration용 선택지를 노출하지 않고 `provisionRootWorkspace=true`를 전송한다.

## Capability fallback

Team 기본 정보·멤버·설정과 Team RAG Chat은 독립적으로 로드한다. 서버가 `teamRag.enabled=true`를
명시하기 전에는 채팅 composer를 비활성화하고 일반 RAG endpoint로 임의 fallback하지 않는다. 이는
Team 멤버십과 Workspace 권한 검사를 건너뛰는 자료 노출을 방지하기 위한 경계다.

공용 Team의 기본 metadata는 가입 전 표시할 수 있지만 Workspace tree, 자료, 멤버, Chat은 멤버 접근이
확인된 뒤에만 로드한다. 가입 요청 관리자 endpoint는 권한 확인용으로 성공했을 때만 승인·거절 패널을
노출하며, 403 응답 내용이나 요청 목록을 일반 멤버에게 표시하지 않는다.
