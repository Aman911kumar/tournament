import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "b4a-skeleton",
        className,
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

export { Skeleton };
