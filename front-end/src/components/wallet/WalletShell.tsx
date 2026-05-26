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
    <div className="arena-shell min-h-[100dvh] overflow-x-hidden pb-[calc(5rem_+_env(safe-area-inset-bottom))] sm:pb-24">
      <style>{`
        .wallet-flow-hero {
          background:
            linear-gradient(180deg, hsl(var(--primary) / 0.08), transparent 44%),
            hsl(var(--card) / 0.96);
          box-shadow: inset 0 1px 0 hsl(var(--foreground) / 0.08);
        }
        .wallet-flow-panel {
          border: 1px solid hsl(var(--border) / 0.72);
          background: hsl(var(--card) / 0.96);
          box-shadow: inset 0 1px 0 hsl(var(--foreground) / 0.06);
        }
        .wallet-flow-input {
          border: 1px solid hsl(var(--border) / 0.72);
          background: hsl(var(--background) / 0.82);
          transition: border-color 150ms ease, background-color 150ms ease;
        }
        .wallet-flow-input:focus-within {
          border-color: hsl(var(--primary) / 0.68);
          background: hsl(var(--background) / 0.92);
        }
        .wallet-flow-tile {
          border: 1px solid hsl(var(--border) / 0.68);
          background: hsl(var(--background) / 0.72);
        }
        .wallet-flow-panel .wallet-flow-tile,
        .wallet-flow-hero .wallet-flow-tile {
          border: 0;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
        }
        .wallet-flow-panel .wallet-flow-tile + .wallet-flow-tile,
        .wallet-flow-hero .wallet-flow-tile + .wallet-flow-tile {
          border-top: 1px solid hsl(var(--glass-border));
        }
        @media (max-width: 480px) {
          .wallet-flow-hero,
          .wallet-flow-panel {
            border-radius: var(--radius-panel);
            box-shadow: inset 0 1px 0 hsl(var(--foreground) / 0.06);
          }
        }
      `}</style>

      <header className="sticky top-0 z-20 border-b border-glass-border bg-background/95">
        <div
          className={cn(
            "mx-auto flex w-full items-center gap-2 px-2.5 py-2 sm:gap-3 sm:px-5 sm:py-3",
            maxWidth,
          )}
        >
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="arena-focus grid h-8 w-8 shrink-0 place-items-center rounded-md border border-glass-border bg-card/95 active:scale-[0.98] sm:h-10 sm:w-10"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-primary/30 bg-primary/10 text-primary sm:h-10 sm:w-10">
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-base font-extrabold uppercase tracking-tight text-primary sm:text-lg">
              {title}
            </h1>
            <p className="truncate font-heading text-[10px] uppercase tracking-wide text-muted-foreground sm:text-[11px]">
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
  <div className="rounded-md border border-accent/20 bg-accent/10 p-2 sm:p-3">
    <p className="flex items-center gap-1.5 font-heading text-[11px] font-bold text-accent sm:gap-2 sm:text-xs">
      <ShieldCheck className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
      Secure wallet note
    </p>
    <p className="mt-1 text-[10px] leading-4 text-muted-foreground sm:text-[11px] sm:leading-5">
      {children}
    </p>
  </div>
);
