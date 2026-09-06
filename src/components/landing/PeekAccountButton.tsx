"use client";

import { motion } from "framer-motion";

const spring = { type: "spring" as const, stiffness: 100, damping: 20 };

function PeekMark({
  src,
  invert = false,
}: {
  src: "/claude.png" | "/openai.png" | "/deepseek.png";
  invert?: boolean;
}) {
  return (
    <img
      src={src}
      alt=""
      width={36}
      height={36}
      className={`h-9 w-9 object-contain ${invert ? "invert brightness-150 contrast-125" : ""}`}
    />
  );
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
        <PeekMark src="/openai.png" invert />
      </motion.div>

      <span className="relative z-10 inline-flex w-[min(228px,calc(100vw-48px))] items-center justify-center border border-white/35 bg-[#1c1c1f] px-6 py-3 font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-100 transition-transform group-active:scale-[0.98] sm:px-8">
        {label}
      </span>
    </>
  );

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
