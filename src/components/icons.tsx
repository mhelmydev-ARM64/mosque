import type { ReactNode, SVGProps } from "react";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  size?: number;
}

function Icon({ size = 20, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/* --- التنقل --- */

export const IconHome = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 10.6 12 4l8 6.6" />
    <path d="M6.2 9.9V20h11.6V9.9" />
    <path d="M10 20v-5.2h4V20" />
  </Icon>
);

export const IconCap = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4 2.9 8.3 12 12.6l9.1-4.3z" />
    <path d="M6.5 10.6v4.8c0 1.6 2.5 2.9 5.5 2.9s5.5-1.3 5.5-2.9v-4.8" />
    <path d="M21.1 8.3v5.5" />
  </Icon>
);

export const IconSend = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20.8 3.2 10.4 13.6" />
    <path d="M20.8 3.2 14 21l-3.6-7.4L3 10z" />
  </Icon>
);

export const IconChat = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20.4 11.6c0 3.9-3.8 7-8.4 7a9.8 9.8 0 0 1-2.9-.42L4 19.8l1.3-3.4a6.7 6.7 0 0 1-1.7-4.8c0-3.9 3.8-7 8.4-7s8.4 3.1 8.4 7z" />
  </Icon>
);

export const IconGrid = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="4" width="6.4" height="6.4" rx="1.6" />
    <rect x="13.6" y="4" width="6.4" height="6.4" rx="1.6" />
    <rect x="4" y="13.6" width="6.4" height="6.4" rx="1.6" />
    <rect x="13.6" y="13.6" width="6.4" height="6.4" rx="1.6" />
  </Icon>
);

export const IconChevronDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />
  </Icon>
);

export const IconArrowStart = (p: IconProps) => (
  <Icon {...p}>
    <path d="m14.5 6-6 6 6 6" />
  </Icon>
);

export const IconArrowBack = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9.5 6 6 6-6 6" />
  </Icon>
);

/* --- الإدارة والحسابات --- */

export const IconShield = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.2 5.2 6v5.4c0 4.2 2.8 7.6 6.8 9.4 4-1.8 6.8-5.2 6.8-9.4V6z" />
  </Icon>
);

export const IconCrown = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 17.4 3.1 7l4.8 3.4L12 4l4.1 6.4L20.9 7 20 17.4z" />
    <path d="M4.6 20.4h14.8" />
  </Icon>
);

export const IconUsers = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9.2" cy="8" r="3.3" />
    <path d="M3.4 19.6c0-3.1 2.6-5.2 5.8-5.2s5.8 2.1 5.8 5.2" />
    <path d="M16.1 5.2a3.3 3.3 0 0 1 0 6.3" />
    <path d="M17.6 14.8c1.8.7 3 2.4 3 4.8" />
  </Icon>
);

export const IconCommittee = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20V6.6L12 3.2l8 3.4V20z" />
    <path d="M9.6 20v-5h4.8v5" />
    <path d="M8 9.6h1.8M14.2 9.6H16M8 12.8h1.8M14.2 12.8H16" />
  </Icon>
);

export const IconLock = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5" y="10.4" width="14" height="9.6" rx="2.2" />
    <path d="M8.2 10.4V8a3.8 3.8 0 0 1 7.6 0v2.4" />
  </Icon>
);

export const IconLogout = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14.8 5.4V4H5v16h9.8v-1.4" />
    <path d="M10.4 12H20" />
    <path d="m17 8.6 3.4 3.4L17 15.4" />
  </Icon>
);

export const IconUndo = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.2 10.2h9.4a5 5 0 0 1 0 10H8.4" />
    <path d="M7.6 6.2 3.6 10.2l4 4" />
  </Icon>
);

export const IconArchive = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.4" y="4.4" width="17.2" height="4.4" rx="1.4" />
    <path d="M5.2 8.8v9.4a1.6 1.6 0 0 0 1.6 1.6h10.4a1.6 1.6 0 0 0 1.6-1.6V8.8" />
    <path d="M10 13h4" />
  </Icon>
);

export const IconBan = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.4" />
    <path d="m6.4 6.4 11.2 11.2" />
  </Icon>
);

/* --- المظهر --- */

export const IconSun = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.8v2.1M12 19.1v2.1M2.8 12h2.1M19.1 12h2.1M5.5 5.5l1.5 1.5M17 17l1.5 1.5M18.5 5.5 17 7M7 17l-1.5 1.5" />
  </Icon>
);

export const IconMoon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20.2 14.6A8.4 8.4 0 0 1 9.4 3.8 8.4 8.4 0 1 0 20.2 14.6z" />
  </Icon>
);

export const IconDevice = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.8" y="4.4" width="18.4" height="12.2" rx="2.2" />
    <path d="M8.6 20.2h6.8M12 16.6v3.6" />
  </Icon>
);

export const IconPhone = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7.1 3.6h-.9A2.5 2.5 0 0 0 3.7 6.4c.5 4.3 2.2 8.1 4.9 11.1s6.3 4.7 10.5 5.2a2.5 2.5 0 0 0 2.7-2.5v-1.1c0-1.1-.7-2-1.7-2.3l-2.6-.7a2.4 2.4 0 0 0-2.5.8l-1 1.2a15.4 15.4 0 0 1-5.3-5.6l1.2-1a2.4 2.4 0 0 0 .7-2.5l-.7-2.5A2.3 2.3 0 0 0 7.1 3.6z" />
  </Icon>
);

export const IconEmail = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.9" y="5" width="18.2" height="14" rx="2.4" />
    <path d="m4.4 7.2 6.2 4.6a2.4 2.4 0 0 0 2.8 0l6.2-4.6" />
  </Icon>
);

export const IconPalette = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.4a8.6 8.6 0 0 0 0 17.2c1.4 0 2.1-1 2.1-2s-.7-1.7-.7-2.6c0-.8.6-1.4 1.5-1.4h1.7a4 4 0 0 0 4-4c0-4-3.8-7.2-8.6-7.2z" />
    <circle cx="8" cy="10" r="1" />
    <circle cx="12" cy="7.6" r="1" />
    <circle cx="16" cy="10" r="1" />
  </Icon>
);

export const IconText = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 7.4V5h14v2.4" />
    <path d="M12 5v14" />
    <path d="M9 19h6" />
  </Icon>
);

/* --- الإجراءات --- */

export const IconPlus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5.2v13.6M5.2 12h13.6" />
  </Icon>
);

export const IconCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="m4.8 12.6 4.8 4.8L19.4 6.6" />
  </Icon>
);

export const IconCheckCircle = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.4" />
    <path d="m8.4 12.3 2.5 2.5 4.7-5" />
  </Icon>
);

export const IconX = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6.2 6.2 17.8 17.8M17.8 6.2 6.2 17.8" />
  </Icon>
);

export const IconAlert = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4.4 2.9 19.8h18.2z" />
    <path d="M12 10v4.1" />
    <path d="M12 17.2h.01" />
  </Icon>
);

export const IconInfo = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.4" />
    <path d="M12 11.2v5" />
    <path d="M12 7.9h.01" />
  </Icon>
);

export const IconPencil = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.6 19.4h4L20 8a2.6 2.6 0 0 0-3.6-3.6L5 15.8z" />
    <path d="m14.8 6 3.6 3.6" />
  </Icon>
);

export const IconTrash = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.6 7h14.8" />
    <path d="M9.6 7V4.8h4.8V7" />
    <path d="m6.6 7 1 12.2h8.8L17.4 7" />
    <path d="M10.4 10.6v5.8M13.6 10.6v5.8" />
  </Icon>
);

export const IconSearch = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6.4" />
    <path d="m15.8 15.8 4.6 4.6" />
  </Icon>
);

export const IconDownload = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4v10" />
    <path d="m8.2 10.4 3.8 3.8 3.8-3.8" />
    <path d="M4.6 19.4h14.8" />
  </Icon>
);

export const IconUpload = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 14.4V4.4" />
    <path d="m8.2 8.2 3.8-3.8 3.8 3.8" />
    <path d="M4.6 19.4h14.8" />
  </Icon>
);

export const IconPlay = (p: IconProps) => (
  <Icon {...p}>
    <path d="m8.2 5.4 10.6 6.6-10.6 6.6z" />
  </Icon>
);

export const IconEye = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.9 12S6.6 6.1 12 6.1 21.1 12 21.1 12 17.4 17.9 12 17.9 2.9 12 2.9 12z" />
    <circle cx="12" cy="12" r="2.7" />
  </Icon>
);

export const IconEyeOff = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9.6 5.3A8.9 8.9 0 0 1 12 5c5.4 0 9.1 7 9.1 7a17 17 0 0 1-2.5 3.3M6.4 7.2A16.6 16.6 0 0 0 2.9 12s3.7 7 9.1 7a8.7 8.7 0 0 0 3.9-.9" />
    <path d="M10 10a2.8 2.8 0 0 0 4 4" />
    <path d="m3.6 3.6 16.8 16.8" />
  </Icon>
);

export const IconFilter = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 6.2h16l-6.2 7.3v5.6l-3.6 1.7v-7.3z" />
  </Icon>
);

/* --- المتابعة والتقارير --- */

export const IconTasks = (p: IconProps) => (
  <Icon {...p}>
    <path d="m3.8 6.4 1.6 1.6 2.9-2.9" />
    <path d="M11 6.4h9.2" />
    <path d="m3.8 12.4 1.6 1.6 2.9-2.9" />
    <path d="M11 12.4h9.2" />
    <path d="m3.8 18.4 1.6 1.6 2.9-2.9" />
    <path d="M11 18.4h9.2" />
  </Icon>
);

export const IconReport = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 3.6h7.2L18.6 9v11.4H6z" />
    <path d="M13.2 3.6V9h5.4" />
    <path d="M9 13.2h6.6M9 16.8h6.6" />
  </Icon>
);

export const IconCalendar = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.8" y="5.4" width="16.4" height="14.6" rx="2.2" />
    <path d="M3.8 10h16.4" />
    <path d="M8.4 3.4v4M15.6 3.4v4" />
  </Icon>
);

export const IconClock = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.4" />
    <path d="M12 7.4V12l3.2 1.9" />
  </Icon>
);

export const IconInbox = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.6 13.4h4.2l1.5 3h5.4l1.5-3h4.2" />
    <path d="M6.2 4.6h11.6l3 8.8v6H3.2v-6z" />
  </Icon>
);

export const IconFlag = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6.2 20.8V4.2" />
    <path d="M6.2 5h9.4l-1.6 3.6 1.6 3.6H6.2z" />
  </Icon>
);

/* --- المالية --- */

export const IconWallet = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.4" y="6" width="17.2" height="12.6" rx="2.6" />
    <path d="M3.4 10.2h17.2" />
    <path d="M16.6 14.4h.01" />
  </Icon>
);

export const IconArrowUp = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 19.4V5" />
    <path d="m6.2 10.8 5.8-5.8 5.8 5.8" />
  </Icon>
);

export const IconArrowDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4.6V19" />
    <path d="m6.2 13.2 5.8 5.8 5.8-5.8" />
  </Icon>
);

export const IconChart = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20h16" />
    <path d="M7 20v-6.4M12 20V5.4M17 20v-9" />
  </Icon>
);

export const IconStar = (p: IconProps) => (
  <Icon {...p}>
    <path d="m12 4 2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8z" />
  </Icon>
);

/* --- الإعدادات والحساب --- */

export const IconSettings = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3.1" />
    <path d="M19.6 14.4a1.6 1.6 0 0 0 .32 1.77l.06.06a1.94 1.94 0 1 1-2.74 2.74l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.47v.17a1.94 1.94 0 1 1-3.88 0v-.09a1.6 1.6 0 0 0-1.05-1.47 1.6 1.6 0 0 0-1.77.32l-.06.06a1.94 1.94 0 1 1-2.74-2.74l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-.97h-.17a1.94 1.94 0 1 1 0-3.88h.09a1.6 1.6 0 0 0 1.47-1.05 1.6 1.6 0 0 0-.32-1.77l-.06-.06a1.94 1.94 0 1 1 2.74-2.74l.06.06a1.6 1.6 0 0 0 1.77.32h.08a1.6 1.6 0 0 0 .97-1.47v-.17a1.94 1.94 0 1 1 3.88 0v.09a1.6 1.6 0 0 0 .97 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a1.94 1.94 0 1 1 2.74 2.74l-.06.06a1.6 1.6 0 0 0-.32 1.77v.08a1.6 1.6 0 0 0 1.47.97h.17a1.94 1.94 0 1 1 0 3.88h-.09a1.6 1.6 0 0 0-1.47.97z" />
  </Icon>
);

export const IconKey = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="7.6" cy="15.6" r="3.6" />
    <path d="m10.2 13 7.6-7.6" />
    <path d="M15.6 5.4 18 7.8M13.4 7.6l2.4 2.4" />
  </Icon>
);

export const IconUser = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.8 20c0-3.6 3.2-5.8 7.2-5.8s7.2 2.2 7.2 5.8" />
  </Icon>
);

export const IconUserPlus = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9.6" cy="8" r="3.5" />
    <path d="M2.9 20c0-3.4 3-5.6 6.7-5.6s6.7 2.2 6.7 5.6" />
    <path d="M18.6 7.6v5.2M21.2 10.2h-5.2" />
  </Icon>
);

export const IconMoney = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.6" y="6" width="18.8" height="12" rx="2.4" />
    <circle cx="12" cy="12" r="2.6" />
    <path d="M6.2 12h.01M17.8 12h.01" />
  </Icon>
);

export const IconRoute = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="6" cy="18" r="2.4" />
    <circle cx="18" cy="6" r="2.4" />
    <path d="M8.4 18h5.1a3.5 3.5 0 0 0 0-7H10a3.5 3.5 0 0 1 0-7h5.6" />
  </Icon>
);

export const IconBell = (p: IconProps) => (
  <Icon {...p}>
    <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9" />
    <path d="M13.7 19a2 2 0 0 1-3.4 0" />
  </Icon>
);

export const IconMegaphone = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.2 9.8v4.4a1.8 1.8 0 0 0 1.8 1.8h1.7l7.9 4V4l-7.9 4H6a1.8 1.8 0 0 0-1.8 1.8z" />
    <path d="M18.4 8.6a4.6 4.6 0 0 1 0 6.8" />
  </Icon>
);

export const IconDatabase = (p: IconProps) => (
  <Icon {...p}>
    <ellipse cx="12" cy="6.2" rx="7.6" ry="2.8" />
    <path d="M4.4 6.2v11.6c0 1.6 3.4 2.8 7.6 2.8s7.6-1.2 7.6-2.8V6.2" />
    <path d="M4.4 12c0 1.6 3.4 2.8 7.6 2.8s7.6-1.2 7.6-2.8" />
  </Icon>
);

export const IconRefresh = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20.4 11.2A8.4 8.4 0 0 0 6.1 6.3L3.6 8.6" />
    <path d="M3.6 12.8a8.4 8.4 0 0 0 14.3 4.9l2.5-2.3" />
    <path d="M3.6 4.4v4.2h4.2M20.4 19.6v-4.2h-4.2" />
  </Icon>
);

export const IconClipboard = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5.2" y="4.6" width="13.6" height="15.8" rx="2.2" />
    <path d="M9.2 4.6V3.4h5.6v1.2" />
    <path d="M8.8 11h6.4M8.8 15h4.4" />
  </Icon>
);

