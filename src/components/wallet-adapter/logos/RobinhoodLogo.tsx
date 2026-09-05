import type { SVGProps } from "react";

export function RobinhoodLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden {...props}>
      <rect width="40" height="40" rx="10" fill="#00C805" />
      <path
        d="M28 12c-2.2 0-4 1.8-4 4v8c0 2.2-1.8 4-4 4h-4c-2.2 0-4-1.8-4-4v-8c0-2.2 1.8-4 4-4h8c2.2 0 4 1.8 4 4v8c0 4.4-3.6 8-8 8"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
