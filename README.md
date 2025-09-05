# Studio-API-Front-End
Studio-API 를 위한 뷰 기반 프론트엔드 VUE3 템픒릿.

| Name                   | Version | Initial Release | EOS (End of Service) |
| ---------------------- | ------- | --------------- | -------------------- |
| Vue                    | 3.5.17  |                 |                      |
| Vuetify                | 3.9.2   |                 |                      |
| Pinia                  | 3.0.3   |                 |                      |
| Axios                  | 1.10.0  |                 |                      |
| ag-gird-community/vue3 | 32.3.5  |                 |                      |

프로젝트는 vue3 + vite + typescript +vuetify 3 기술을 적용하여 구성하였다.

## 🛠️ 주목할 라이브러리 및 도구

| **Library / Tool**   | **Description**                                                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Vue.js**           | Vue.js는 사용자 인터페이스(UI)와 싱글 페이지 애플리케이션(SPA)을 구축하는 데 중점을 둔 자바스크립트 프레임워크입                                                                                                               |
| **TypeScript**       | TypeScript는 자바스크립트의 상위 집합(superset)으로, 자바스크립트의 모든 기능을 그대로 사용할 수 있으면서도 정적 타입(Strongly typed)을 지원                                                                                   |
| **Vuetify**          | Vuetify는 Vue.js를 위한 인기 있는 UI 프레임워크로, 구글의 머티리얼 디자인(Material Design) 가이드라인을 기반.                                                                                                                  |
| **Vite**             | Vite는 최신 웹 애플리케이션 개발을 위해 설계된 빠른 빌드 도구이자 개발 서버. 전통적인 번들러와 달리, Vite는 개발 중에 필요한 파일만 빠르게 제공하여 초기 구동 속도와 변경 사항 반영 속도가 매우 빠름.                          |
| **Vue-ApexCharts**   | Vue-ApexCharts는 ApexCharts 라이브러리를 Vue.js 프로젝트에서 쉽게 사용할 수 있도록 감싼(wrapper) 컴포넌트. ApexCharts는 다양한 차트와 그래프를 동적으로, 그리고 상호작용적으로 표현할 수 있는 강력한 데이터 시각화 라이브러리. |
| **Vue Tabler Icons** | Vue Tabler Icons는 현대적인 Vue 애플리케이션을 위해 설계된 깔끔하고 커스터마이즈 가능한 SVG 아이콘 라이브러리.                                                                                                     


```
├── node_modules (nmp install 명령을 통하여 자동 설치되는 의존성 라이브러리)
├── public (이미지, 아이콘 등)
├── src
│   ├── assets (프로젝트 내부 이미지, 아이콘 등)
│   ├── components
│   ├── data (데모용 데이터 파일)
│   ├── layout (페이지 기본 레이아웃 정의, ex: Header, Sidebar 포함 레이아웃 등)
│   │   └── blank
│   │   │   └── BlankLayout.vue (메뉴가 없는 레이아웃, 로그인 등 단순 페이지용)
│   │   └── full
│   │   │   ├──logo (메뉴 로고 파일)
│   │   │   ├── vertical-header
│   │   │   │   ├── NotificationDD.vue        (알림 드롭다운)
│   │   │   │   └── ProfileDD.vue  (프로필 드롭다운)
│   │   │   ├── vertical-sidebar
│   │   │   │   ├── Icon.vue               (사이드바 아이콘)
│   │   │   │   ├── sidebarItem.ts         (사이드 메뉴 데이터 정의, 사이드바 메뉴 구조를 타입스크립트 객체로 정의)
│   │   │   │   ├── NavCollapse/
│   │   │   │   │   └── NavCollapse.vue    (접히는 사이드 메뉴 그룹)
│   │   │   │   ├── NavGroup/
│   │   │   │   │   └── index.vue          (사이드 메뉴 그룹 - 제목만 있는 그룹)
│   │   │   │   └── NavItem/
│   │   │   │       └── index.vue          (사이드 메뉴 항목)
│   │   │   ├── FullLayout.vue (전체 레이아웃 구조의 entry point)
│   │   │   ├── Main.vue (FullLayout의 주요 틀)
│   │   │   └── Topbar.vue (상단 바 컴포넌트)
│   ├── plugins (Vuetify, Pinia, Axios 등의 전역 플러그인 설정)
│   ├── router (Vue Router 설정 및 경로 정의)
│   ├── scss (SCSS 스타일 모음. 구성별로 세분화 되어 있음)
│   ├── stores (Pinia 상태 관리 저장소)
│   ├── theme (Vuetify 테마 및 색상 설정)
│   ├── types (TypeScript 인터페이스 및 타입 정의)
│   ├── validators
│   ├── views (실제 페이지 단위 컴포넌트)
│   ├── main.ts (애플리케이션 진입점)
│   └── App.vue (루트 컴포넌트)
├── .env.development  (개발 환경 변수들을 정의)
├── .env.production (운영 환경 변수들을 정의)
├── .gitignore (git 무시 목록)
├── env.d.ts (타입 보완을 위한 글로벌 선언 파일)
├── index.html (엔트리 HTML 파일)
├── package.json (의존성 및 스크립트 정의)
├── README.md (프로젝트 소개)
├── tsconfig.json (TypeScript 설정)
├── tsconfig.vite-config.json (Vite 설정 파일 전용 TypeScript 설정)
└── vite.config.ts (Vite 설정)
```
## AG - Grid

커뮤니케이션 버전에서 서버 페이징은 지원하지 않기 때문에 별도의 컴포넌트를 제작하여 사용함.

/componnets/ag-grid

- 각 페이지에서는 필요에 따라 GridContent , PageableGridContent 을 import 하여 사용.
- 위의 컴포넌트 사용을 위해서 store 객체는 ag-grid 와 내부적으로 호환되도록 구현된 /types/ag-grid/DataSource 타입을 추상화 하여 구현하는 /stores/AbstractPageDataSource 을 사용하여 구현해야 함.

## 주요 명렁

- npm install
- npm run dev (로컬에서 서버 실행)