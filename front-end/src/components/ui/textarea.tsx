import * as React from "react";

import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
      <textarea
        className={cn(
        "arena-focus flex min-h-[80px] w-full rounded-sm border border-glass-border bg-background/85 px-3 py-2 text-sm ring-offset-background transition-colors placeholder:text-muted-foreground/65 hover:border-primary/35 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
