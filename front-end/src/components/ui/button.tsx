import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "arena-focus inline-flex min-w-0 select-none items-center justify-center gap-2 whitespace-normal text-center rounded-sm font-heading text-xs font-bold uppercase leading-tight tracking-[0.08em] ring-offset-background transition-[color,background-color,border-color,transform] active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border border-primary bg-primary text-primary-foreground hover:bg-[hsl(195_100%_62%)]",
        destructive: "border border-destructive/35 bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-glass-border bg-background/80 text-foreground hover:border-primary/55 hover:bg-primary/10 hover:text-primary",
        secondary: "border border-secondary/30 bg-secondary text-secondary-foreground hover:bg-secondary/85",
        accent: "border border-accent/30 bg-accent text-accent-foreground hover:bg-accent/85",
        soft: "border border-glass-border bg-card/95 text-foreground hover:border-primary/45 hover:bg-muted/80",
        neon: "border border-primary/35 bg-primary/12 text-primary hover:bg-primary/18",
        ghost: "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        xs: "min-h-8 rounded-sm px-2.5 py-1 text-[10px]",
        default: "min-h-10 px-4 py-2",
        sm: "min-h-9 rounded-sm px-3 py-1.5 text-[10px]",
        lg: "min-h-11 rounded-sm px-4 py-2 sm:px-5",
        icon: "h-10 w-10",
        "icon-sm": "h-9 w-9 rounded-sm",
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
