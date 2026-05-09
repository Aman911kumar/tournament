import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface NeonButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "purple" | "blue" | "green" | "ghost";
  className?: string;
  full?: boolean;
  type?: "button" | "submit";
  disabled?: boolean;
}

const glowMap = {
  purple: "border-primary/35 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_10px_28px_hsl(var(--primary)/0.18)]",
  blue: "border-secondary/35 bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-[0_10px_28px_hsl(var(--secondary)/0.16)]",
  green: "border-accent/35 bg-accent text-accent-foreground hover:bg-accent/90 shadow-[0_10px_28px_hsl(var(--accent)/0.16)]",
  ghost: "border-glass-border bg-card/70 text-foreground hover:border-primary/35 hover:bg-muted/80",
};

const NeonButton = ({
  children,
  onClick,
  variant = "purple",
  className,
  full = false,
  type = "button",
  disabled = false,
}: NeonButtonProps) => (
  <motion.button
    type={type}
    disabled={disabled}
    whileTap={!disabled ? { scale: 0.98 } : undefined}
    onClick={!disabled ? onClick : undefined}
    className={cn(
      "arena-focus inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-5 py-2.5 font-heading text-sm font-bold transition-colors motion-reduce:transition-none",
      glowMap[variant],
      full && "w-full",
      disabled && "pointer-events-none cursor-not-allowed opacity-50",
      className,
    )}
  >
    {children}
  </motion.button>
);

export default NeonButton;
