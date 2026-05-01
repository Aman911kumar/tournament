import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, ArrowLeft, Calendar, Camera, Lock, RefreshCcw, User, Users } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import { toast } from "@/components/ui/sonner";
import { getMyProfile, updateProfile, User as ProfileUser } from "@/api/profile";
import {
  CACHE_KEYS,
  getSavedDataLabel,
  getSavedDataNotice,
  readCache,
  writeAuthenticatedCache,
} from "@/lib/offline-cache";
import { getErrorMessage, getErrorToast } from "@/lib/page-utils";

interface ProfileForm {
  username: string;
  dateOfBirth: string;
  gender: string;
  password: string;
}

const emptyForm: ProfileForm = {
  username: "",
  dateOfBirth: "",
  gender: "",
  password: "",
};

const inputClass =
  "w-full bg-transparent border border-glass-border rounded-lg px-3 py-2.5 text-sm font-heading focus:outline-none focus:border-primary transition-colors disabled:opacity-60";

const formatDateInput = (dateOfBirth: string | null) => {
  if (!dateOfBirth) return "";
  const date = new Date(dateOfBirth);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
};

const EditProfileScreen = () => {
  const navigate = useNavigate();
  const [initialForm, setInitialForm] = useState<ProfileForm>(emptyForm);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheNotice, setCacheNotice] = useState<string | null>(null);

  const hasChanges = useMemo(
    () =>
      form.username.trim() !== initialForm.username ||
      form.dateOfBirth !== initialForm.dateOfBirth ||
      form.gender !== initialForm.gender,
    [form, initialForm],
  );

  const canSave = hasChanges && form.password.trim().length > 0 && !saving;

  const update = (field: keyof ProfileForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const fetchProfile = useCallback(async () => {
    const cachedProfile = readCache<ProfileUser>(CACHE_KEYS.profile);

    try {
      setLoading(true);
      setError(null);
      if (cachedProfile) {
        const cachedForm = {
          username: cachedProfile.data.username ?? "",
          dateOfBirth: formatDateInput(cachedProfile.data.dateOfBirth),
          gender: cachedProfile.data.gender ?? "",
          password: "",
        };
        setInitialForm(cachedForm);
        setForm(cachedForm);
        setCacheNotice(getSavedDataLabel(cachedProfile.savedAt));
      }

      const res = await getMyProfile();
      const nextForm = {
        username: res.data.user.username ?? "",
        dateOfBirth: formatDateInput(res.data.user.dateOfBirth),
        gender: res.data.user.gender ?? "",
        password: "",
      };
      setInitialForm(nextForm);
      setForm(nextForm);
      setCacheNotice(null);
      writeAuthenticatedCache(CACHE_KEYS.profile, res.data.user, res);
    } catch (loadError) {
      const message = getErrorMessage(loadError, "Failed to load profile.");
      if (cachedProfile) {
        setError(null);
        const notice = getSavedDataNotice(cachedProfile.savedAt, loadError);
        setCacheNotice(notice);
        toast.info("Showing saved profile data.", { description: notice });
      } else {
        setError(message);
        const errorToast = getErrorToast(loadError, { action: "Load profile", fallback: "Failed to load profile." });
        toast.error(errorToast.title, { description: errorToast.description });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSave = async () => {
    if (!hasChanges) {
      toast.error("No profile changes to save.");
      return;
    }

    if (!form.password.trim()) {
      toast.error("Enter your password to confirm changes.");
      return;
    }

    try {
      setSaving(true);
      const res = await updateProfile({
        username: form.username.trim(),
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        password: form.password,
      });
      writeAuthenticatedCache(CACHE_KEYS.profile, res.data.user, res);
      toast.success(res.message);
      navigate("/profile");
    } catch (saveError) {
      const errorToast = getErrorToast(saveError, { action: "Update profile", fallback: "Failed to update profile." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 pt-6 pb-4 flex items-center gap-3">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate("/profile")}>
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <h1 className="font-heading text-xl font-bold">Edit Profile</h1>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 space-y-4">
        <div className="flex justify-center mb-2">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="relative w-24 h-24 rounded-full gradient-primary flex items-center justify-center neon-glow-purple"
          >
            <User className="w-10 h-10 text-primary-foreground" />
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-accent flex items-center justify-center">
              <Camera className="w-4 h-4 text-accent-foreground" />
            </div>
          </motion.div>
        </div>

        {loading && (
          <div className="space-y-4">
            {[0, 1, 2, 3].map((item) => (
              <GlassCard key={item} neon>
                <div className="h-4 w-24 bg-muted rounded animate-pulse mb-3" />
                <div className="h-10 w-full bg-muted rounded animate-pulse" />
              </GlassCard>
            ))}
          </div>
        )}

        {!loading && error && (
          <GlassCard className="text-center py-8">
            <AlertCircle className="w-10 h-10 mx-auto text-destructive mb-2" />
            <p className="text-sm font-heading">Could not load profile</p>
            <p className="text-xs text-muted-foreground mt-1 break-words">{error}</p>
            <button
              type="button"
              onClick={fetchProfile}
              className="mt-4 inline-flex items-center gap-2 text-xs font-heading text-primary"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              Retry
            </button>
          </GlassCard>
        )}

        {!loading && !error && (
          <>
            <GlassCard neon>
              {cacheNotice && (
                <p className="mb-3 max-w-full truncate rounded-full bg-secondary/10 px-2 py-1 text-[10px] font-heading text-secondary" title={cacheNotice}>
                  {cacheNotice}
                </p>
              )}
              <label className="text-xs text-muted-foreground font-heading mb-1 block">Username</label>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => update("username", e.target.value)}
                  placeholder="Username"
                  disabled={saving}
                  className={inputClass}
                />
              </div>
            </GlassCard>

            <GlassCard neon>
              <label className="text-xs text-muted-foreground font-heading mb-1 block">Date of Birth</label>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => update("dateOfBirth", e.target.value)}
                  disabled={saving}
                  className={inputClass}
                />
              </div>
            </GlassCard>

            <GlassCard neon>
              <label className="text-xs text-muted-foreground font-heading mb-1 block">Gender</label>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                <select
                  value={form.gender}
                  onChange={(e) => update("gender", e.target.value)}
                  disabled={saving}
                  className={inputClass}
                >
                  <option value="" className="bg-background">Select gender</option>
                  <option value="male" className="bg-background">Male</option>
                  <option value="female" className="bg-background">Female</option>
                  <option value="other" className="bg-background">Other</option>
                </select>
              </div>
            </GlassCard>

            <GlassCard neon>
              <label className="text-xs text-muted-foreground font-heading mb-1 block">Password</label>
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  type="password"
                  value={form.password}
                  disabled={!hasChanges || saving}
                  onChange={(e) => update("password", e.target.value)}
                  placeholder={hasChanges ? "Enter password to confirm" : "Make a change first"}
                  className={inputClass}
                />
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
