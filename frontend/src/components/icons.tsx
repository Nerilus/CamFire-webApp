import React from 'react';

type IconProps = { size?: number; className?: string; color?: string; style?: React.CSSProperties };
const base = (size = 22) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const FlameIcon: React.FC<IconProps> = ({ size, className }) => (
  <svg {...base(size)} className={className} fill="currentColor" stroke="none">
    <path d="M12 2c1 3-3 4-3 8a3 3 0 0 0 6 0c0-1-.5-2-1-3 2 1 4 3.5 4 7a7 7 0 0 1-14 0c0-5 3-7 4-9 .5-1 .8-2 0-3z" />
  </svg>
);

export const SmokeIcon: React.FC<IconProps> = ({ size, className, style }) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M4 19h16M7 15c1.5-2 3-2 3-5 0-2-1.5-3-1.5-5M12 15c1.5-2 3-2 3-5 0-2-1.5-3-1.5-5M17 15c1.5-2 3-2 3-5 0-2-1.5-3-1.5-5" />
  </svg>
);

export const HomeIcon: React.FC<IconProps> = ({ size, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M3 11l9-8 9 8" />
    <path d="M5 10v10h14V10" />
  </svg>
);

export const CameraIcon: React.FC<IconProps> = ({ size, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M4 7h3l2-2h6l2 2h3v12H4z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);

export const ClockIcon: React.FC<IconProps> = ({ size, className }) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </svg>
);

export const BellIcon: React.FC<IconProps> = ({ size, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 6.5H4.5C4.5 14.5 6 13 6 9z" />
    <path d="M9.5 18a2.5 2.5 0 0 0 5 0" />
  </svg>
);

export const SettingsIcon: React.FC<IconProps> = ({ size, className }) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.5-2-3.5-2.3.9a7.7 7.7 0 0 0-1.7-1L15 3h-4l-.4 2.4a7.7 7.7 0 0 0-1.7 1l-2.3-.9-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.5 2.3-.9c.5.4 1.1.7 1.7 1L11 21h4l.4-2.4a7.7 7.7 0 0 0 1.7-1l2.3.9 2-3.5-2-1.5z" />
  </svg>
);

export const GalleryIcon: React.FC<IconProps> = ({ size, className }) => (
  <svg {...base(size)} className={className}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="8.5" cy="9.5" r="1.6" />
    <path d="M3 17l5-5 4 4 3-3 6 6" />
  </svg>
);

export const MapIcon: React.FC<IconProps> = ({ size, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M9 4l-5 2v14l5-2 6 2 5-2V4l-5 2-6-2z" />
    <path d="M9 4v14M15 6v14" />
  </svg>
);

export const FlashIcon: React.FC<IconProps> = ({ size, className }) => (
  <svg {...base(size)} className={className} fill="currentColor" stroke="none">
    <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
  </svg>
);

export const RefreshIcon: React.FC<IconProps> = ({ size, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M4 4v6h6" />
    <path d="M20 20v-6h-6" />
    <path d="M5.5 9A7.5 7.5 0 0 1 19 8.5M18.5 15A7.5 7.5 0 0 1 5 15.5" />
  </svg>
);

export const VideoIcon: React.FC<IconProps> = ({ size, className }) => (
  <svg {...base(size)} className={className}>
    <rect x="3" y="6" width="13" height="12" rx="2" />
    <path d="M16 10l5-3v10l-5-3z" />
  </svg>
);

export const PhoneIcon: React.FC<IconProps> = ({ size, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
  </svg>
);

export const UsersIcon: React.FC<IconProps> = ({ size, className }) => (
  <svg {...base(size)} className={className}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20c0-3 3-5 6-5s6 2 6 5" />
    <circle cx="17" cy="9" r="2.3" />
    <path d="M16 13.2c2 .2 4 1.8 4 4.3" />
  </svg>
);

export const SendIcon: React.FC<IconProps> = ({ size, className }) => (
  <svg {...base(size)} className={className} fill="currentColor" stroke="none">
    <path d="M3 11l18-8-8 18-2-7-8-3z" />
  </svg>
);

export const GlobeIcon: React.FC<IconProps> = ({ size, className }) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </svg>
);

export const ChevronRightIcon: React.FC<IconProps> = ({ size, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export const PlusIcon: React.FC<IconProps> = ({ size, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const MinusIcon: React.FC<IconProps> = ({ size, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M5 12h14" />
  </svg>
);

export const DownloadIcon: React.FC<IconProps> = ({ size, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3v12M7 11l5 5 5-5" />
    <path d="M5 21h14" />
  </svg>
);

export const UploadIcon: React.FC<IconProps> = ({ size, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M12 15V3M7 8l5-5 5 5" />
    <path d="M5 21h14" />
  </svg>
);

export const ShareIcon: React.FC<IconProps> = ({ size, className }) => (
  <svg {...base(size)} className={className}>
    <circle cx="6" cy="12" r="2.2" />
    <circle cx="18" cy="6" r="2.2" />
    <circle cx="18" cy="18" r="2.2" />
    <path d="M8 11l8-4M8 13l8 4" />
  </svg>
);

export const EyeIcon: React.FC<IconProps> = ({ size, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="2.5" />
  </svg>
);

export const PinIcon: React.FC<IconProps> = ({ size, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M12 21s7-7.5 7-12a7 7 0 1 0-14 0c0 4.5 7 12 7 12z" />
    <circle cx="12" cy="9" r="2.5" />
  </svg>
);

export const CheckCircleIcon: React.FC<IconProps> = ({ size, className }) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l3 3 5-6" />
  </svg>
);

export const WarningIcon: React.FC<IconProps> = ({ size, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3l10 18H2z" />
    <path d="M12 10v4" />
    <circle cx="12" cy="17" r="0.6" fill="currentColor" />
  </svg>
);

export const XIcon: React.FC<IconProps> = ({ size, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const TrashIcon: React.FC<IconProps> = ({ size, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

export const MaximizeIcon: React.FC<IconProps> = ({ size, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
  </svg>
);

export const MinimizeIcon: React.FC<IconProps> = ({ size, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
  </svg>
);

export const LockIcon: React.FC<IconProps> = ({ size, className, color }) => (
  <svg {...base(size)} className={className} stroke={color || 'currentColor'}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export const RadioIcon: React.FC<IconProps & { style?: React.CSSProperties }> = ({ size, className, style }) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M4.93 19.07A10 10 0 0 1 19.07 4.93M7.76 16.24a6 6 0 0 1 8.48-8.48M10.59 13.41a2 2 0 0 1 2.82-2.82" />
    <line x1="12" y1="12" x2="12.01" y2="12" strokeWidth={3} />
  </svg>
);

export const CpuIcon: React.FC<IconProps> = ({ size, className }) => (
  <svg {...base(size)} className={className}>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <rect x="9" y="9" width="6" height="6" />
    <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
  </svg>
);

export const ThermometerIcon: React.FC<IconProps & { style?: React.CSSProperties }> = ({ size, className, style }) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
  </svg>
);

export const WindIcon: React.FC<IconProps & { style?: React.CSSProperties }> = ({ size, className, style }) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
  </svg>
);

export const DropletIcon: React.FC<IconProps & { style?: React.CSSProperties }> = ({ size, className, style }) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
  </svg>
);

export const UserIcon: React.FC<IconProps & { style?: React.CSSProperties }> = ({ size, className, style }) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export const FolderIcon: React.FC<IconProps & { style?: React.CSSProperties }> = ({ size, className, style }) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

export const ListIcon: React.FC<IconProps & { style?: React.CSSProperties }> = ({ size, className, style }) => (
  <svg {...base(size)} className={className} style={style}>
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

export const ShieldAlertIcon: React.FC<IconProps & { style?: React.CSSProperties }> = ({ size, className, style }) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

