import { DiscordLogo, GithubLogo, Globe, XLogo } from "@phosphor-icons/react/dist/ssr";

const SOCIALS = [
  { href: "https://x.com", label: "X", Icon: XLogo },
  { href: "https://discord.com", label: "Discord", Icon: DiscordLogo },
  { href: "https://github.com", label: "GitHub", Icon: GithubLogo },
  { href: "/", label: "Website", Icon: Globe },
];

export function SocialButtons() {
  return (
    <div className="flex flex-wrap gap-2.5">
      {SOCIALS.map(({ href, label, Icon }) => (
        <a
          key={label}
          href={href}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel={href.startsWith("http") ? "noreferrer" : undefined}
          aria-label={label}
          className="inline-flex h-10 w-10 items-center justify-center border border-white/8 text-zinc-300 transition-colors hover:border-[#c23a3a] hover:text-[#c23a3a] focus-visible:border-[#c23a3a] focus-visible:outline-none"
        >
          <Icon size={16} />
        </a>
      ))}
    </div>
  );
}
