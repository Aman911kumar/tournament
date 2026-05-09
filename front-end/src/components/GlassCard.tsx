import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  neon?: boolean;
  delay?: number;
  onClick?: () => void;
  asButton?: boolean;
}

const GlassCard = ({ children, className, neon = false, delay = 0, onClick, asButton = false }: GlassCardProps) => {
  const interactive = Boolean(onClick || asButton);

  return (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    whileTap={interactive ? { scale: 0.99 } : undefined}
    transition={{ delay, duration: 0.22, ease: "easeOut" }}
    onClick={onClick}
    role={interactive ? "button" : undefined}
    tabIndex={interactive ? 0 : undefined}
    onKeyDown={(event) => {
      if (!interactive || !onClick) return;
      if (event.key === "Enter" || event.key === " ") onClick();
    }}
    className={cn(
      "glass rounded-lg p-4 transition-colors motion-reduce:transition-none",
      neon && "neon-border",
      interactive && "arena-focus hover:border-primary/45 hover:bg-card",
      className
    )}
  >
    {children}
  </motion.div>
  );
};

export default GlassCard;
