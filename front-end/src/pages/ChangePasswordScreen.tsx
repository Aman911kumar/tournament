import { useNavigate } from "react-router-dom";
import { Lock, Eye, EyeOff, ShieldCheck, KeyRound, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import NeonButton from "@/components/NeonButton";
import { toast } from "@/components/ui/sonner";
import { changePassword } from "@/api/auth";
import { getErrorToast } from "@/lib/page-utils";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { PageHeader, PageShell, StatusPill, Surface } from "@/components/design-system";

type FieldKey = "current" | "next" | "confirm";

const ChangePasswordScreen = () => {
  const navigate = useNavigate();
  const { profile } = useCurrentProfile();
  const [values, setValues] = useState({ current: "", next: "", confirm: "" });
  const [show, setShow] = useState<Record<FieldKey, boolean>>({ current: false, next: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [isSetPasswordMode, setIsSetPasswordMode] = useState(false);
  const [hasPhoneNumber, setHasPhoneNumber] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const phoneNumber = String(profile.phone_number || "").trim();
    setIsSetPasswordMode(Boolean(profile.socialProvider) && profile.passwordLoginEnabled !== true);
    setHasPhoneNumber(Boolean(phoneNumber) && !/^(google|facebook):/i.test(phoneNumber));
    setProfileLoading(false);
  }, [profile]);

  const strength = useMemo(() => {
    const p = values.next;
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score; // 0..4
  }, [values.next]);

  const strengthMeta = [
    { label: "Too weak", color: "bg-destructive", glow: "shadow-[0_0_12px_hsl(var(--destructive)/0.6)]" },
    { label: "Weak", color: "bg-destructive", glow: "shadow-[0_0_12px_hsl(var(--destructive)/0.6)]" },
    { label: "Fair", color: "bg-yellow-500", glow: "shadow-[0_0_12px_rgba(234,179,8,0.6)]" },
    { label: "Strong", color: "bg-accent", glow: "shadow-[0_0_12px_hsl(var(--accent)/0.7)]" },
    { label: "Excellent", color: "bg-primary", glow: "shadow-[0_0_16px_hsl(var(--primary)/0.8)]" },
  ][strength];

  const checks = [
    { ok: values.next.length >= 8, label: "At least 8 characters" },
    { ok: /[A-Z]/.test(values.next), label: "An uppercase letter" },
    { ok: /[0-9]/.test(values.next), label: "A number" },
    { ok: /[^A-Za-z0-9]/.test(values.next), label: "A special symbol" },
  ];

  const handleSubmit = async () => {
    if (isSetPasswordMode && !hasPhoneNumber) {
      toast.error("Add your phone number first.");
      navigate("/edit-profile");
      return;
    }
    if ((!isSetPasswordMode && !values.current) || !values.next || !values.confirm) {
      toast.error(isSetPasswordMode ? "Fill in the new password fields." : "Fill in all password fields.");
      return;
    }
    if (values.next !== values.confirm) {
      toast.error("New password and confirmation must match.");
      return;
    }
    if (strength < 2) {
      toast.error("Password too weak. Try a stronger combination.");
      return;
    }
    try {
      setLoading(true);
      const res = await changePassword({
        ...(isSetPasswordMode ? {} : { currentPassword: values.current }),
        newPassword: values.next,
      });
      toast.success(res.message);
      navigate("/profile");
    } catch (err) {
      const errorToast = getErrorToast(err, { action: "Change password", fallback: "Failed to update password." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setLoading(false);
    }
  };

  const renderField = (
    key: FieldKey,
    label: string,
    placeholder: string,
  ) => (
    <Surface neon>
      <label className="text-xs text-muted-foreground font-heading mb-1 block">{label}</label>
      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          type={show[key] ? "text" : "password"}
          value={values[key]}
          onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
          placeholder={placeholder}
          disabled={loading}
          className="w-full bg-transparent border border-glass-border rounded-lg px-3 py-2.5 text-sm font-heading focus:outline-none focus:border-primary transition-colors"
        />
        <button
          type="button"
          onClick={() => setShow((s) => ({ ...s, [key]: !s[key] }))}
          disabled={loading}
          className="arena-focus rounded-lg p-2 text-muted-foreground transition-colors hover:text-primary"
          aria-label={show[key] ? "Hide password" : "Show password"}
        >
          {show[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </Surface>
  );

  return (
    <PageShell contentClassName="max-w-2xl space-y-3 pb-6 sm:space-y-4">
      <PageHeader
        title={isSetPasswordMode ? "Set Password" : "Change Password"}
        subtitle="Protect your Battle4Arena account"
        onBack={() => navigate("/profile")}
      />

      <Surface neon className="overflow-hidden p-0 text-center">
        <div className="bg-[radial-gradient(circle_at_24%_0%,hsl(var(--primary)/0.28),transparent_32%),linear-gradient(135deg,hsl(var(--primary)/0.14),hsl(var(--card)))] p-5">
          <StatusPill tone="primary">Security</StatusPill>
          <div className="mx-auto mt-5 flex h-20 w-20 items-center justify-center rounded-2xl border border-primary/35 gradient-primary">
            <KeyRound className="w-10 h-10 text-primary-foreground" />
          </div>
        </div>
        <p className="mx-auto max-w-sm px-4 py-4 text-sm leading-relaxed text-muted-foreground">
          {isSetPasswordMode
            ? "Create a password so you can log in with your phone number next time."
            : "Keep your account secure. Use a fresh password you don't reuse anywhere else."}
        </p>
      </Surface>

        <div className="space-y-4">
          {!isSetPasswordMode && renderField("current", "Current Password", "Enter current password")}
          {isSetPasswordMode && !hasPhoneNumber && !profileLoading && (
            <Surface neon className="border border-destructive/30">
              <p className="text-sm font-heading font-bold text-destructive">Phone number required</p>
              <p className="mt-1 text-xs text-muted-foreground">Add a phone number before enabling phone/password login.</p>
            </Surface>
          )}
          {renderField("next", "New Password", "Enter new password")}

          {/* Strength meter */}
          {values.next && (
            <Surface className="px-3 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-heading">
                  Strength
                </span>
                <span className="text-xs font-heading font-semibold">{strengthMeta.label}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 mb-3">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i < strength ? `${strengthMeta.color} ${strengthMeta.glow}` : "bg-glass-border"
                    }`}
                  />
                ))}
              </div>
              <ul className="grid grid-cols-2 gap-1.5">
                {checks.map((c) => (
                  <li
                    key={c.label}
                    className={`flex items-center gap-1.5 text-[11px] transition-colors ${
                      c.ok ? "text-accent" : "text-muted-foreground"
                    }`}
                  >
                    <ShieldCheck className={`w-3 h-3 ${c.ok ? "opacity-100" : "opacity-40"}`} />
                    {c.label}
                  </li>
                ))}
              </ul>
            </Surface>
          )}

          {renderField("confirm", "Confirm New Password", "Re-enter new password")}

          {values.confirm && values.confirm !== values.next && (
            <p className="text-xs text-destructive px-1 -mt-2">Passwords do not match</p>
          )}

          <NeonButton full variant="purple" className="mt-2" onClick={handleSubmit} disabled={loading || profileLoading}>
            <span className="inline-flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "UPDATING..." : isSetPasswordMode ? "SET PASSWORD" : "UPDATE PASSWORD"}
            </span>
          </NeonButton>
        </div>
    </PageShell>
  );
};

export default ChangePasswordScreen;
