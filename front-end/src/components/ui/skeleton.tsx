import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md bg-[linear-gradient(90deg,hsl(var(--muted)/0.54),hsl(var(--muted)/0.78),hsl(var(--muted)/0.54))] bg-[length:200%_100%] motion-safe:animate-shimmer motion-reduce:bg-muted/70",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
