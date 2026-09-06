"use client";

type Props = {
  name: string;
  iconUrl: string | null;
  size?: number;
};

export function WalletIcon({ name, iconUrl, size = 28 }: Props) {
  if (iconUrl) {
    return (
      // EIP-6963 icons are data URIs from the installed extension.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={iconUrl}
        alt=""
        width={size}
        height={size}
        className="rounded-[6px] object-contain"
        draggable={false}
      />
    );
  }

  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      aria-hidden
      className="flex items-center justify-center rounded-[6px] bg-white/[0.06] font-mono text-[10px] text-foreground"
      style={{ width: size, height: size }}
    >
      {initials || "W"}
    </span>
  );
}
