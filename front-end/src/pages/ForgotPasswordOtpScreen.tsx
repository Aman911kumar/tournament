import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Clock3, RefreshCw, ShieldCheck } from "lucide-react";
import NeonButton from "@/components/NeonButton";
import ButtonLoadingScreen from "@/components/ui/buttonLoadingScreen";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { resendForgotPasswordOtp, verifyForgotPasswordOtp } from "@/api/auth";
import { toast } from "@/components/ui/sonner";
import { getErrorToast } from "@/lib/page-utils";
import { ApiError } from "@/api/client";

const STORAGE_KEYS = {
  requestId: "pwreset.requestId",
  otpExpiresAt: "pwreset.otpExpiresAt",
  resendAvailableAt: "pwreset.resendAvailableAt",
  identifierHint: "pwreset.identifierHint",
  resetGrant: "pwreset.resetGrant",
  grantExpiresAt: "pwreset.grantExpiresAt",
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

const formatCountdown = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

const ForgotPasswordOtpScreen = () => {
  const navigate = useNavigate();
  const [otp, setOtp] = useState("");
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [loadingResend, setLoadingResend] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const verifyInFlight = useRef(false);
  const resendInFlight = useRef(false);
  const abortVerifyRef = useRef<AbortController | null>(null);
  const abortResendRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const requestId = safeGet(STORAGE_KEYS.requestId);
  const identifierHint = safeGet(STORAGE_KEYS.identifierHint);

  const otpExpiresAtMs = useMemo(() => {
    const raw = safeGet(STORAGE_KEYS.otpExpiresAt);
    const parsed = raw ? new Date(raw).getTime() : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  }, []);

  const resendAvailableAtMs = useMemo(() => {
    const raw = safeGet(STORAGE_KEYS.resendAvailableAt);
    const parsed = raw ? new Date(raw).getTime() : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  }, []);

  const [otpExpiryMsState, setOtpExpiryMsState] = useState(otpExpiresAtMs);
  const [resendAtMsState, setResendAtMsState] = useState(resendAvailableAtMs);

  useEffect(() => {
    if (!requestId) {
      navigate("/forgot-password", { replace: true });
      return;
    }
    return () => {
      mountedRef.current = false;
      abortVerifyRef.current?.abort();
      abortResendRef.current?.abort();
    };
  }, [navigate, requestId]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const otpExpired = otpExpiryMsState > 0 && otpExpiryMsState <= nowMs;
  const resendLocked = resendAtMsState > 0 && resendAtMsState > nowMs;

  const handleVerify = async () => {
    if (verifyInFlight.current || loadingVerify) return;
    if (otp.trim().length !== 6) {
      toast.error("Enter the 6-digit reset code.");
      return;
    }
    if (otpExpired) {
      toast.error("Reset code expired.", { description: "Request a new code to continue." });
      return;
    }

    try {
      verifyInFlight.current = true;
      setLoadingVerify(true);
      abortVerifyRef.current?.abort();
      const controller = new AbortController();
      abortVerifyRef.current = controller;

      const res = await verifyForgotPasswordOtp({ requestId, otp }, { signal: controller.signal });
      safeSet(STORAGE_KEYS.resetGrant, String(res.data?.resetGrant || ""));
      if (res.data?.expiresAt) safeSet(STORAGE_KEYS.grantExpiresAt, String(res.data.expiresAt));

      toast.success("Verified");
      navigate("/forgot-password/reset", { replace: true });
    } catch (error) {
      const errorToast = getErrorToast(error, { action: "Verify code", fallback: "Could not verify reset code." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      if (mountedRef.current) setLoadingVerify(false);
      verifyInFlight.current = false;
      abortVerifyRef.current = null;
    }
  };

  const handleResend = async () => {
    if (resendInFlight.current || loadingResend) return;
    if (resendLocked) return;

    try {
      resendInFlight.current = true;
      setLoadingResend(true);
      abortResendRef.current?.abort();
      const controller = new AbortController();
      abortResendRef.current = controller;

      const res = await resendForgotPasswordOtp(requestId, { signal: controller.signal });
      const nextOtpExpiresAtMs = res.data?.otpExpiresAt ? new Date(res.data.otpExpiresAt).getTime() : 0;
      const nextResendAtMs = res.data?.resendAvailableAt ? new Date(res.data.resendAvailableAt).getTime() : 0;

      if (Number.isFinite(nextOtpExpiresAtMs) && nextOtpExpiresAtMs > 0) {
        setOtpExpiryMsState(nextOtpExpiresAtMs);
        safeSet(STORAGE_KEYS.otpExpiresAt, String(res.data.otpExpiresAt));
      }
      if (Number.isFinite(nextResendAtMs) && nextResendAtMs > 0) {
        setResendAtMsState(nextResendAtMs);
        safeSet(STORAGE_KEYS.resendAvailableAt, String(res.data.resendAvailableAt));
      }

      setOtp("");
      toast.success("New code sent", { description: "Check your email for the latest reset code." });
    } catch (error) {
      if (error instanceof ApiError && Array.isArray(error.errors)) {
        const resendAt = error.errors.find((detail) => detail?.field === "passwordReset.resendAvailableAt")?.message;
        const remainingSecondsRaw = error.errors.find((detail) => detail?.field === "passwordReset.cooldownRemainingSeconds")?.message;
        const nextAtMs = resendAt ? new Date(String(resendAt)).getTime() : 0;
        const remainingSeconds = Number(remainingSecondsRaw || 0);
        if (Number.isFinite(nextAtMs) && nextAtMs > Date.now()) {
          setResendAtMsState(nextAtMs);
          safeSet(STORAGE_KEYS.resendAvailableAt, new Date(nextAtMs).toISOString());
        } else if (Number.isFinite(remainingSeconds) && remainingSeconds > 0) {
          const computed = Date.now() + remainingSeconds * 1000;
          setResendAtMsState(computed);
          safeSet(STORAGE_KEYS.resendAvailableAt, new Date(computed).toISOString());
        }
      }

      const errorToast = getErrorToast(error, { action: "Resend code", fallback: "Could not resend the reset code." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      if (mountedRef.current) setLoadingResend(false);
      resendInFlight.current = false;
      abortResendRef.current = null;
    }
  };

  return (
    <div className="arena-shell min-h-screen px-5 py-8">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <button
          type="button"
          onClick={() => navigate("/forgot-password")}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div>
          <h1 className="font-display text-3xl font-bold tracking-wider neon-text-purple">Verify Code</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the 6-digit reset code we sent to your email.
          </p>
          {identifierHint ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Account: <span className="font-heading font-semibold text-foreground/90">{identifierHint}</span>
            </p>
          ) : null}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="space-y-4 rounded-xl border border-border bg-card/70 p-4"
        >
          <div className="flex items-center justify-between">
            <p className="font-heading text-sm font-bold">Reset Code</p>
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/40 px-2 py-1 text-[10px] font-heading font-bold text-muted-foreground">
              <Clock3 className="h-3 w-3" />
              {otpExpiryMsState > nowMs ? formatCountdown((otpExpiryMsState - nowMs) / 1000) : "Expired"}
            </span>
          </div>

          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={setOtp}
              autoFocus
              disabled={loadingVerify || loadingResend}
              onComplete={() => {
                // Slight delay to let input-otp settle caret state.
                window.setTimeout(() => void handleVerify(), 60);
              }}
              containerClassName="justify-center"
            >
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((idx) => (
                  <InputOTPSlot key={idx} index={idx} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <AnimatePresence initial={false}>
            {otpExpired ? (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-muted-foreground"
              >
                Your reset code expired. Resend a new code to continue.
              </motion.div>
            ) : null}
          </AnimatePresence>

          <NeonButton full disabled={loadingVerify || otp.trim().length !== 6} onClick={handleVerify}>
            {loadingVerify ? <ButtonLoadingScreen label="Verifying..." /> : (
              <span className="inline-flex items-center justify-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                VERIFY
              </span>
            )}
          </NeonButton>

          <NeonButton
            full
            variant="outline"
            disabled={loadingResend || resendLocked}
            onClick={handleResend}
          >
            {loadingResend ? (
              <ButtonLoadingScreen label="Resending..." />
            ) : resendLocked ? (
              `RESEND IN ${formatCountdown((resendAtMsState - nowMs) / 1000)}`
            ) : (
              <span className="inline-flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4" />
                RESEND CODE
              </span>
            )}
          </NeonButton>
        </motion.div>
      </div>
    </div>
  );
};

export default ForgotPasswordOtpScreen;

