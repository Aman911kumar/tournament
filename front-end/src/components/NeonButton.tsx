import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface NeonButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "purple" | "blue" | "green";
  className?: string;
  full?: boolean;
  type?: "button" | "submit";
  disabled?: boolean; // ✅ added
}

const glowMap = {
  purple: "neon-glow-purple bg-primary hover:bg-primary/90",
  blue: "neon-glow-blue bg-secondary hover:bg-secondary/90",
  green: "neon-glow-green bg-accent hover:bg-accent/90 text-accent-foreground",
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
    whileHover={!disabled ? { scale: 1.02 } : undefined}
    whileTap={!disabled ? { scale: 0.97 } : undefined}
    onClick={!disabled ? onClick : undefined}
    className={cn(
      "px-6 py-3 rounded-lg font-heading font-semibold text-sm tracking-wide text-primary-foreground transition-all duration-200",
      glowMap[variant],
      full && "w-full",
      disabled && "opacity-50 cursor-not-allowed pointer-events-none",
      className
    )}
  >
    {children}
  </motion.button>
);

export default NeonButton;