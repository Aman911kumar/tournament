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
        "relative overflow-hidden rounded-2xl border border-white/10 bg-card shadow-[0_18px_55px_hsl(var(--background)/0.35)]",
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
          <div className="h-full w-full bg-[radial-gradient(circle_at_18%_20%,hsl(var(--secondary)/0.34),transparent_34%),radial-gradient(circle_at_88%_18%,hsl(var(--accent)/0.26),transparent_28%),linear-gradient(135deg,hsl(var(--primary)/0.30),hsl(var(--background))_52%,hsl(var(--secondary)/0.20))]" />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,hsl(var(--background)/0.2)_44%,hsl(var(--card))_100%)]" />
        <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[10px] font-heading font-bold text-cyan-100">
          <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
          BATTLE IDENTITY
        </div>
        {onEditImages && (
          <button
            type="button"
            onClick={onEditImages}
            className="arena-focus absolute right-4 top-4 inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-black/35 px-3 text-[10px] font-heading font-bold text-white transition-colors hover:bg-black/50"
          >
            <Camera className="h-3.5 w-3.5" />
            Edit visuals
          </button>
        )}
      </div>

      <div className="relative px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
        <div
          className={cn(
            "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
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
              <h1 className="truncate font-heading text-xl font-black text-white sm:text-2xl">
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
            className="mt-4 rounded-xl border border-secondary/20 bg-secondary/10 px-3 py-2 text-[11px] text-secondary"
            title={cacheNotice}
          >
            {cacheNotice}
          </p>
        )}

        {stats?.length ? (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] px-2 py-3 text-center"
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
