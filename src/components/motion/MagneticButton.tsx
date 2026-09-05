"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import type { MouseEvent, ReactNode } from "react";

type Props = {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  variant?: "primary" | "ghost";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
};

const spring = { type: "spring" as const, stiffness: 100, damping: 20 };

export function MagneticButton({
  href,
  onClick,
  children,
  variant = "primary",
  type = "button",
  disabled,
  className = "",
}: Props) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 180, damping: 18 });
  const sy = useSpring(y, { stiffness: 180, damping: 18 });
  const translate = useTransform([sx, sy], ([mx, my]) => `translate3d(${mx}px, ${my}px, 0)`);

  const palette =
    variant === "primary"
      ? "bg-[#c23a3a] text-zinc-50 hover:bg-[#9f2f2f]"
      : "border border-white/10 bg-transparent text-zinc-200 hover:bg-white/5";

  const shared = {
    className: `inline-flex items-center justify-center rounded-full px-6 py-3 text-sm tracking-tight transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${palette} ${className}`,
    style: { transform: translate },
    onMouseMove: (event: MouseEvent<HTMLElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      x.set((event.clientX - rect.left - rect.width / 2) * 0.28);
      y.set((event.clientY - rect.top - rect.height / 2) * 0.28);
    },
    onMouseLeave: () => {
      x.set(0);
      y.set(0);
    },
    transition: spring,
  };

  if (href) {
    return (
      <motion.a href={href} {...shared}>
        {children}
      </motion.a>
    );
  }

  return (
    <motion.button type={type} disabled={disabled} onClick={onClick} {...shared}>
      {children}
    </motion.button>
  );
}
