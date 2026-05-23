import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Camera,
  CheckCircle2,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  User,
  Users,
} from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import { toast } from "@/components/ui/sonner";
import {
  ProfileUpdatePayload,
  removeAvatar,
  removeBanner,
  updateProfile,
  uploadAvatar,
  uploadBanner,
  User as ProfileUser,
  verifyEmail,
  verifyPhone,
} from "@/api/profile";
import { ProfileHero } from "@/components/identity";
import {
  setCurrentProfileCache,
  useCurrentProfile,
} from "@/hooks/useCurrentProfile";
import { compressImageFile } from "@/lib/image-utils";
import { getErrorMessage, getErrorToast } from "@/lib/page-utils";

interface ProfileForm {
  username: string;
  email: string;
  phone_number: string;
  dateOfBirth: string;
  gender: string;
}

const emptyForm: ProfileForm = {
  username: "",
  email: "",
  phone_number: "",
  dateOfBirth: "",
  gender: "",
};

const inputClass =
  "w-full bg-transparent border border-glass-border rounded-lg px-3 py-2.5 text-sm font-heading focus:outline-none focus:border-primary transition-colors disabled:opacity-60";

const formatDateInput = (dateOfBirth: string | null) => {
  if (!dateOfBirth) return "";
  const date = new Date(dateOfBirth);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
};

const normalizePhoneNumber = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
};

const getEditablePhoneNumber = (phoneNumber?: string) => {
  const value = String(phoneNumber || "").trim();
  return /^(google|facebook):/i.test(value) ? "" : value;
};

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const isValidPhoneNumber = (value: string) => /^[6-9]\d{9}$/.test(normalizePhoneNumber(value));

const toForm = (user: ProfileUser): ProfileForm => ({
  username: user.username ?? "",
  email: user.email ?? "",
  phone_number: getEditablePhoneNumber(user.phone_number),
  dateOfBirth: formatDateInput(user.dateOfBirth),
  gender: user.gender ?? "",
});

const isVerifiedProvider = (user: ProfileUser | null, provider: "email" | "phone") =>
  Boolean(user?.linkedProviders?.some((link) => link.provider === provider && link.verified));

const isEmailVerified = (user: ProfileUser | null) =>
  Boolean(user?.emailVerified ?? user?.email_verified ?? isVerifiedProvider(user, "email"));

const isPhoneVerified = (user: ProfileUser | null) =>
  Boolean(user?.phoneVerified ?? user?.phone_verified ?? isVerifiedProvider(user, "phone"));

const hasVerificationFields = (user: ProfileUser | null) =>
  Boolean(
    user &&
      (Object.prototype.hasOwnProperty.call(user, "emailVerified") ||
        Object.prototype.hasOwnProperty.call(user, "phoneVerified") ||
        Object.prototype.hasOwnProperty.call(user, "email_verified") ||
        Object.prototype.hasOwnProperty.call(user, "phone_verified") ||
        Array.isArray(user.linkedProviders))
  );

const VerificationBadge = ({ verified }: { verified?: boolean }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-heading ${
      verified ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"
    }`}
  >
    {verified ? <CheckCircle2 className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
    {verified ? "Verified" : "Not verified"}
  </span>
);

const EditProfileScreen = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    profile: cachedProfile,
    isLoading: profileLoading,
    error: profileLoadError,
    refetch: refetchProfile,
    cacheNotice,
  } = useCurrentProfile();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const [initialForm, setInitialForm] = useState<ProfileForm>(emptyForm);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState<"email" | "phone" | null>(null);
  const [imageBusy, setImageBusy] = useState<"avatar" | "banner" | "remove-avatar" | "remove-banner" | null>(null);

  const hasChanges = useMemo(
    () =>
      form.username.trim() !== initialForm.username ||
      form.email.trim() !== initialForm.email ||
      form.phone_number.trim() !== initialForm.phone_number ||
      form.dateOfBirth !== initialForm.dateOfBirth ||
      form.gender !== initialForm.gender,
    [form, initialForm],
  );

  const emailHasUnsavedChange = form.email.trim() !== initialForm.email;
  const phoneHasUnsavedChange = form.phone_number.trim() !== initialForm.phone_number;
  const canSave = hasChanges && !saving && !verifying;
  const avatarUrl = profile?.avatar?.url ?? "";
  const emailVerified = isEmailVerified(profile);
  const phoneVerified = isPhoneVerified(profile);
  const loading = profileLoading && !profile;
  const error = !profile && profileLoadError ? getErrorMessage(profileLoadError, "Failed to load profile.") : null;

  const update = (field: keyof ProfileForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const applyProfile = (user: ProfileUser) => {
    const nextForm = toForm(user);
    setProfile(user);
    setInitialForm(nextForm);
    setForm(nextForm);
  };

  useEffect(() => {
    if (cachedProfile && hasVerificationFields(cachedProfile)) {
      applyProfile(cachedProfile);
    }
  }, [cachedProfile]);

  const handleSave = async () => {
    if (!hasChanges) {
      toast.error("No profile changes to save.");
      return;
    }

    if (!form.username.trim()) {
      toast.error("Username is required.");
      return;
    }

    if (!form.email.trim() || !isValidEmail(form.email)) {
      toast.error("A valid email address is required.");
      return;
    }

    if (!form.phone_number.trim() || !isValidPhoneNumber(form.phone_number)) {
      toast.error("A valid 10 digit Indian phone number is required.");
      return;
    }

    try {
      setSaving(true);
      const payload: ProfileUpdatePayload = {};
      if (form.username.trim() !== initialForm.username) payload.username = form.username.trim();
      if (form.email.trim() !== initialForm.email) payload.email = form.email.trim().toLowerCase();
      if (form.phone_number.trim() !== initialForm.phone_number) payload.phone_number = normalizePhoneNumber(form.phone_number);
      if (form.dateOfBirth !== initialForm.dateOfBirth) payload.dateOfBirth = form.dateOfBirth;
      if (form.gender !== initialForm.gender) payload.gender = form.gender;

      const res = await updateProfile(payload);
      applyProfile(res.data.user);
      setCurrentProfileCache(queryClient, res.data.user, res);
      toast.success(res.message);
    } catch (saveError) {
      const errorToast = getErrorToast(saveError, { action: "Update profile", fallback: "Failed to update profile." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async (type: "email" | "phone") => {
    if (type === "email" && emailHasUnsavedChange) {
      toast.info("Save email first", { description: "Verification uses the saved email address." });
      return;
    }
    if (type === "phone" && phoneHasUnsavedChange) {
      toast.info("Save phone first", { description: "Verification uses the saved phone number." });
      return;
    }

    try {
      setVerifying(type);
      const res = type === "email" ? await verifyEmail() : await verifyPhone();
      applyProfile(res.data.user);
      setCurrentProfileCache(queryClient, res.data.user, res);
      toast.success(res.message);
    } catch (verifyError) {
      const errorToast = getErrorToast(verifyError, { action: type === "email" ? "Verify email" : "Verify phone", fallback: "Verification failed." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setVerifying(null);
    }
  };

  const handleImageFile = async (kind: "avatar" | "banner", file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Upload an image file.");
      return;
    }

    const limitMb = kind === "avatar" ? 6 : 10;
    if (file.size > limitMb * 1024 * 1024) {
      toast.error(`${kind === "avatar" ? "Avatar" : "Banner"} is too large.`, {
        description: `Choose an image under ${limitMb} MB.`,
      });
      return;
    }

    try {
      setImageBusy(kind);
      const prepared = await compressImageFile(file, {
        maxWidth: kind === "avatar" ? 640 : 1800,
        maxHeight: kind === "avatar" ? 640 : 720,
        quality: kind === "avatar" ? 0.82 : 0.78,
      });
      const res = kind === "avatar" ? await uploadAvatar(prepared) : await uploadBanner(prepared);
      applyProfile(res.data.user);
      setCurrentProfileCache(queryClient, res.data.user, res);
      toast.success(res.message);
    } catch (uploadError) {
      const errorToast = getErrorToast(uploadError, {
        action: kind === "avatar" ? "Upload avatar" : "Upload banner",
        fallback: "Could not update profile image.",
      });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setImageBusy(null);
      if (kind === "avatar" && avatarInputRef.current) avatarInputRef.current.value = "";
      if (kind === "banner" && bannerInputRef.current) bannerInputRef.current.value = "";
    }
  };

  const handleRemoveImage = async (kind: "avatar" | "banner") => {
    try {
      setImageBusy(kind === "avatar" ? "remove-avatar" : "remove-banner");
      const res = kind === "avatar" ? await removeAvatar() : await removeBanner();
      applyProfile(res.data.user);
      setCurrentProfileCache(queryClient, res.data.user, res);
      toast.success(res.message);
    } catch (removeError) {
      const errorToast = getErrorToast(removeError, {
        action: kind === "avatar" ? "Remove avatar" : "Remove banner",
        fallback: "Could not remove profile image.",
      });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setImageBusy(null);
    }
  };

  return (
    <div className="arena-shell min-h-screen pb-20">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 pb-4 pt-6 sm:px-5">
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate("/profile")}>
            <ArrowLeft className="h-5 w-5" />
          </motion.button>
          <div>
            <h1 className="font-heading text-xl font-bold">Edit Profile</h1>
            <p className="text-[10px] text-muted-foreground">Account details and verification</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate("/change-password")}
          className="inline-flex items-center gap-1 rounded-lg border border-glass-border px-3 py-2 text-[10px] font-heading text-muted-foreground"
        >
          <KeyRound className="h-3.5 w-3.5" />
          Password
        </button>
      </div>

      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 sm:px-5">
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => handleImageFile("avatar", event.target.files?.[0])}
        />
        <input
          ref={bannerInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => handleImageFile("banner", event.target.files?.[0])}
        />

        {profile && (
          <ProfileHero
            user={profile}
            title={form.username || profile.username}
            subtitle={form.email || form.phone_number || "Build your Battle4Arena identity"}
            bannerUrl={profile.banner?.url}
            cacheNotice={cacheNotice}
            compact
            actions={
              <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={Boolean(imageBusy)}
                  className="arena-focus inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 text-[10px] font-heading font-bold text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
                >
                  {imageBusy === "avatar" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                  Change avatar
                </button>
                <button
                  type="button"
                  onClick={() => bannerInputRef.current?.click()}
                  disabled={Boolean(imageBusy)}
                  className="arena-focus inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-secondary/25 bg-secondary/10 px-3 text-[10px] font-heading font-bold text-secondary transition-colors hover:bg-secondary/15 disabled:opacity-50"
                >
                  {imageBusy === "banner" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
                  Change banner
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => handleRemoveImage("avatar")}
                    disabled={Boolean(imageBusy)}
                    className="arena-focus inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-2.5 text-[10px] font-heading font-bold text-destructive/85 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {imageBusy === "remove-avatar" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Remove avatar
                  </button>
                )}
                {profile.banner?.url && (
                  <button
                    type="button"
                    onClick={() => handleRemoveImage("banner")}
                    disabled={Boolean(imageBusy)}
                    className="arena-focus inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-2.5 text-[10px] font-heading font-bold text-destructive/85 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {imageBusy === "remove-banner" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Remove banner
                  </button>
                )}
              </div>
            }
          />
        )}

        {loading && (
          <div className="space-y-4">
            {[0, 1, 2].map((item) => (
              <GlassCard key={item}>
                <div className="mb-3 h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-10 w-full animate-pulse rounded bg-muted" />
              </GlassCard>
            ))}
          </div>
        )}

        {!loading && error && (
          <GlassCard className="py-8 text-center">
            <AlertCircle className="mx-auto mb-2 h-10 w-10 text-destructive" />
            <p className="text-sm font-heading">Could not load profile</p>
            <p className="mt-1 break-words text-xs text-muted-foreground">{error}</p>
            <button type="button" onClick={() => refetchProfile()} className="mt-4 inline-flex items-center gap-2 text-xs font-heading text-primary">
              <RefreshCcw className="h-3.5 w-3.5" />
              Retry
            </button>
          </GlassCard>
        )}

        {!loading && !error && (
          <>
            <GlassCard>
              <div className="mb-4 flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <h2 className="font-heading text-sm font-bold">Identity</h2>
              </div>
              <label className="mb-1 block text-[10px] font-heading text-muted-foreground">Username</label>
              <input value={form.username} onChange={(e) => update("username", e.target.value)} disabled={saving} className={inputClass} />
            </GlassCard>

            <GlassCard>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-secondary" />
                  <h2 className="font-heading text-sm font-bold">Email</h2>
                </div>
                <VerificationBadge verified={emailVerified} />
              </div>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="Required email address"
                  disabled={saving}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => handleVerify("email")}
                  disabled={!form.email.trim() || emailVerified || emailHasUnsavedChange || Boolean(verifying)}
                  className="shrink-0 rounded-lg border border-secondary/30 px-3 text-[10px] font-heading font-semibold text-secondary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {verifying === "email" ? "..." : emailVerified ? "Verified" : "Verify"}
                </button>
              </div>
            </GlassCard>

            <GlassCard>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-accent" />
                  <h2 className="font-heading text-sm font-bold">Phone</h2>
                </div>
                <VerificationBadge verified={phoneVerified} />
              </div>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={form.phone_number}
                  onChange={(e) => update("phone_number", e.target.value)}
                  placeholder="Required 10 digit phone number"
                  disabled={saving}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => handleVerify("phone")}
                  disabled={!form.phone_number.trim() || phoneVerified || phoneHasUnsavedChange || Boolean(verifying)}
                  className="shrink-0 rounded-lg border border-accent/30 px-3 text-[10px] font-heading font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {verifying === "phone" ? "..." : phoneVerified ? "Verified" : "Verify"}
                </button>
              </div>
            </GlassCard>

            <GlassCard>
              <div className="mb-4 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <h2 className="font-heading text-sm font-bold">Personal Details</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] font-heading text-muted-foreground">Date of Birth</label>
                  <input type="date" value={form.dateOfBirth} onChange={(e) => update("dateOfBirth", e.target.value)} disabled={saving} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[10px] font-heading text-muted-foreground">
                    <Users className="h-3 w-3" /> Gender
                  </label>
                  <select value={form.gender} onChange={(e) => update("gender", e.target.value)} disabled={saving} className={inputClass}>
                    <option value="" className="bg-background">Select gender</option>
                    <option value="male" className="bg-background">Male</option>
                    <option value="female" className="bg-background">Female</option>
                    <option value="other" className="bg-background">Other</option>
                  </select>
                </div>
              </div>
            </GlassCard>

            <NeonButton disabled={!canSave} full variant="purple" className="mt-4" onClick={handleSave}>
              {saving ? "SAVING..." : "SAVE CHANGES"}
            </NeonButton>
          </>
        )}
      </div>
    </div>
  );
};

export default EditProfileScreen;
