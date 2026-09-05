import type { SVGProps } from "react";

export function EthereumLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden {...props}>
      <path d="M20 4L19.8 4.3v11.2L20 15.7l8.5-5-8.5-6.7z" fill="#8C8C8C" />
      <path d="M20 4L11.5 9l8.5 5V4.3L20 4z" fill="#CFCFCF" />
      <path d="M20 22.1l-.1.1v6.7l.1.1 8.5-12-8.5 5.1z" fill="#8C8C8C" />
      <path d="M20 28.9v-6.8L11.5 16l8.5 12.9z" fill="#CFCFCF" />
      <path d="M20 20.5l8.5-5-8.5-3.9v8.9z" fill="#666" />
      <path d="M11.5 15.5L20 20.5v-8.9l-8.5 3.9z" fill="#999" />
    </svg>
  );
}
