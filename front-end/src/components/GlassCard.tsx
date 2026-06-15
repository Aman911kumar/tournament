import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  neon?: boolean;
  delay?: number;
  onClick?: () => void;
  asButton?: boolean;
}

const GlassCard = ({
  children,
  className,
  neon = false,
  delay = 0,
  onClick,
  asButton = false,
}: GlassCardProps) => {
  const interactive = Boolean(onClick || asButton);

  return (
    <div
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      style={delay ? { transitionDelay: `${delay * 1000}ms` } : undefined}
      onKeyDown={(event) => {
        if (!interactive || !onClick) return;
        if (event.key === "Enter" || event.key === " ") onClick();
      }}
      className={cn(
        "glass min-w-0 rounded-md p-[var(--ui-surface-padding)] transition-colors motion-reduce:transition-none",
        neon && "neon-border",
        interactive &&
          "arena-focus active:scale-[0.99] hover:border-primary/45 hover:bg-card",
        className,
      )}
    >
      {children}
    </div>
  );
};

export default GlassCard;
