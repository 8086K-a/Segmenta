import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 16, ...rest }: P) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...rest,
  };
}

export const IconGrid = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

export const IconList = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <circle cx="3.5" cy="6" r="1" />
    <circle cx="3.5" cy="12" r="1" />
    <circle cx="3.5" cy="18" r="1" />
  </svg>
);

export const IconChart = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
);

export const IconUsers = (p: P) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
    <path d="M16 5.2a3.2 3.2 0 0 1 0 6.1M17.5 14.8c2.1.7 3.5 2.4 3.5 5.2" />
  </svg>
);

export const IconFilm = (p: P) => (
  <svg {...base(p)}>
    <rect x="2.5" y="5" width="19" height="14" rx="2" />
    <path d="M7 5v14M17 5v14M2.5 12h19" />
  </svg>
);

export const IconInbox = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 13h5l1.5 3h5L16 13h5" />
    <path d="M5.5 4.5h13l2.5 8.5v5a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 18v-5z" />
  </svg>
);

export const IconCheck = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12.2l2.4 2.4 4.6-4.9" />
  </svg>
);

export const IconLogout = (p: P) => (
  <svg {...base(p)}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <path d="M10 8l-4 4 4 4M6 12h9" />
  </svg>
);

export const IconPlus = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconPlay = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M7 4.5v15l13-7.5z" />
  </svg>
);

export const IconPause = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <rect x="6" y="4.5" width="4" height="15" rx="1.2" />
    <rect x="14" y="4.5" width="4" height="15" rx="1.2" />
  </svg>
);

export const IconBack5 = (p: P) => (
  <svg {...base(p)}>
    <path d="M3.5 8.5V4M3.5 8.5H8" />
    <path d="M3.9 8.5A9 9 0 1 1 3 13.5" />
    <text x="12" y="16" textAnchor="middle" fontSize="7" stroke="none" fill="currentColor" fontWeight="600">
      5
    </text>
  </svg>
);

export const IconFwd5 = (p: P) => (
  <svg {...base(p)}>
    <path d="M20.5 8.5V4M20.5 8.5H16" />
    <path d="M20.1 8.5A9 9 0 1 0 21 13.5" />
    <text x="12" y="16" textAnchor="middle" fontSize="7" stroke="none" fill="currentColor" fontWeight="600">
      5
    </text>
  </svg>
);

export const IconTrash = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 7h16M9 7V4.5h6V7M6.5 7l.8 12.2a1.5 1.5 0 0 0 1.5 1.3h6.4a1.5 1.5 0 0 0 1.5-1.3L17.5 7" />
  </svg>
);

export const IconArrowLeft = (p: P) => (
  <svg {...base(p)}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);

export const IconUpload = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 16V4M7.5 8.5L12 4l4.5 4.5" />
    <path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" />
  </svg>
);

export const IconDownload = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 4v12M7.5 11.5L12 16l4.5-4.5" />
    <path d="M4 18v1.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V18" />
  </svg>
);

export const IconClock = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);

export const IconAlert = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3.8 21 19.5H3z" />
    <path d="M12 9.5v4.2M12 16.6v.1" />
  </svg>
);

export const IconSearch = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </svg>
);

export const IconChevronRight = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 5l7 7-7 7" />
  </svg>
);

export const IconChevronDown = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 9l7 7 7-7" />
  </svg>
);

export const IconX = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const IconSparkle = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3l1.9 5.3L19 10l-5.1 1.7L12 17l-1.9-5.3L5 10l5.1-1.7z" />
  </svg>
);

export const IconTarget = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="3.5" />
    <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" />
  </svg>
);

export const IconScissors = (p: P) => (
  <svg {...base(p)}>
    <circle cx="6" cy="6" r="2.6" />
    <circle cx="6" cy="18" r="2.6" />
    <path d="M8.2 7.6 20 18M20 6 8.2 16.4" />
  </svg>
);

export const IconMenu = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const IconShield = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3l7 2.5v5.8c0 4.3-2.9 7.6-7 9.2-4.1-1.6-7-4.9-7-9.2V5.5z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

export const IconMagnet = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 4v7a7 7 0 0 0 14 0V4h-4v7a3 3 0 0 1-6 0V4z" />
    <path d="M5 8h4M15 8h4" />
  </svg>
);

export const IconZoomIn = (p: P) => (
  <svg {...base(p)}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5L21 21M10.5 7.5v6M7.5 10.5h6" />
  </svg>
);

export const IconZoomOut = (p: P) => (
  <svg {...base(p)}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5L21 21M7.5 10.5h6" />
  </svg>
);

export const IconCopy = (p: P) => (
  <svg {...base(p)}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
    <path d="M15.5 5.5A2 2 0 0 0 13.5 4.5H6a2 2 0 0 0-2 2v7.5" />
  </svg>
);

export const IconStepBack = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M17.5 5.2v13.6L8.6 12z" />
    <rect x="5" y="5.2" width="2" height="13.6" rx="1" />
  </svg>
);

export const IconStepFwd = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M6.5 5.2v13.6L15.4 12z" />
    <rect x="17" y="5.2" width="2" height="13.6" rx="1" />
  </svg>
);

export const IconSkipStart = (p: P) => (
  <svg {...base(p)}>
    <path d="M19 5v14L7 12z" />
    <path d="M4 5v14" />
  </svg>
);

export const IconSkipEnd = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 5v14l12-7z" />
    <path d="M20 5v14" />
  </svg>
);

export const IconScissorsLine = (p: P) => (
  <svg {...base(p)}>
    <circle cx="6" cy="6" r="2.4" />
    <circle cx="6" cy="18" r="2.4" />
    <path d="M8 7.5L20 17M20 7L8 16.5" />
  </svg>
);

export const IconSun = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
  </svg>
);

export const IconMoon = (p: P) => (
  <svg {...base(p)}>
    <path d="M20.5 14.3A8.6 8.6 0 0 1 9.7 3.5a8.6 8.6 0 1 0 10.8 10.8z" />
  </svg>
);

export const IconLayers = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3.5 21 8l-9 4.5L3 8z" />
    <path d="M3 12.5 12 17l9-4.5M3 16.8 12 21.3l9-4.5" />
  </svg>
);
