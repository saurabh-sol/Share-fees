import type { SVGProps } from "react";

export function PhantomLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden {...props}>
      <rect width="40" height="40" rx="10" fill="#AB9FF2" />
      <path
        d="M28.5 18.2c0 5.8-4.7 10.5-10.5 10.5S7.5 24 7.5 18.2 12.2 7.7 18 7.7s10.5 4.7 10.5 10.5z"
        fill="#fff"
      />
      <ellipse cx="14.2" cy="17.5" rx="2.2" ry="2.8" fill="#AB9FF2" />
      <ellipse cx="21.8" cy="17.5" rx="2.2" ry="2.8" fill="#AB9FF2" />
      <path
        d="M14.5 22.5c1.5 1.2 3.5 1.8 5.5 1.8s4-.6 5.5-1.8"
        stroke="#AB9FF2"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
