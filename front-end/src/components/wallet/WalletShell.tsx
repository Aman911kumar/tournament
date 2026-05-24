import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, ShieldCheck, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface WalletShellProps {
  title: string;
  subtitle: string;
  icon?: LucideIcon;
  children: ReactNode;
  maxWidth?: string;
  rightAction?: ReactNode;
}

export const WalletShell = ({
  title,
  subtitle,
  icon: Icon = Wallet,
  children,
  maxWidth = "max-w-4xl",
  rightAction,
}: WalletShellProps) => {
  const navigate = useNavigate();

  return (
    <div className="arena-shell min-h-[100dvh] overflow-x-hidden pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-24">
      <style>{`
        .wallet-flow-hero {
          background:
            radial-gradient(circle at 88% 6%, hsl(var(--accent) / 0.14), transparent 26%),
            radial-gradient(circle at 0% 0%, hsl(var(--primary) / 0.18), transparent 30%),
            linear-gradient(135deg, hsl(var(--card) / 0.92), hsl(var(--background) / 0.96));
          box-shadow: inset 0 1px 0 hsl(var(--foreground) / 0.045), 0 10px 26px rgb(0 0 0 / 0.16);
        }
        .wallet-flow-panel {
          border: 1px solid hsl(var(--border) / 0.72);
          background: hsl(var(--card) / 0.78);
          box-shadow: inset 0 1px 0 hsl(var(--foreground) / 0.04);
        }
        .wallet-flow-input {
          border: 1px solid hsl(var(--border) / 0.72);
          background: hsl(var(--background) / 0.48);
          transition: border-color 150ms ease, background-color 150ms ease;
        }
        .wallet-flow-input:focus-within {
          border-color: hsl(var(--primary) / 0.68);
          background: hsl(var(--background) / 0.64);
        }
        .wallet-flow-tile {
          border: 1px solid hsl(var(--border) / 0.68);
          background: hsl(var(--background) / 0.42);
        }
        @media (max-width: 480px) {
          .wallet-flow-hero,
          .wallet-flow-panel {
            border-radius: 1rem;
            box-shadow: inset 0 1px 0 hsl(var(--foreground) / 0.035), 0 8px 18px rgb(0 0 0 / 0.14);
          }
        }
      `}</style>

      <header className="sticky top-0 z-20 border-b border-glass-border bg-background/92 backdrop-blur-md">
        <div
          className={cn(
            "mx-auto flex w-full items-center gap-2 px-2.5 py-2 sm:gap-3 sm:px-5 sm:py-3",
            maxWidth,
          )}
        >
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="arena-focus grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-glass-border bg-card/70 active:scale-[0.98] sm:h-10 sm:w-10 sm:rounded-xl"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary sm:h-10 sm:w-10 sm:rounded-xl">
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-heading text-base font-black sm:text-lg">
              {title}
            </h1>
            <p className="truncate text-[10px] text-muted-foreground sm:text-[11px]">
              {subtitle}
            </p>
          </div>
          {rightAction}
        </div>
      </header>

      <main
        className={cn(
          "mx-auto w-full space-y-2.5 px-2.5 pt-2.5 sm:space-y-4 sm:px-5 sm:pt-4",
          maxWidth,
        )}
      >
        {children}
      </main>
    </div>
  );
};

export const WalletSecurityNote = ({ children }: { children: ReactNode }) => (
  <div className="rounded-lg border border-accent/20 bg-accent/10 p-2 sm:rounded-xl sm:p-3">
    <p className="flex items-center gap-1.5 font-heading text-[11px] font-bold text-accent sm:gap-2 sm:text-xs">
      <ShieldCheck className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
      Secure wallet note
    </p>
    <p className="mt-1 text-[10px] leading-4 text-muted-foreground sm:text-[11px] sm:leading-5">
      {children}
    </p>
  </div>
);
