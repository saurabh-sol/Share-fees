import { XLogo } from "@phosphor-icons/react/dist/ssr";

const SOCIALS = [{ href: "https://x.com/useaccrued", label: "Twitter", Icon: XLogo }];

export function SocialButtons() {
  return (
    <div className="flex flex-wrap gap-2.5">
      {SOCIALS.map(({ href, label, Icon }) => (
        <a
          key={label}
          href={href}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel={href.startsWith("http") ? "noreferrer" : undefined}
          className="inline-flex h-10 items-center gap-2.5 border border-white/8 px-4 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-300 transition-colors hover:border-accent hover:text-accent focus-visible:border-accent focus-visible:outline-none"
        >
          <Icon size={16} />
          <span>{label}</span>
        </a>
      ))}
    </div>
  );
}
