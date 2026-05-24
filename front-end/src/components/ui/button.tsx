import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "arena-focus inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-heading text-sm font-bold ring-offset-background transition-[color,background-color,border-color,box-shadow,transform] active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border border-primary/35 bg-primary text-primary-foreground shadow-[0_6px_16px_hsl(var(--primary)/0.12)] hover:bg-[hsl(195_100%_60%)]",
        destructive: "border border-destructive/35 bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-glass-border bg-background/55 text-foreground hover:border-primary/45 hover:bg-primary/10 hover:text-primary",
        secondary: "border border-secondary/30 bg-secondary text-secondary-foreground hover:bg-secondary/85",
        accent: "border border-accent/30 bg-accent text-accent-foreground hover:bg-accent/85",
        soft: "border border-glass-border bg-card/70 text-foreground hover:border-primary/35 hover:bg-muted/80",
        neon: "border border-primary/35 bg-primary/12 text-primary hover:bg-primary/18",
        ghost: "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-8 rounded px-2.5 text-xs",
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded px-3 text-xs",
        lg: "h-11 rounded-md px-4 sm:px-5",
        icon: "h-10 w-10",
        "icon-sm": "h-9 w-9 rounded",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
