import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  neon?: boolean;
  delay?: number;
  onClick?: () => void;
}

const GlassCard = ({ children, className, neon = false, delay = 0, onClick }: GlassCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4, ease: "easeOut" }}
    onClick={onClick}
    className={cn(
      "glass rounded-xl p-4",
      neon && "neon-border",
      className
    )}
  >
    {children}
  </motion.div>
);

export default GlassCard;
