import type { SVGProps } from "react";

export function CoinbaseLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden {...props}>
      <circle cx="20" cy="20" r="20" fill="#0052FF" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M20 32c6.627 0 12-5.373 12-12S26.627 8 20 8 8 13.373 8 20s5.373 12 12 12zm-1.2-9.6h2.4c.662 0 1.2-.538 1.2-1.2v-2.4c0-.662-.538-1.2-1.2-1.2h-2.4c-.662 0-1.2.538-1.2 1.2v2.4c0 .662.538 1.2 1.2 1.2z"
        fill="#fff"
      />
    </svg>
  );
}
