# DESIGN-antigravity.md - Antigravity UI Design System Spec

이 문서는 AI 어시스턴트 "Antigravity"의 브랜드 아이덴티티를 투영한 고품격, 미래지향적 웹 애플리케이션 디자인 시스템의 세부 디자인 토큰 및 가이드를 정의합니다.

---

## 1. Design Concept: "Quantum Antigravity"
우주 공간과 중력 제어를 테마로 하며, 깊고 투명한 다크 스페이스(Deep Space) 톤에 빛나는 전기적 색채(Electric Neon)를 극도로 섬세한 대비로 조합합니다.

- **유리 재질감 (Glassmorphism)**: 인터페이스 요소들이 공중에 부유하듯 떠 있는 느낌을 연상하도록 반투명 서피스와 백드롭 필터를 적극 사용합니다.
- **네온 글로우 (Neon Glow)**: 주요 인터랙션(호버, 액티브 상태)에 신비로운 미세 후광 효과를 입힙니다.
- **고성능 감성 (Cybernetic Precision)**: 폰트와 레이아웃 디테일에서 정교하게 조정된 수치와 모노스페이스 서체를 결합하여 테크니컬한 프로 도구의 완성도를 제공합니다.

---

## 2. Color Palette & Design Tokens

### Primary & Accent Colors
- **Primary Color (Quantum Violet)**: `#8b5cf6` (메인 브랜딩 / 퍼플 네온)
- **Secondary Color (Cyber Cyan)**: `#06b6d4` (서브 정보 표시 / 시안 네온)
- **Warning & Accent**: `#ec4899` (마스크 처리, 예외 상태 / 마젠타 핑크)
- **Success Tone**: `#10b981` (실행 성공 / 에메랄드 그린)

### Backgrounds (Surface & Canvas)
- **Dark Mode (Default & Recommend)**:
  - Canvas (Default Background): `#07080f` (딥 스페이스 네이비 블랙)
  - Card / Paper (Surface): `rgba(13, 16, 31, 0.75)` (반투명 스페이스 그레이)
  - Elevated Paper: `rgba(20, 25, 48, 0.85)`
- **Light Mode**:
  - Canvas (Default Background): `#f8fafc` (클리어 스카이)
  - Card / Paper (Surface): `rgba(255, 255, 255, 0.85)`
  - Elevated Paper: `#ffffff`

### Border & Divider Styles
- **Glass Border**: `1px solid rgba(139, 92, 246, 0.25)` (퍼플 계열 투명 헤어라인 보더)
- **Default Divider**: `1px solid rgba(255, 255, 255, 0.08)`

---

## 3. Typography
현대적인 산세리프 폰트와 코드의 가독성을 살리는 모노스페이스 서체를 병용합니다.

- **Display & Headings (h1 ~ h6)**: `Outfit`, `Inter`, `system-ui`, sans-serif (강인하고 현대적인 테크 볼드 폰트)
- **Body Text / UI Text**: `Inter`, sans-serif (가독성 최우선 산세리프)
- **Metadata, Code & Table Headers**: `JetBrains Mono`, `monospace` (정밀한 느낌을 표현하는 코딩 폰트)

---

## 4. UI Component Override Specifications

### MuiButton
- **Default Radius**: `8px`
- **Border/Outline**: 투명도 높은 일렉트릭 보더, 호버 시 밝은 색상 채워짐 및 `box-shadow: 0 0 12px rgba(139, 92, 246, 0.4)` 글로우 효과.

### MuiDialog / Cards
- **Border Radius**: `12px` (rounded.lg)
- **Background**: `backdrop-filter: blur(12px)` 글래스모피즘
- **Border**: `1px solid rgba(139, 92, 246, 0.2)`
- **Shadow**: `0 25px 50px -12px rgba(0, 0, 0, 0.5)`

### AG-Grid Table
- **Header Background**: `rgba(13, 16, 31, 0.9)`
- **Row Background (Dark)**: `rgba(7, 8, 15, 0.85)` / `rgba(13, 16, 31, 0.85)` (격행 배치)
- **Selected Row**: `rgba(139, 92, 246, 0.15)` 배경 및 바이올렛 왼쪽 액센트 라인.
- **Table Font**: 헤더 및 ID, 크기 열에 `JetBrains Mono` 연동.

### Switches & Toggles
- **Switch Thumb**: `primary.main` (#8b5cf6)
- **Switch Track**: 호버 또는 켜짐 상태에서 청록색(#06b6d4) 그라디언트 반영 가능.
