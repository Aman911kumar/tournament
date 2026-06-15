import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "purple" | "blue" | "green" | "danger" | "ghost";
  full?: boolean;
}

const glowMap = {
  purple:
    "border-secondary/35 bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-[0_8px_22px_hsl(var(--secondary)/0.13)]",
  blue: "border-primary/35 bg-primary text-primary-foreground hover:bg-[hsl(195_100%_60%)] shadow-[0_8px_22px_hsl(var(--primary)/0.13)]",
  green:
    "border-accent/35 bg-accent text-accent-foreground hover:bg-accent/90 shadow-[0_8px_22px_hsl(var(--accent)/0.12)]",
  danger:
    "border-destructive/40 bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-[0_8px_22px_hsl(var(--destructive)/0.14)]",
  ghost:
    "border-glass-border bg-card/70 text-foreground hover:border-primary/35 hover:bg-muted/80",
};

const NeonButton = ({
  children,
  onClick,
  variant = "purple",
  className,
  full = false,
  type = "button",
  disabled = false,
  ...props
}: NeonButtonProps) => (
  <button
    {...props}
    type={type}
    disabled={disabled}
    onClick={!disabled ? onClick : undefined}
    className={cn(
      "arena-focus inline-flex min-h-9 items-center justify-center gap-1.5 rounded-sm border px-3 py-1.5 text-center font-heading text-xs font-bold leading-tight transition-colors active:scale-[0.99] motion-reduce:transition-none",
      glowMap[variant],
      full && "w-full",
      disabled && "pointer-events-none cursor-not-allowed opacity-50",
      className,
    )}
  >
    {children}
  </button>
);

export default NeonButton;
