import {
  AlertHexagonIcon,
  AlignBoxBottomLeftIcon,
  AppWindowIcon,
  CardboardsIcon,
  CopyIcon,
  LayoutDashboardIcon,
  LoginIcon,
  MoodHappyIcon,
  PointIcon,
  TableIcon,
  TypographyIcon,
  UserPlusIcon,
  FileIcon,
  FileUploadIcon
} from 'vue-tabler-icons';

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

const requiredMgmtRole = `${import.meta.env.VITE_REQUIRED_ADMIN_ROLE}`

const sidebarItem: menu[] = [
  { header: 'Home' },
  {
    title: 'Dashboard',
    icon: LayoutDashboardIcon,
    to: '/',
    external: false,
  },
  {
    title: '게시판',
    icon: AppWindowIcon,
    chip: 'Pro',
    chipColor: 'primary',
    chipBgColor: 'lightprimary',
    to: '/',
    children: [
      {
        title: '자유게시판',
        chip: 'Pro',
        chipColor: 'primary',
        chipBgColor: 'lightprimary',
        icon: PointIcon,
        to: '/sample-page',
        external: false,
      },
    ],
  },
  { header: '시스템 관리', roles: [requiredMgmtRole] },
  {
    title: '보안 관리',
    icon: AppWindowIcon,
    chip: 'Pro',
    chipColor: 'primary',
    chipBgColor: 'lightprimary',
    to: '/',
    roles: [requiredMgmtRole],
    children: [
      {
        title: '회원',
        icon: PointIcon,
        to: '/mgmt/security/users',
        roles: [requiredMgmtRole],
        external: false,
      },
      {
        title: '그룹', 
        icon: PointIcon,
        to: '/mgmt/security/groups',
        roles: [requiredMgmtRole],
        external: false,
      },      
      {
        title: '롤', 
        icon: PointIcon,
        to: '/mgmt/security/roles',
        roles: [requiredMgmtRole],
        external: false,
      },
    ],
  },

  { header: 'utilities' },
  {
    title: '파일 업로드',
    icon: FileIcon, 
    chipColor: 'primary',
    chipBgColor: 'lightprimary',
    to: '/',
    roles: ['ROLE_USER',requiredMgmtRole],
    children: [
      {
        title: '업로드', 
        icon: FileUploadIcon,
        to: '/file/upload',
        external: false,
      },
      {
        title: '업로드된 파일', 
        icon: FileUploadIcon,
        to: '/files',
        external: false,
      },      
    ],
  }, 
  {
    title: 'Typography',
    icon: TypographyIcon,
    to: '/ui/typography',
    roles: [requiredMgmtRole],
    external: false,
  },
  {
    title: 'Shadow',
    icon: CopyIcon,
    to: '/ui/shadow',
    external: false,
  },
  { header: 'UI' },
  {
    title: 'Alert',
    icon: AlertHexagonIcon,
    to: '/ui/alerts',
  },
  {
    title: 'Button',
    icon: AlignBoxBottomLeftIcon,
    to: '/ui/buttons',
  },
  {
    title: 'Cards',
    icon: CardboardsIcon,
    to: '/ui/cards',
  },
  {
    title: 'Tables',
    icon: TableIcon,
    to: '/ui/tables',
  },

  { header: 'auth' },
  {
    title: 'Login',
    icon: LoginIcon,
    to: '/auth/login',
    external: false,
  },
  {
    title: 'Register',
    icon: UserPlusIcon,
    to: '/auth/register',
    external: false,
  },
  { header: 'Extra' },
  {
    title: 'Icons',
    icon: MoodHappyIcon,
    to: '/icons',
    external: false,
  },
];

export default sidebarItem;
