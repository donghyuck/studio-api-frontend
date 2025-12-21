import { requiredAdminRoles } from "@/utils/helpers";
import {
  AlertHexagonIcon,
  AlignBoxBottomLeftIcon,
  AppWindowIcon,
  CardboardsIcon,
  CloudIcon,
  CopyIcon,
  DeviceIpadSearchIcon,
  FileDatabaseIcon,
  FileIcon,
  FileUploadIcon,
  FolderIcon,
  LayoutDashboardIcon,
  LoginIcon,
  Message2Icon,
  MoodHappyIcon,
  PointIcon,
  ShieldCogIcon,
  ShieldLockIcon,
  TableIcon,
  TypographyIcon,
  UserPlusIcon,
  UsersGroupIcon,
  UsersIcon,
  VectorIcon,
  MailFastIcon,
  MailIcon,
  MailCogIcon,
} from "vue-tabler-icons";

export interface menu {
  header?: string;
  title?: string;
  icon?: any;
  to?: string;
  chip?: string;
  chipColor?: string;
  chipBgColor?: string;
  chipVariant?: string;
  chipIcon?: string;
  children?: menu[];
  disabled?: boolean;
  type?: string;
  subCaption?: string;
  external?: boolean;
  roles?: string[];
}

const sidebarItem: menu[] = [
  { header: "Home" },
  {
    title: "Dashboard",
    icon: LayoutDashboardIcon,
    to: "/",
    external: false,
  },
  {
    title: "게시판",
    icon: AppWindowIcon,
    chip: "Pro",
    chipColor: "primary",
    chipBgColor: "lightprimary",
    to: "/",
    children: [
      {
        title: "자유게시판",
        chip: "Pro",
        chipColor: "primary",
        chipBgColor: "lightprimary",
        icon: PointIcon,
        to: "/sample-page",
        external: false,
      },
    ],
  },
  { header: "시스템 관리", roles: requiredAdminRoles },
  {
    title: "보안 관리",
    icon: FolderIcon,
    to: "/",
    roles: requiredAdminRoles,
    children: [
      {
        title: "회원",
        icon: UsersIcon,
        to: "/mgmt/security/users",
        roles: requiredAdminRoles,
        external: false,
      },
      {
        title: "그룹",
        icon: UsersGroupIcon,
        to: "/mgmt/security/groups",
        roles: requiredAdminRoles,
        external: false,
      },
      {
        title: "롤",
        icon: ShieldLockIcon,
        to: "/mgmt/security/roles",
        roles: requiredAdminRoles,
        external: false,
      },
      {
        title: "권한관리(ACL)",
        icon: ShieldCogIcon,
        to: "/mgmt/security/acl",
        roles: requiredAdminRoles,
        external: false,
      },
    ],
  },
  {
    title: "감사",
    icon: FolderIcon,
    chipColor: "primary",
    chipBgColor: "lightprimary",
    to: "/",
    roles: requiredAdminRoles,
    children: [
      {
        title: "로그인 실패",
        icon: DeviceIpadSearchIcon,
        to: "/mgmt/audit/login-failure-log",
        external: false,
      },
    ],
  },
  { header: "서비스 관리", roles: requiredAdminRoles },
  {
    title: "ObjectStorage",
    icon: FolderIcon,
    chipColor: "primary",
    chipBgColor: "lightprimary",
    to: "/",
    roles: requiredAdminRoles,
    children: [
      {
        title: "Providers",
        icon: CloudIcon,
        to: "/mgmt/services/objectstorage/providers",
        external: false,
      },
    ],
  },
  {
    title: "AI",
    icon: FolderIcon,
    chipColor: "primary",
    chipBgColor: "lightprimary",
    to: "/",
    roles: requiredAdminRoles,
    children: [
      {
        title: "Chat",
        icon: Message2Icon,
        to: "/mgmt/services/ai/chat",
        external: false,
      },
      {
        title: "RAG",
        icon: VectorIcon,
        to: "/mgmt/services/ai/rag",
        external: false,
      },
    ],
  },
  { header: "응용프로그램" },
  {
    title: "자원",
    icon: FolderIcon,
    chipColor: "primary",
    chipBgColor: "lightprimary",
    to: "/",
    roles: requiredAdminRoles,
    children: [
      {
        title: "파일",
        icon: FileDatabaseIcon,
        to: "/mgmt/application/files",
        external: false,
      },
      {
        title: "템플릿",
        icon: MailFastIcon,
        to: "/mgmt/application/templates",
        external: false,
      }, 
    ],
  },
  {
    title: "메일",
    icon: FolderIcon,
    chipColor: "primary",
    chipBgColor: "lightprimary",
    to: "/",
    roles: requiredAdminRoles,
    children: [
      {
        title: "메일 동기화",
        icon: MailCogIcon,
        to: "/mgmt/application/mail",
        external: false,
      },
      {
        title: "메일 Inbox",
        icon: MailIcon,
        to: "/mgmt/application/mail-inbox",
        external: false,
      },
    ],
  },
  { header: "utilities" },
  {
    title: "파일 업로드",
    icon: FileIcon,
    chipColor: "primary",
    chipBgColor: "lightprimary",
    to: "/",
    roles: ["ROLE_USER"],
    children: [
      {
        title: "업로드",
        icon: FileUploadIcon,
        to: "/file/upload",
        external: false,
      },
      {
        title: "업로드된 파일",
        icon: FileUploadIcon,
        to: "/files",
        external: false,
      },
    ],
  },
  {
    title: "Typography",
    icon: TypographyIcon,
    to: "/ui/typography",
    external: false,
  },
  {
    title: "Shadow",
    icon: CopyIcon,
    to: "/ui/shadow",
    external: false,
  },
  { header: "UI" },
  {
    title: "Alert",
    icon: AlertHexagonIcon,
    to: "/ui/alerts",
  },
  {
    title: "Button",
    icon: AlignBoxBottomLeftIcon,
    to: "/ui/buttons",
  },
  {
    title: "Cards",
    icon: CardboardsIcon,
    to: "/ui/cards",
  },
  {
    title: "Tables",
    icon: TableIcon,
    to: "/ui/tables",
  },

  { header: "auth" },
  {
    title: "Login",
    icon: LoginIcon,
    to: "/auth/login",
    external: false,
  },
  {
    title: "Register",
    icon: UserPlusIcon,
    to: "/auth/register",
    external: false,
  },
  { header: "Extra" },
  {
    title: "Icons",
    icon: MoodHappyIcon,
    to: "/icons",
    external: false,
  },
];

export default sidebarItem;
