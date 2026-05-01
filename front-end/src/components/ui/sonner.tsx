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
      toastOptions={{
        classNames: {
          toast:
            "group toast pointer-events-auto relative flex w-full items-center gap-3 overflow-hidden rounded-xl border p-4 shadow-lg backdrop-blur-xl group-[.toaster]:bg-card/80 group-[.toaster]:text-foreground group-[.toaster]:border-glass-border",
          title: "text-sm font-semibold",
          description: "group-[.toast]:text-muted-foreground text-xs whitespace-pre-line leading-relaxed",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-md group-[.toast]:px-3 group-[.toast]:py-1.5 group-[.toast]:text-xs",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-md group-[.toast]:px-3 group-[.toast]:py-1.5 group-[.toast]:text-xs",
          success:
            "group-[.toaster]:!border-[hsl(var(--neon-green)/0.5)] group-[.toaster]:!bg-[hsl(var(--neon-green)/0.12)] group-[.toaster]:!text-foreground",
          error:
            "group-[.toaster]:!border-destructive/50 group-[.toaster]:!bg-destructive/15 group-[.toaster]:!text-foreground",
          warning:
            "group-[.toaster]:!border-[hsl(38_95%_55%/0.5)] group-[.toaster]:!bg-[hsl(38_95%_55%/0.12)] group-[.toaster]:!text-foreground",
          info:
            "group-[.toaster]:!border-[hsl(var(--neon-blue)/0.5)] group-[.toaster]:!bg-[hsl(var(--neon-blue)/0.12)] group-[.toaster]:!text-foreground",
        },
      }}
      icons={{
        success: <CheckCircle2 className="h-5 w-5" style={{ color: "hsl(var(--neon-green))" }} />,
        error: <XCircle className="h-5 w-5 text-destructive" />,
        warning: <AlertTriangle className="h-5 w-5" style={{ color: "hsl(38 95% 55%)" }} />,
        info: <Info className="h-5 w-5" style={{ color: "hsl(var(--neon-blue))" }} />,
      }}
      {...props}
    />
  );
};

type ToastOpts = Parameters<typeof sonnerToast>[1];

/** Shared style builder so every custom variant matches the default toast format. */
const variantStyle = (color: string, glow?: string) =>
  `!border-[hsl(${color}/0.55)] !bg-[hsl(${color}/0.14)] !text-foreground${glow ? ` ${glow}` : ""}`;

/**
 * Enhanced toast helper with brand variants.
 * Same layout as default toast — only accent color + icon differ.
 *
 * Usage:
 *   toast.success("Saved!")
 *   toast.warning("Low balance")
 *   toast.info("New update available")
 *   toast.premium("Welcome to Pro!")
 *   toast.pink("Liked!")
 *   toast.cyan("Tournament is live")
 *   toast.orange("Trending now")
 *   toast.dark("System update")
 *   toast.reward("You won ₹500!")
 */
const toast = Object.assign(sonnerToast, {
  premium: (message: string, opts?: ToastOpts) =>
    sonnerToast(message, {
      ...opts,
      icon: <Sparkles className="h-5 w-5" style={{ color: "hsl(var(--neon-purple))" }} />,
      className: variantStyle("var(--neon-purple)", "neon-glow-purple"),
    }),
  pink: (message: string, opts?: ToastOpts) =>
    sonnerToast(message, {
      ...opts,
      icon: <Heart className="h-5 w-5" style={{ color: "hsl(var(--neon-pink))" }} />,
      className: variantStyle("var(--neon-pink)"),
    }),
  cyan: (message: string, opts?: ToastOpts) =>
    sonnerToast(message, {
      ...opts,
      icon: <Zap className="h-5 w-5" style={{ color: "hsl(190 95% 55%)" }} />,
      className: variantStyle("190 95% 55%"),
    }),
  orange: (message: string, opts?: ToastOpts) =>
    sonnerToast(message, {
      ...opts,
      icon: <Flame className="h-5 w-5" style={{ color: "hsl(20 95% 55%)" }} />,
      className: variantStyle("20 95% 55%"),
    }),
  dark: (message: string, opts?: ToastOpts) =>
    sonnerToast(message, {
      ...opts,
      icon: <Moon className="h-5 w-5" style={{ color: "hsl(var(--muted-foreground))" }} />,
      className: variantStyle("var(--muted-foreground)"),
    }),
  reward: (message: string, opts?: ToastOpts) =>
    sonnerToast(message, {
      ...opts,
      icon: <Trophy className="h-5 w-5" style={{ color: "hsl(45 95% 55%)" }} />,
      className: variantStyle("45 95% 55%"),
    }),
});

export { Toaster, toast };







// import { useTheme } from "next-themes";
// import { Toaster as Sonner, toast } from "sonner";

// type ToasterProps = React.ComponentProps<typeof Sonner>;

// const Toaster = ({ ...props }: ToasterProps) => {
//   const { theme = "system" } = useTheme();

//   return (
//     <Sonner
//       theme={theme as ToasterProps["theme"]}
//       className="toaster group"
//       toastOptions={{
//         classNames: {
//           toast:
//             "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
//           description: "group-[.toast]:text-muted-foreground",
//           actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
//           cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
//         },
//       }}
//       {...props}
//     />
//   );
// };

// export { Toaster, toast };
