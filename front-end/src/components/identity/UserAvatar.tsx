import { UserRound } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type IdentityUser = {
  _id?: string;
  username?: string;
  email?: string;
  avatar?: { url?: string; thumbUrl?: string };
  role?: string[];
} | null;

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const sizeClass: Record<AvatarSize, string> = {
  xs: "h-7 w-7 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-base",
  xl: "h-24 w-24 text-xl",
};

const getInitials = (name?: string, fallback = "B4A") => {
  const value = String(name || "").trim();
  if (!value) return fallback;
  const parts = value.split(/\s|_/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }
  return value.slice(0, 2).toUpperCase();
};

export const UserAvatar = ({
  user,
  src,
  name,
  size = "md",
  className,
  imageClassName,
  status,
  priority = false,
  title,
}: {
  user?: IdentityUser;
  src?: string;
  name?: string;
  size?: AvatarSize;
  className?: string;
  imageClassName?: string;
  status?: "online" | "offline" | "speaking";
  priority?: boolean;
  title?: string;
}) => {
  const label = name || user?.username || user?.email || "Battle4Arena player";
  const imageUrl = src || user?.avatar?.thumbUrl || user?.avatar?.url || "";
  const isCreator = user?.role?.includes("creator");
  const isAdmin = user?.role?.some((role) =>
    ["admin", "super_admin", "moderator"].includes(role),
  );

  return (
    <span className={cn("relative inline-flex shrink-0", className)} title={title}>
      <Avatar
        className={cn(
          sizeClass[size],
          "border-glass-border bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.24),hsl(var(--card))_62%)] shadow-[0_0_0_1px_hsl(var(--primary)/0.08)]",
          isCreator && "border-secondary/35 shadow-[0_0_0_1px_hsl(var(--secondary)/0.18)]",
          isAdmin && "border-accent/40 shadow-[0_0_0_1px_hsl(var(--accent)/0.2)]",
        )}
      >
        {imageUrl && (
          <AvatarImage
            src={imageUrl}
            alt={label}
            className={cn("object-cover", imageClassName)}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            referrerPolicy="no-referrer"
          />
        )}
        <AvatarFallback>
          {label ? (
            getInitials(label)
          ) : (
            <UserRound className="h-4 w-4" aria-hidden="true" />
          )}
        </AvatarFallback>
      </Avatar>
      {status && (
        <span
          className={cn(
            "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-background",
            status === "online" && "bg-emerald-400",
            status === "offline" && "bg-muted-foreground",
            status === "speaking" && "motion-safe:animate-pulse bg-cyan-300",
          )}
        />
      )}
    </span>
  );
};

export default UserAvatar;
