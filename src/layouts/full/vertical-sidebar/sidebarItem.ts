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
  ArticleIcon,
  UsersGroupIcon,
  UsersIcon,
  VectorIcon,
  MailFastIcon,
  MailIcon,
  MailCogIcon,
  FilesIcon,
  
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
  { header: "커뮤니티" },
  {
    title: "게시판",
    icon: Message2Icon,
    to: "/community/forums",
    external: false,
  },
  { header: "시스템 관리", roles: requiredAdminRoles },
  {
    title: "회원 관리",
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
    ],
  },
  {
    title: "보안 관리",
    icon: FolderIcon,
    to: "/",
    roles: requiredAdminRoles,
    children: [
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
        roles: requiredAdminRoles,
        external: false,
      },
      {
        title: "게시판 감사",
        icon: TableIcon,
        to: "/mgmt/application/forums/audit-log",
        roles: requiredAdminRoles,
        external: false,
      },
    ],
  },
  {
    title: "정책 관리",
    icon: FolderIcon,
    chipColor: "primary",
    chipBgColor: "lightprimary",
    to: "/",
    roles: requiredAdminRoles,
    children: [
      {
        title: "객체 유형",
        icon: TableIcon,
        to: "/mgmt/policy/object-types",
        roles: requiredAdminRoles,
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
        roles: requiredAdminRoles,
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
        roles: requiredAdminRoles,
        external: false,
      },
      {
        title: "RAG",
        icon: VectorIcon,
        to: "/mgmt/services/ai/rag",
        roles: requiredAdminRoles,
        external: false,
      },
    ],
  },
  { header: "응용프로그램" , roles: requiredAdminRoles,},
  {
    title: "커뮤니티",
    icon: FolderIcon,
    chipColor: "primary",
    chipBgColor: "lightprimary",
    to: "/",
    roles: requiredAdminRoles,
    children: [
      {
        title: "게시판 관리",
        icon: ArticleIcon,
        to: "/mgmt/application/forums",
        roles: requiredAdminRoles,
        external: false,
      }
    ],
  },
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
        roles: requiredAdminRoles,
        external: false,
      },
      {
        title: "템플릿",
        icon: MailFastIcon,
        to: "/mgmt/application/templates",
        roles: requiredAdminRoles,
        external: false,
      },
      {
        title: "문서",
        icon: FilesIcon,
        to: "/mgmt/application/documents",
        roles: requiredAdminRoles,
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
        to: "/mgmt/application/mail-sync",
        roles: requiredAdminRoles,
        external: false,
      },
      {
        title: "메일 Inbox",
        icon: MailIcon,
        to: "/mgmt/application/mail-inbox",
        roles: requiredAdminRoles,
        external: false,
      },
    ],
  },
  // { header: "auth" },
  // {
  //   title: "Login",
  //   icon: LoginIcon,
  //   to: "/auth/login",
  //   external: false,
  // },
  // {
  //   title: "Register",
  //   icon: UserPlusIcon,
  //   to: "/auth/register",
  //   external: false,
  // },
];

export default sidebarItem;
