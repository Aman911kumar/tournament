import { ReactNode } from "react";
import { Camera, Sparkles } from "lucide-react";
import UserAvatar, { IdentityUser } from "@/components/identity/UserAvatar";
import { RolePill } from "@/components/identity/UserIdentity";
import { cn } from "@/lib/utils";

export const ProfileHero = ({
  user,
  title,
  subtitle,
  bannerUrl,
  stats,
  actions,
  cacheNotice,
  className,
  onEditImages,
  compact = false,
}: {
  user?: IdentityUser;
  title?: string;
  subtitle?: string;
  bannerUrl?: string;
  stats?: Array<{ label: string; value: ReactNode }>;
  actions?: ReactNode;
  cacheNotice?: string | null;
  className?: string;
  onEditImages?: () => void;
  compact?: boolean;
}) => {
  const roles = user?.role || [];
  const isCreator = roles.includes("creator");
  const isAdmin = roles.some((role) =>
    ["admin", "super_admin", "moderator"].includes(role),
  );

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-md border border-glass-border bg-card shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)]",
        className,
      )}
    >
      <div className={cn("relative", compact ? "h-28 sm:h-36" : "h-36 sm:h-44")}>
        {bannerUrl ? (
          <img
            src={bannerUrl}
            alt={`${title || user?.username || "Player"} banner`}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="h-full w-full bg-[linear-gradient(180deg,hsl(var(--primary)/0.12),transparent_54%),linear-gradient(90deg,hsl(var(--foreground)/0.04)_1px,transparent_1px),linear-gradient(0deg,hsl(var(--foreground)/0.03)_1px,transparent_1px)] bg-[size:auto,32px_32px,32px_32px]" />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,hsl(var(--background)/0.2)_44%,hsl(var(--card))_100%)]" />
        <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-sm border border-white/10 bg-background/80 px-2.5 py-1.5 text-[10px] font-heading font-bold uppercase tracking-[0.08em] text-primary sm:left-4 sm:top-4">
          <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
          BATTLE IDENTITY
        </div>
        {onEditImages && (
          <button
            type="button"
            onClick={onEditImages}
            className="arena-focus absolute right-3 top-3 inline-flex h-9 items-center gap-2 rounded-sm border border-white/10 bg-background/80 px-3 text-[10px] font-heading font-bold uppercase tracking-[0.06em] text-white transition-colors hover:bg-card sm:right-4 sm:top-4"
          >
            <Camera className="h-3.5 w-3.5" />
            Edit visuals
          </button>
        )}
      </div>

      <div className="relative px-3 pb-3 pt-0 sm:px-5 sm:pb-5">
        <div
          className={cn(
            "flex flex-col gap-3 min-[520px]:flex-row min-[520px]:items-end min-[520px]:justify-between",
            compact ? "-mt-10 sm:-mt-12" : "-mt-12 sm:-mt-14",
          )}
        >
          <div className="flex min-w-0 items-end gap-3">
            <UserAvatar user={user} size="xl" priority />
            <div className="min-w-0 pb-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                {isAdmin && <RolePill role="admin" />}
                {!isAdmin && isCreator && <RolePill role="creator" />}
              </div>
              <h1 className="truncate font-display text-lg font-extrabold uppercase tracking-tight text-white sm:text-2xl">
                {title || user?.username || "Player"}
              </h1>
              {subtitle && (
                <p className="truncate text-xs text-muted-foreground">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>

        {cacheNotice && (
          <p
            className="mt-3 rounded-sm border border-secondary/20 bg-secondary/10 px-3 py-2 text-[11px] text-secondary"
            title={cacheNotice}
          >
            {cacheNotice}
          </p>
        )}

        {stats?.length ? (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="min-w-0 rounded-sm border border-white/10 bg-white/[0.035] px-2 py-2.5 text-center"
              >
                <div className="truncate font-display text-sm font-black text-primary sm:text-base">
                  {stat.value}
                </div>
                <div className="mt-0.5 truncate text-[10px] font-heading uppercase tracking-wide text-muted-foreground">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default ProfileHero;
