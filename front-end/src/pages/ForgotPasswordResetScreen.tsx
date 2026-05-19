import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, Lock } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import { toast } from "@/components/ui/sonner";
import { completeForgotPasswordReset, prepareForgotPasswordResetFromLink } from "@/api/auth";
import { getErrorToast } from "@/lib/page-utils";

type FieldKey = "next" | "confirm";

const STORAGE_KEYS = {
  resetGrant: "pwreset.resetGrant",
  grantExpiresAt: "pwreset.grantExpiresAt",
  requestId: "pwreset.requestId",
  otpExpiresAt: "pwreset.otpExpiresAt",
  resendAvailableAt: "pwreset.resendAvailableAt",
  identifierHint: "pwreset.identifierHint",
} as const;

const safeGet = (key: string) => {
  try {
    return sessionStorage.getItem(key) || "";
  } catch {
    return "";
  }
};

const safeSet = (key: string, value: string) => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // ignore
  }
};

const safeClearFlow = () => {
  try {
    Object.values(STORAGE_KEYS).forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // ignore
  }
};

const ForgotPasswordResetScreen = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [values, setValues] = useState({ next: "", confirm: "" });
  const [show, setShow] = useState<Record<FieldKey, boolean>>({ next: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(true);
  const preparingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const resetGrant = safeGet(STORAGE_KEYS.resetGrant);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const token = searchParams.get("token");

    (async () => {
      if (preparingRef.current) return;
      preparingRef.current = true;
      setPreparing(true);
      try {
        if (token) {
          abortRef.current?.abort();
          const controller = new AbortController();
          abortRef.current = controller;
          const res = await prepareForgotPasswordResetFromLink(token, { signal: controller.signal });
          safeSet(STORAGE_KEYS.resetGrant, String(res.data?.resetGrant || ""));
          if (res.data?.expiresAt) safeSet(STORAGE_KEYS.grantExpiresAt, String(res.data.expiresAt));
          navigate("/forgot-password/reset", { replace: true });
        } else if (!resetGrant) {
          navigate("/forgot-password", { replace: true });
          return;
        }
      } catch (error) {
        const errorToast = getErrorToast(error, { action: "Reset link", fallback: "Reset link is invalid or expired." });
        toast.error(errorToast.title, { description: errorToast.description });
        navigate("/forgot-password/expired", { replace: true });
        return;
      } finally {
        if (mountedRef.current) setPreparing(false);
        preparingRef.current = false;
        abortRef.current = null;
      }
    })();
  }, [navigate, resetGrant, searchParams]);

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

  const handleSubmit = async () => {
    const grant = safeGet(STORAGE_KEYS.resetGrant);
    if (!grant) {
      toast.error("Reset session expired. Start again.");
      navigate("/forgot-password");
      return;
    }

    if (!values.next || !values.confirm) {
      toast.error("Fill in both password fields.");
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
      const res = await completeForgotPasswordReset({ resetGrant: grant, newPassword: values.next });
      toast.success(res.message || "Password reset successfully.");
      safeClearFlow();
      navigate("/login");
    } catch (err) {
      const errorToast = getErrorToast(err, { action: "Reset password", fallback: "Failed to reset password." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setLoading(false);
    }
  };

  const renderField = (key: FieldKey, label: string, placeholder: string) => (
    <GlassCard neon>
      <label className="mb-1 block font-heading text-xs text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          type={show[key] ? "text" : "password"}
          value={values[key]}
          onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
          placeholder={placeholder}
          disabled={loading || preparing}
          className="w-full rounded-lg border border-glass-border bg-transparent px-3 py-2.5 text-sm font-heading transition-colors focus:border-primary focus:outline-none"
        />
        <motion.button
          whileTap={{ scale: 0.9 }}
          type="button"
          onClick={() => setShow((s) => ({ ...s, [key]: !s[key] }))}
          disabled={loading || preparing}
          className="arena-focus rounded-md p-2 text-muted-foreground"
          aria-label={show[key] ? "Hide password" : "Show password"}
        >
          {show[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </motion.button>
      </div>
    </GlassCard>
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.22),transparent_34rem),radial-gradient(circle_at_bottom_right,hsl(var(--accent)/0.16),transparent_32rem)]" />
      <div className="pointer-events-none absolute -top-32 -left-24 h-64 w-64 rounded-full bg-primary/10 blur-xl" />
      <div className="pointer-events-none absolute top-40 -right-24 h-56 w-56 rounded-full bg-accent/10 blur-xl" />

      <div className="relative z-10 mx-auto w-full max-w-2xl px-4 pb-4 pt-6 sm:px-5">
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate("/login")} className="arena-focus rounded-md p-2">
            <ArrowLeft className="h-5 w-5" />
          </motion.button>
          <h1 className="font-heading text-xl font-bold">Reset Password</h1>
        </div>

        <motion.div
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: 14 }}
          className="mt-6 flex justify-center"
        >
          <div className="neon-border relative flex h-24 w-24 items-center justify-center rounded-lg gradient-primary">
            <KeyRound className="h-10 w-10 text-primary-foreground" />
            <motion.div
              animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.2, 0.6] }}
              transition={{ duration: 2.4, repeat: Infinity }}
              className="absolute inset-0 rounded-lg border border-primary/40"
            />
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="mx-auto mb-6 mt-4 max-w-xs text-center text-sm text-muted-foreground"
        >
          Choose a strong password you don’t reuse anywhere else.
        </motion.p>

        <AnimatePresence initial={false}>
          {preparing ? (
            <motion.div
              key="preparing"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
            >
              <GlassCard neon className="text-center">
                <p className="font-heading text-sm font-bold">Preparing reset...</p>
                <p className="mt-1 text-xs text-muted-foreground">Validating your reset session.</p>
              </GlassCard>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="space-y-4"
            >
              {renderField("next", "New Password", "Enter new password")}

              {values.next && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="px-1">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-heading text-[11px] uppercase tracking-wider text-muted-foreground">Strength</span>
                    <span className="text-xs font-heading font-semibold">{strengthMeta.label}</span>
                  </div>
                  <div className="mb-3 grid grid-cols-4 gap-1.5">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          i < strength ? `${strengthMeta.color} ${strengthMeta.glow}` : "bg-glass-border"
                        }`}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {renderField("confirm", "Confirm New Password", "Re-enter new password")}

              {values.confirm && values.confirm !== values.next ? (
                <p className="px-1 -mt-2 text-xs text-destructive">Passwords do not match</p>
              ) : null}

              <NeonButton full variant="purple" className="mt-2" onClick={handleSubmit} disabled={loading}>
                <span className="inline-flex items-center justify-center gap-2">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? "UPDATING..." : "UPDATE PASSWORD"}
                </span>
              </NeonButton>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ForgotPasswordResetScreen;
