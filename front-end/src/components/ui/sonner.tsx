import { useTheme } from "next-themes";
import { Toaster as Sonner, toast as sonnerToast } from "sonner";
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  Sparkles,
  XCircle,
  Heart,
  Zap,
  Flame,
  Moon,
  Trophy,
} from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      expand={true}
      gap={8}
      visibleToasts={3}
      offset={16}
      toastOptions={{
        classNames: {
          // SAFE BASE STYLE
          toast:
            "group toast rounded-xl border shadow-lg group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border",

          title: "font-semibold text-sm",

          description:
            "group-[.toast]:text-foreground/80 text-sm",

          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",

          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",

          // IMPROVED COLORS
          success:
            "!border-[hsl(var(--neon-green)/0.65)] !bg-[hsl(var(--neon-green)/0.22)]",

          error:
            "!border-destructive/60 !bg-destructive/20",

          warning:
            "!border-[hsl(38_95%_55%/0.65)] !bg-[hsl(38_95%_55%/0.22)]",

          info:
            "!border-[hsl(var(--neon-blue)/0.65)] !bg-[hsl(var(--neon-blue)/0.22)]",
        },
      }}
      icons={{
        success: (
          <CheckCircle2
            className="h-5 w-5"
            style={{ color: "hsl(var(--neon-green))" }}
          />
        ),

        error: (
          <XCircle className="h-5 w-5 text-destructive" />
        ),

        warning: (
          <AlertTriangle
            className="h-5 w-5"
            style={{ color: "hsl(38 95% 55%)" }}
          />
        ),

        info: (
          <Info
            className="h-5 w-5"
            style={{ color: "hsl(var(--neon-blue))" }}
          />
        ),
      }}
      {...props}
    />
  );
};

type ToastOpts = Parameters<typeof sonnerToast>[1];

const toast = Object.assign(sonnerToast, {
  premium: (message: string, opts?: ToastOpts) =>
    sonnerToast(message, {
      ...opts,
      icon: (
        <Sparkles
          className="h-5 w-5"
          style={{ color: "hsl(var(--neon-purple))" }}
        />
      ),
      className:
        "!border-[hsl(var(--neon-purple)/0.65)] !bg-[hsl(var(--neon-purple)/0.22)]",
    }),

  pink: (message: string, opts?: ToastOpts) =>
    sonnerToast(message, {
      ...opts,
      icon: (
        <Heart
          className="h-5 w-5"
          style={{ color: "hsl(var(--neon-pink))" }}
        />
      ),
      className:
        "!border-[hsl(var(--neon-pink)/0.65)] !bg-[hsl(var(--neon-pink)/0.22)]",
    }),

  cyan: (message: string, opts?: ToastOpts) =>
    sonnerToast(message, {
      ...opts,
      icon: (
        <Zap
          className="h-5 w-5"
          style={{ color: "hsl(190 95% 55%)" }}
        />
      ),
      className:
        "!border-[hsl(190_95%_55%/0.65)] !bg-[hsl(190_95%_55%/0.22)]",
    }),

  orange: (message: string, opts?: ToastOpts) =>
    sonnerToast(message, {
      ...opts,
      icon: (
        <Flame
          className="h-5 w-5"
          style={{ color: "hsl(20 95% 55%)" }}
        />
      ),
      className:
        "!border-[hsl(20_95%_55%/0.65)] !bg-[hsl(20_95%_55%/0.22)]",
    }),

  dark: (message: string, opts?: ToastOpts) =>
    sonnerToast(message, {
      ...opts,
      icon: (
        <Moon
          className="h-5 w-5"
          style={{ color: "hsl(var(--muted-foreground))" }}
        />
      ),
      className:
        "!border-muted/70 !bg-muted/40",
    }),

  reward: (message: string, opts?: ToastOpts) =>
    sonnerToast(message, {
      ...opts,
      icon: (
        <Trophy
          className="h-5 w-5"
          style={{ color: "hsl(45 95% 55%)" }}
        />
      ),
      className:
        "!border-[hsl(45_95%_55%/0.65)] !bg-[hsl(45_95%_55%/0.22)]",
    }),
});

export { Toaster, toast };