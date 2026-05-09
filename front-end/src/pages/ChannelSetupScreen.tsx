import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  AtSign,
  CheckCircle2,
  Globe,
  Image,
  Instagram,
  Link,
  MessageCircle,
  Save,
  ShieldCheck,
  UserRound,
  Youtube,
} from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import { ApiError } from "@/api/client";
import { ChannelSetupPayload, createChannel, CreatorChannel, getMyChannel, updateChannel } from "@/api/creators";
import { getMyProfile, User } from "@/api/profile";
import { toast } from "@/components/ui/sonner";
import { getErrorToast } from "@/lib/page-utils";

interface FormState {
  name: string;
  handle: string;
  description: string;
  avatarUrl: string;
  bannerUrl: string;
  youtube: string;
  instagram: string;
  discord: string;
  website: string;
}

const inputClass =
  "w-full bg-transparent border border-glass-border rounded-lg px-3 py-2.5 text-sm font-heading placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors";

const emptyForm: FormState = {
  name: "",
  handle: "",
  description: "",
  avatarUrl: "",
  bannerUrl: "",
  youtube: "",
  instagram: "",
  discord: "",
  website: "",
};

const makeHandle = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/^[^a-z0-9]+/, "")
    .slice(0, 30);

const hydrateForm = (channel: CreatorChannel | null, user: User | null): FormState => ({
  name: channel?.name || user?.username || "",
  handle: channel?.handle || makeHandle(user?.username || ""),
  description: channel?.description || "",
  avatarUrl: channel?.avatar?.url || user?.avatar?.url || "",
  bannerUrl: channel?.banner?.url || "",
  youtube: channel?.socialLinks?.youtube || "",
  instagram: channel?.socialLinks?.instagram || "",
  discord: channel?.socialLinks?.discord || "",
  website: channel?.socialLinks?.website || "",
});

const toPayload = (form: FormState): ChannelSetupPayload => ({
  name: form.name.trim(),
  handle: makeHandle(form.handle),
  description: form.description.trim(),
  avatar: form.avatarUrl.trim() ? { url: form.avatarUrl.trim() } : undefined,
  banner: form.bannerUrl.trim() ? { url: form.bannerUrl.trim() } : undefined,
  socialLinks: {
    youtube: form.youtube.trim(),
    instagram: form.instagram.trim(),
    discord: form.discord.trim(),
    website: form.website.trim(),
  },
});

const ChannelSetupScreen = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [profile, setProfile] = useState<User | null>(null);
  const [channel, setChannel] = useState<CreatorChannel | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const profileRes = await getMyProfile();
        if (!active) return;

        const user = profileRes.data.user;
        setProfile(user);

        if (!user.role?.includes("creator") && !user.role?.includes("admin")) {
          toast.error("Creator approval required", {
            description: "Request creator access from your profile before setting up a channel.",
          });
          navigate("/profile", { replace: true });
          return;
        }

        try {
          const mine = await getMyChannel();
          if (!active) return;
          setChannel(mine.channel);
          setForm(hydrateForm(mine.channel, user));
        } catch (channelError) {
          if (channelError instanceof ApiError && channelError.status === 404) {
            setForm(hydrateForm(null, user));
          } else {
            throw channelError;
          }
        }
      } catch (error) {
        const errorToast = getErrorToast(error, { action: "Load channel setup", fallback: "Could not load channel setup." });
        toast.error(errorToast.title, { description: errorToast.description });
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [navigate]);

  const handleValid = useMemo(() => /^[a-z0-9][a-z0-9_-]{2,29}$/.test(makeHandle(form.handle)), [form.handle]);
  const canSave = Boolean(form.name.trim() && handleValid && !saving);

  const update = (key: keyof FormState, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: key === "handle" ? makeHandle(value) : value,
    }));
  };

  const handleNameChange = (value: string) => {
    setForm((current) => ({
      ...current,
      name: value,
      handle: current.handle ? current.handle : makeHandle(value),
    }));
  };

  const handleSave = async () => {
    if (!canSave) {
      toast.error("Complete channel basics", {
        description: "Channel name and a valid public handle are required.",
      });
      return;
    }

    try {
      setSaving(true);
      const payload = toPayload(form);
      const saved = channel?._id ? await updateChannel(channel._id, payload) : await createChannel(payload);
      setChannel(saved);
      setForm(hydrateForm(saved, profile));
      toast.success(channel?._id ? "Channel updated" : "Channel created", {
        description: `@${saved.handle} is ready.`,
      });
      navigate(`/creator/${saved._id}`);
    } catch (error) {
      const errorToast = getErrorToast(error, { action: "Save channel", fallback: "Could not save channel." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="arena-shell min-h-screen px-4 pt-8">
        <div className="mx-auto w-full max-w-4xl space-y-3">
          <div className="h-8 w-40 animate-pulse rounded bg-muted" />
          <div className="h-44 animate-pulse rounded-xl bg-muted" />
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="arena-shell min-h-screen pb-10">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 pb-4 pt-6 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </motion.button>
          <div className="min-w-0">
            <h1 className="truncate font-heading text-xl font-bold">Channel Setup</h1>
            <p className="text-[10px] text-muted-foreground font-heading">
              {channel?._id ? "Update your creator channel" : "Create your creator channel"}
            </p>
          </div>
        </div>
        <NeonButton variant="green" className="shrink-0 px-3 py-1.5 text-[10px]" onClick={handleSave} disabled={!canSave}>
          <Save className="mr-1 h-3 w-3" /> Save
        </NeonButton>
      </div>

      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 sm:px-5">
        <GlassCard neon>
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary/10">
              <ShieldCheck className="h-5 w-5 text-secondary" />
            </div>
            <div className="min-w-0">
              <p className="font-heading text-sm font-bold">Creator channel</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Complete your public creator identity for followers, ratings, public profiles, and tournament ownership.
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="mb-4 flex items-center gap-2">
            <UserRound className="h-4 w-4 text-primary" />
            <h2 className="font-heading text-sm font-bold">Identity</h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[10px] font-heading text-muted-foreground">Channel Name</label>
              <input
                value={form.name}
                onChange={(event) => handleNameChange(event.target.value)}
                placeholder="Your creator or team name"
                maxLength={80}
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 flex items-center gap-1 text-[10px] font-heading text-muted-foreground">
                <AtSign className="h-3 w-3" /> Public Handle
              </label>
              <input
                value={form.handle}
                onChange={(event) => update("handle", event.target.value)}
                placeholder="creator-handle"
                maxLength={30}
                className={`${inputClass} ${handleValid ? "" : "border-destructive/70 focus:border-destructive"}`}
              />
              <div className="mt-1 flex items-center justify-between gap-3 text-[10px]">
                <span className={handleValid ? "text-accent" : "text-destructive"}>
                  {handleValid ? `/${makeHandle(form.handle)}` : "Use 3-30 letters, numbers, _ or -"}
                </span>
                {handleValid && <CheckCircle2 className="h-3 w-3 shrink-0 text-accent" />}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-heading text-muted-foreground">Description</label>
              <textarea
                value={form.description}
                onChange={(event) => update("description", event.target.value)}
                placeholder="Games, schedule, prize style, or community notes"
                rows={4}
                maxLength={500}
                className={`${inputClass} resize-none font-body`}
              />
              <p className="mt-1 text-right text-[10px] text-muted-foreground">{form.description.length}/500</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="mb-4 flex items-center gap-2">
            <Image className="h-4 w-4 text-secondary" />
            <h2 className="font-heading text-sm font-bold">Images</h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-heading text-muted-foreground">Avatar URL</label>
              <input
                value={form.avatarUrl}
                onChange={(event) => update("avatarUrl", event.target.value)}
                placeholder="https://..."
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-heading text-muted-foreground">Banner URL</label>
              <input
                value={form.bannerUrl}
                onChange={(event) => update("bannerUrl", event.target.value)}
                placeholder="https://..."
                className={inputClass}
              />
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="mb-4 flex items-center gap-2">
            <Globe className="h-4 w-4 text-accent" />
            <h2 className="font-heading text-sm font-bold">Social Links</h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="relative block">
              <Youtube className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input value={form.youtube} onChange={(event) => update("youtube", event.target.value)} placeholder="YouTube" className={`${inputClass} pl-9`} />
            </label>
            <label className="relative block">
              <Instagram className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input value={form.instagram} onChange={(event) => update("instagram", event.target.value)} placeholder="Instagram" className={`${inputClass} pl-9`} />
            </label>
            <label className="relative block">
              <MessageCircle className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input value={form.discord} onChange={(event) => update("discord", event.target.value)} placeholder="Discord" className={`${inputClass} pl-9`} />
            </label>
            <label className="relative block">
              <Link className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input value={form.website} onChange={(event) => update("website", event.target.value)} placeholder="Website" className={`${inputClass} pl-9`} />
            </label>
          </div>
        </GlassCard>

        <NeonButton full variant="green" className="py-3 text-sm" onClick={handleSave} disabled={!canSave}>
          {saving ? "SAVING..." : channel?._id ? "SAVE CHANNEL" : "CREATE CHANNEL"}
        </NeonButton>
      </div>
    </div>
  );
};

export default ChannelSetupScreen;
