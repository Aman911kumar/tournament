import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Lock, Eye, EyeOff, ShieldCheck, KeyRound, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import { toast } from "@/components/ui/sonner";
import { changePassword } from "@/api/auth";
import { getErrorToast } from "@/lib/page-utils";

type FieldKey = "current" | "next" | "confirm";

const ChangePasswordScreen = () => {
  const navigate = useNavigate();
  const [values, setValues] = useState({ current: "", next: "", confirm: "" });
  const [show, setShow] = useState<Record<FieldKey, boolean>>({ current: false, next: false, confirm: false });
  const [loading, setLoading] = useState(false);

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
    if (!values.current || !values.next || !values.confirm) {
      toast.error("Fill in all password fields.");
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
      const res = await changePassword({ currentPassword: values.current, newPassword: values.next });
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
    <GlassCard neon>
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
        <motion.button
          whileTap={{ scale: 0.9 }}
          type="button"
          onClick={() => setShow((s) => ({ ...s, [key]: !s[key] }))}
          disabled={loading}
          className="p-2 text-muted-foreground hover:text-primary transition-colors"
          aria-label={show[key] ? "Hide password" : "Show password"}
        >
          {show[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </motion.button>
      </div>
    </GlassCard>
  );

  return (
    <div className="min-h-screen bg-background pb-20 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-32 -left-24 w-80 h-80 bg-primary/15 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute top-40 -right-24 w-72 h-72 bg-accent/15 rounded-full blur-3xl" />

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 pt-6 pb-4 flex items-center gap-3 relative z-10">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate("/profile")}>
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <h1 className="font-heading text-xl font-bold">Change Password</h1>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 relative z-10">
        {/* Hero icon */}
        <motion.div
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: 14 }}
          className="flex justify-center mb-4"
        >
          <div className="relative w-24 h-24 rounded-2xl gradient-primary flex items-center justify-center neon-glow-purple">
            <KeyRound className="w-10 h-10 text-primary-foreground" />
            <motion.div
              animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.2, 0.6] }}
              transition={{ duration: 2.4, repeat: Infinity }}
              className="absolute inset-0 rounded-2xl border border-primary/40"
            />
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-center text-sm text-muted-foreground mb-6 max-w-xs mx-auto"
        >
          Keep your account secure. Use a fresh password you don't reuse anywhere else.
        </motion.p>

        <div className="space-y-4">
          {renderField("current", "Current Password", "Enter current password")}
          {renderField("next", "New Password", "Enter new password")}

          {/* Strength meter */}
          {values.next && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-1"
            >
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
            </motion.div>
          )}

          {renderField("confirm", "Confirm New Password", "Re-enter new password")}

          {values.confirm && values.confirm !== values.next && (
            <p className="text-xs text-destructive px-1 -mt-2">Passwords do not match</p>
          )}

          <NeonButton full variant="purple" className="mt-2" onClick={handleSubmit} disabled={loading}>
            <span className="inline-flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "UPDATING..." : "UPDATE PASSWORD"}
            </span>
          </NeonButton>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordScreen;
