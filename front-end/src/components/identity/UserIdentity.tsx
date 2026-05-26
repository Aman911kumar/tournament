import { Crown, ShieldCheck } from "lucide-react";
import UserAvatar, { IdentityUser } from "@/components/identity/UserAvatar";
import { cn } from "@/lib/utils";

export const RolePill = ({
  role,
  className,
}: {
  role: "creator" | "admin";
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[9px] font-heading font-bold uppercase tracking-[0.08em]",
      role === "creator" &&
        "border-secondary/30 bg-secondary/10 text-secondary",
      role === "admin" && "border-accent/30 bg-accent/10 text-accent",
      className,
    )}
  >
    {role === "creator" ? (
      <Crown className="h-3 w-3" />
    ) : (
      <ShieldCheck className="h-3 w-3" />
    )}
    {role}
  </span>
);

export const UserIdentity = ({
  user,
  title,
  subtitle,
  avatarSize = "md",
  className,
  onClick,
}: {
  user?: IdentityUser;
  title?: string;
  subtitle?: string;
  avatarSize?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  onClick?: () => void;
}) => {
  const roles = user?.role || [];
  const isCreator = roles.includes("creator");
  const isAdmin = roles.some((role) =>
    ["admin", "super_admin", "moderator"].includes(role),
  );

  const content = (
    <>
      <UserAvatar user={user} name={title} size={avatarSize} />
      <span className="min-w-0 flex-1 text-left">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-display text-sm font-bold text-foreground">
            {title || user?.username || "Player"}
          </span>
          {isAdmin && <RolePill role="admin" />}
          {!isAdmin && isCreator && <RolePill role="creator" />}
        </span>
        {subtitle && (
          <span className="block truncate text-[11px] text-muted-foreground">
            {subtitle}
          </span>
        )}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "arena-focus flex w-full min-w-0 items-center gap-3 rounded-md text-left transition-colors hover:bg-white/[0.03]",
          className,
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      {content}
    </div>
  );
};

export default UserIdentity;
