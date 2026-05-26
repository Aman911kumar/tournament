import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ChevronRight,
  Search,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/identity";
import { cn } from "@/lib/utils";

type Tone = "primary" | "secondary" | "accent" | "danger" | "muted" | "pink";

const toneClasses: Record<Tone, string> = {
  primary: "border-primary/30 bg-primary/10 text-primary",
  secondary: "border-secondary/30 bg-secondary/10 text-secondary",
  accent: "border-accent/30 bg-accent/10 text-accent",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
  muted: "border-glass-border bg-muted/45 text-muted-foreground",
  pink: "border-neon-pink/30 bg-neon-pink/10 text-neon-pink",
};

export const PageShell = ({
  children,
  className,
  contentClassName,
  wide = false,
  bottomNavPadding = true,
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  wide?: boolean;
  bottomNavPadding?: boolean;
}) => (
  <div
    className={cn(
      "arena-shell",
      bottomNavPadding ? "arena-page" : "arena-page-no-nav",
      className,
    )}
  >
    <div
      className={cn(
        wide ? "arena-container-wide" : "arena-container",
        "arena-layout-root",
        contentClassName,
      )}
    >
      {children}
    </div>
  </div>
);

export const PageHeader = ({
  title,
  subtitle,
  icon: Icon,
  action,
  onBack,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  onBack?: () => void;
  className?: string;
}) => (
  <header
    className={cn(
      "flex items-center justify-between gap-2 border-b border-glass-border pb-2 pt-3 sm:gap-3 sm:pb-3 sm:pt-4",
      className,
    )}
  >
    <div className="flex min-w-0 items-center gap-3">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="arena-icon-button"
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      )}
      {Icon && (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-primary/35 bg-primary/10 text-primary sm:h-9 sm:w-9">
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </span>
      )}
      <div className="min-w-0">
        <h1 className="arena-title">{title}</h1>
        {subtitle && <p className="arena-subtitle mt-1">{subtitle}</p>}
      </div>
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </header>
);

const hasPaddingOverride = (className?: string) =>
  /(?:^|\s)(?:p|px|py|pt|pr|pb|pl)-/.test(className || "");

export const Surface = ({
  children,
  className,
  interactive = false,
  neon = false,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  neon?: boolean;
  onClick?: () => void;
}) => {
  const clickable = interactive || Boolean(onClick);
  return (
    <div
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") onClick();
      }}
      className={cn(
        "arena-auto-box min-w-0 rounded-md border border-glass-border bg-card/95 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)]",
        !hasPaddingOverride(className) && "p-[var(--ui-surface-padding)]",
        neon && "neon-border",
        clickable &&
          "arena-focus transition-colors hover:border-primary/45 hover:bg-card",
        className,
      )}
    >
      {children}
    </div>
  );
};

export const MetricCard = ({
  icon: Icon,
  label,
  value,
  note,
  tone = "primary",
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: Tone;
  onClick?: () => void;
}) => (
  <Surface
    onClick={onClick}
    interactive={Boolean(onClick)}
    className="min-h-[72px] sm:min-h-[84px]"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-heading text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-1.5 truncate font-display text-lg font-extrabold leading-tight sm:text-xl">
          {value}
        </p>
      </div>
      <span
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-md border sm:h-9 sm:w-9",
          toneClasses[tone],
        )}
      >
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
      </span>
    </div>
    {note && (
      <p className="mt-3 truncate text-xs text-muted-foreground">{note}</p>
    )}
  </Surface>
);

export const StatusPill = ({
  children,
  tone = "muted",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-heading text-[10px] font-bold uppercase tracking-[0.06em]",
      toneClasses[tone],
      className,
    )}
  >
    {children}
  </span>
);

export const EmptyState = ({
  icon: Icon = Search,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) => (
  <Surface className="py-7 text-center sm:py-8">
    <Icon className="mx-auto mb-3 h-8 w-8 text-primary" />
    <p className="font-display text-sm font-extrabold uppercase tracking-tight">{title}</p>
    {description && (
      <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
        {description}
      </p>
    )}
    {action && <div className="mt-4">{action}</div>}
  </Surface>
);

export const SkeletonBlock = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "b4a-skeleton",
      className,
    )}
    aria-hidden="true"
  />
);

export const FormField = ({
  label,
  icon: Icon,
  children,
  hint,
  className,
}: {
  label: ReactNode;
  icon?: LucideIcon;
  children: ReactNode;
  hint?: ReactNode;
  className?: string;
}) => (
  <label className={cn("block space-y-1.5", className)}>
    <span className="flex items-center gap-1.5 font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </span>
    {children}
    {hint && (
      <span className="block text-[11px] text-muted-foreground">{hint}</span>
    )}
  </label>
);

export const SegmentedControl = <T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: Array<{ label: ReactNode; value: T; icon?: LucideIcon }>;
  onChange: (value: T) => void;
  className?: string;
}) => (
  <div
    className={cn(
      "flex gap-1 overflow-x-auto rounded-md border border-glass-border bg-card/95 p-1 scrollbar-hide",
      className,
    )}
    role="tablist"
  >
    {options.map((option) => {
      const Icon = option.icon;
      const active = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "arena-focus inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 font-heading text-xs font-bold transition-colors",
            active
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted/65 hover:text-foreground",
          )}
          role="tab"
          aria-selected={active}
        >
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {option.label}
        </button>
      );
    })}
  </div>
);

export const ActionButton = ({
  className,
  variant = "soft",
  ...props
}: ButtonProps) => (
  <Button
    variant={variant}
    className={cn("min-h-10 rounded-md", className)}
    {...props}
  />
);

export const SearchBox = ({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) => (
  <div
    className={cn(
      "flex min-h-10 items-center gap-2 rounded-md border border-glass-border bg-background/80 px-3 transition-colors focus-within:border-primary/60",
      className,
    )}
  >
    <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
    />
  </div>
);

export const CreatorCard = ({
  name,
  avatarUrl,
  followers,
  rating,
  active,
  onClick,
}: {
  name: string;
  avatarUrl?: string;
  followers?: number;
  rating?: number;
  active?: boolean;
  onClick?: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="arena-focus min-w-[132px] shrink-0 rounded-md border border-glass-border bg-card/95 p-3 text-left transition-colors hover:border-primary/55 hover:bg-card"
  >
    <div className="flex items-center gap-3">
      <UserAvatar
        user={{ username: name, avatar: { url: avatarUrl }, role: ["creator"] }}
        size="lg"
      />
      <div className="min-w-0">
        <p className="truncate font-display text-sm font-bold">{name}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {Number(followers || 0).toLocaleString("en-IN")} followers
        </p>
      </div>
    </div>
    <div className="mt-3 flex items-center justify-between gap-2">
      <StatusPill tone={active ? "accent" : "muted"}>
        {active ? "Active" : "Creator"}
      </StatusPill>
      <span className="font-heading text-[10px] font-bold text-accent">
        {Number(rating || 0).toFixed(1)}
      </span>
    </div>
  </button>
);

export const TournamentCard = ({
  title,
  game,
  creator,
  status,
  prize,
  slots,
  maxSlots,
  entry,
  joined,
  onClick,
  onCreatorClick,
}: {
  title: string;
  game: string;
  creator: string;
  status: ReactNode;
  prize: ReactNode;
  slots: number;
  maxSlots: number;
  entry: ReactNode;
  joined?: boolean;
  onClick?: () => void;
  onCreatorClick?: () => void;
}) => (
  <Surface interactive onClick={onClick} neon className="overflow-hidden p-0">
    <div className="p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-base font-extrabold uppercase tracking-tight">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{game}</p>
        </div>
        <StatusPill tone={joined ? "accent" : "secondary"}>{status}</StatusPill>
      </div>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onCreatorClick?.();
        }}
        className="arena-focus mt-3 inline-flex items-center gap-1.5 rounded-sm font-heading text-[10px] uppercase tracking-wide text-primary"
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        {creator}
      </button>
      <div className="arena-data-grid mt-4 min-[380px]:grid-cols-3">
        <div className="arena-data-tile">
          <p className="font-heading text-[10px] uppercase tracking-wide text-muted-foreground">Prize</p>
          <p className="truncate font-heading text-xs font-bold text-accent">
            {prize}
          </p>
        </div>
        <div className="arena-data-tile">
          <p className="font-heading text-[10px] uppercase tracking-wide text-muted-foreground">Slots</p>
          <p className="font-heading text-xs font-bold">
            {slots}/{maxSlots}
          </p>
        </div>
        <div className="arena-data-tile">
          <p className="font-heading text-[10px] uppercase tracking-wide text-muted-foreground">Entry</p>
          <p className="truncate font-heading text-xs font-bold">{entry}</p>
        </div>
      </div>
    </div>
    <div className="flex items-center justify-between gap-3 border-t border-glass-border/70 px-4 py-3">
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        {Math.max(maxSlots - slots, 0)} left
      </span>
      <span className="inline-flex items-center gap-1 font-heading text-xs font-bold text-primary">
        {joined ? "Open Match" : "View & Register"}
        <ChevronRight className="h-3.5 w-3.5" />
      </span>
    </div>
  </Surface>
);

export const ResponsiveTable = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "arena-scrollbar overflow-x-auto rounded-md border border-glass-border bg-card/95",
      className,
    )}
  >
    {children}
  </div>
);

export const ActionNoteDialog = ({
  open,
  onOpenChange,
  title,
  description,
  label,
  value,
  onValueChange,
  placeholder,
  confirmLabel = "Confirm",
  loading = false,
  required = false,
  destructive = false,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  label: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  confirmLabel?: ReactNode;
  loading?: boolean;
  required?: boolean;
  destructive?: boolean;
  onSubmit: () => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="font-display uppercase tracking-tight">{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <label className="block space-y-2">
        <span className="font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
          {required ? " *" : ""}
        </span>
        <Textarea
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder={placeholder}
          rows={4}
          disabled={loading}
        />
      </label>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant={destructive ? "destructive" : "default"}
          onClick={onSubmit}
          disabled={loading}
        >
          {loading ? "Working..." : confirmLabel}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
);

export { Trophy };
