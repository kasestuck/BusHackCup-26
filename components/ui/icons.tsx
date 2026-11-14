import type { SVGProps } from "react";

/** 24×24 stroke icons, 1.75 stroke. Decorative by default (aria-hidden). */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 20, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
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

export const IconHome = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.5 10.5 12 3.5l8.5 7" />
    <path d="M5.5 9v11h13V9" />
    <path d="M10 20v-5.5h4V20" />
  </Base>
);

export const IconCalendar = (p: IconProps) => (
  <Base {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Base>
);

export const IconGift = (p: IconProps) => (
  <Base {...p}>
    <rect x="3.5" y="8.5" width="17" height="4" rx="1" />
    <path d="M5 12.5v8h14v-8M12 8.5v12" />
    <path d="M12 8.5C10.5 5 7 4.5 7 6.8 7 8.5 12 8.5 12 8.5ZM12 8.5c1.5-3.5 5-4 5-1.7 0 1.7-5 1.7-5 1.7Z" />
  </Base>
);

export const IconUser = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="8.5" r="4" />
    <path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
  </Base>
);

export const IconFlame = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.8 3-6 4-9.3 2.8 1.6 4 4 4 5.8 1-.6 1.7-1.8 1.9-3 1.8 1.5 3.1 3.9 3.1 6.5 0 3.6-2.6 6.2-6.5 6.2Z" />
  </Base>
);

export const IconCoin = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M14.8 9.3c-.5-.9-1.6-1.5-2.8-1.5-1.6 0-2.8.9-2.8 2.1 0 2.8 5.8 1.4 5.8 4.2 0 1.2-1.3 2.1-3 2.1-1.3 0-2.4-.6-2.9-1.6M12 6.5v1.3M12 16.2v1.3" />
  </Base>
);

export const IconBolt = (p: IconProps) => (
  <Base {...p}>
    <path d="M13 2.8 5 13.5h6.2L10.5 21.2 19 10.3h-6.3l.3-7.5Z" />
  </Base>
);

export const IconClock = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Base>
);

export const IconDumbbell = (p: IconProps) => (
  <Base {...p}>
    <path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" />
  </Base>
);

export const IconArrowRight = (p: IconProps) => (
  <Base {...p}>
    <path d="M4.5 12h15M13.5 6l6 6-6 6" />
  </Base>
);

export const IconPlay = (p: IconProps) => (
  <Base {...p}>
    <path d="M7.5 5.2v13.6a.6.6 0 0 0 .9.5l10.6-6.8a.6.6 0 0 0 0-1L8.4 4.7a.6.6 0 0 0-.9.5Z" fill="currentColor" stroke="none" />
  </Base>
);

export const IconAlert = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 4 2.8 19.5h18.4L12 4Z" />
    <path d="M12 10v4.2M12 17h.01" />
  </Base>
);

export const IconWifiOff = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 3l18 18M8.5 16a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 4.3-2.4M19 12.5a10 10 0 0 0-2.3-1.6M2 8.8a15 15 0 0 1 4-2.5M22 8.8A15 15 0 0 0 11 5M12 19.5h.01" />
  </Base>
);

export const IconLock = (p: IconProps) => (
  <Base {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  </Base>
);

export const IconSpark = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
  </Base>
);

export const IconMapPin = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.3" />
  </Base>
);

export const IconRefresh = (p: IconProps) => (
  <Base {...p}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4" />
  </Base>
);

export const IconBowl = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0Z" />
    <path d="M8 8.5c0-1.5 1-2.5 2.5-2.5M12.5 8.5c0-2 1.2-3.5 3-3.5M17 8.5c0-.8.4-1.5 1-1.8" />
  </Base>
);

export const IconShield = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6l-7-2.5Z" />
  </Base>
);
