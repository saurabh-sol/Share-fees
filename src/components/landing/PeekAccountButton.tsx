"use client";

import { OpenAiLogo } from "@phosphor-icons/react";
import { motion } from "framer-motion";

const spring = { type: "spring" as const, stiffness: 100, damping: 20 };

function scrollToHash(href: string) {
  const id = href.startsWith("#") ? href.slice(1) : href;
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function PeekMark({ src }: { src: "/claude.png" | "/deepseek.png" }) {
  return <img src={src} alt="" width={36} height={36} className="h-9 w-9 object-contain" />;
}

export function PeekAccountButton({
  href,
  onClick,
  label = "Connect account",
}: {
  href?: string;
  onClick?: () => void;
  label?: string;
}) {
  const shared = {
    initial: "rest" as const,
    animate: "rest" as const,
    whileHover: "hover" as const,
    whileFocus: "hover" as const,
    className: "group relative inline-flex items-center justify-center outline-none",
  };

  const handleClick = () => {
    if (href?.startsWith("#")) {
      scrollToHash(href);
      return;
    }
    onClick?.();
  };

  const inner = (
    <>
      <motion.div
        variants={{
          rest: { opacity: 0, x: "-50%", y: 10 },
          hover: { opacity: 1, x: "-50%", y: "-55%" },
        }}
        transition={spring}
        className="pointer-events-none absolute left-1/2 top-0 z-0"
      >
        <PeekMark src="/claude.png" />
      </motion.div>
      <motion.div
        variants={{
          rest: { opacity: 0, y: -8, rotate: 6 },
          hover: { opacity: 1, y: "45%", rotate: -8 },
        }}
        transition={{ ...spring, delay: 0.03 }}
        className="pointer-events-none absolute bottom-0 left-2 z-0"
      >
        <PeekMark src="/deepseek.png" />
      </motion.div>
      <motion.div
        variants={{
          rest: { opacity: 0, y: -8, rotate: -6 },
          hover: { opacity: 1, y: "45%", rotate: 8 },
        }}
        transition={{ ...spring, delay: 0.06 }}
        className="pointer-events-none absolute bottom-0 right-2 z-0"
      >
        <OpenAiLogo size={32} weight="regular" className="text-zinc-100" />
      </motion.div>

      <span className="relative z-10 inline-flex w-[min(228px,calc(100vw-48px))] items-center justify-center border border-white/35 bg-raised px-6 py-3 font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-100 transition-transform group-active:scale-[0.98] sm:px-8">
        {label}
      </span>
    </>
  );

  if (href?.startsWith("#")) {
    return (
      <motion.button type="button" onClick={handleClick} {...shared}>
        {inner}
      </motion.button>
    );
  }

  if (href) {
    return (
      <motion.a href={href} {...shared}>
        {inner}
      </motion.a>
    );
  }

  return (
    <motion.button type="button" onClick={onClick} {...shared}>
      {inner}
    </motion.button>
  );
}
