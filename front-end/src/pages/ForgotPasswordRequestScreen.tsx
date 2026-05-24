import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Mail, Phone, User } from "lucide-react";
import NeonButton from "@/components/NeonButton";
import ButtonLoadingScreen from "@/components/ui/buttonLoadingScreen";
import { forgotPassword } from "@/api/auth";
import { toast } from "@/components/ui/sonner";
import { getErrorToast } from "@/lib/page-utils";
import { PageShell, StatusPill, Surface } from "@/components/design-system";

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const normalizePhoneNumber = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
};

const isValidPhoneNumber = (value: string) => /^[6-9]\d{9}$/.test(normalizePhoneNumber(value));

const isValidUsername = (value: string) => /^[a-zA-Z0-9_]{4,30}$/.test(value.trim());

const STORAGE_KEYS = {
  requestId: "pwreset.requestId",
  otpExpiresAt: "pwreset.otpExpiresAt",
  resendAvailableAt: "pwreset.resendAvailableAt",
  linkExpiresAt: "pwreset.linkExpiresAt",
  identifierHint: "pwreset.identifierHint",
} as const;

const safeSet = (key: string, value: string) => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // ignore
  }
};

const ForgotPasswordRequestScreen = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    // Email-link flow lands on /forgot-password/reset?token=...
    const token = searchParams.get("token");
    if (token) {
      navigate(`/forgot-password/reset?token=${encodeURIComponent(token)}`, { replace: true });
    }
  }, [navigate, searchParams]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || loading) return;

    const trimmed = identifier.trim();
    if (!trimmed) {
      toast.error("Username, phone number, or email is required.");
      return;
    }

    if (!isValidPhoneNumber(trimmed) && !isValidEmail(trimmed) && !isValidUsername(trimmed)) {
      toast.error("Enter a valid username, phone number, or email.");
      return;
    }

    try {
      submittingRef.current = true;
      setLoading(true);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await forgotPassword(trimmed, { signal: controller.signal });
      const data = res.data || {};

      if (data.requestId) safeSet(STORAGE_KEYS.requestId, String(data.requestId));
      if (data.otpExpiresAt) safeSet(STORAGE_KEYS.otpExpiresAt, String(data.otpExpiresAt));
      if (data.resendAvailableAt) safeSet(STORAGE_KEYS.resendAvailableAt, String(data.resendAvailableAt));
      if (data.linkExpiresAt) safeSet(STORAGE_KEYS.linkExpiresAt, String(data.linkExpiresAt));
      safeSet(STORAGE_KEYS.identifierHint, trimmed);

      toast.success("Check your email", {
        description: "We sent a reset code and a reset link (if the account exists).",
      });

      navigate("/forgot-password/verify", { replace: true });
    } catch (error) {
      const errorToast = getErrorToast(error, { action: "Forgot password", fallback: "Could not start password reset." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      if (mountedRef.current) setLoading(false);
      submittingRef.current = false;
      abortRef.current = null;
    }
  };

  return (
    <PageShell
      bottomNavPadding={false}
      contentClassName="flex min-h-[100dvh] max-w-md flex-col justify-center gap-4 py-8"
    >
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="arena-icon-button"
          aria-label="Back to login"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div>
          <StatusPill tone="primary">Account recovery</StatusPill>
          <h1 className="mt-3 font-display text-3xl font-black tracking-wide neon-text-purple">Reset Password</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Enter your username, email, or phone number. We will send a reset code and a reset link.
          </p>
        </div>

        <Surface neon>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="font-heading text-sm font-bold">Find Account</p>
            <p className="mt-1 text-xs text-muted-foreground">Use the same details you use for login.</p>
          </div>

          <div className="glass flex items-center gap-3 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4" aria-hidden="true" />
              <Phone className="h-4 w-4" aria-hidden="true" />
              <Mail className="h-4 w-4" aria-hidden="true" />
            </div>
            <input
              type="text"
              placeholder="Username, phone no. or email"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              disabled={loading}
              autoComplete="username"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          <NeonButton type="submit" full disabled={loading}>
            {loading ? <ButtonLoadingScreen label="Sending..." /> : "Continue"}
          </NeonButton>
        </form>
        </Surface>
    </PageShell>
  );
};

export default ForgotPasswordRequestScreen;

