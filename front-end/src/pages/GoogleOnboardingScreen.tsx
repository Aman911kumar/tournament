import type { ComponentType, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import heroBg from "@/assets/hero-bg.jpg";
import ButtonLoadingScreen from "@/components/ui/buttonLoadingScreen";
import { Checkbox } from "@/components/ui/checkbox";
import { getErrorToast } from "@/lib/page-utils";
import { toast } from "@/components/ui/sonner";
import { completeOnboarding, getMyProfile } from "@/api/profile";
import type { CompleteOnboardingPayload } from "@/api/profile";

const LEGAL_LINKS = {
  terms: "/legal/terms",
  privacy: "/legal/privacy",
  community: "/legal/community",
};

const normalizePhoneNumber = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits.length === 12 && digits.startsWith("91")
    ? digits.slice(2)
    : digits;
};

const isValidIndianPhoneNumber = (value: string) =>
  /^[6-9]\d{9}$/.test(normalizePhoneNumber(value));

const formatDateInput = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
};

const getAgeYears = (yyyyMmDd: string) => {
  const date = new Date(yyyyMmDd);
  if (Number.isNaN(date.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate()))
    age -= 1;
  return age;
};

const OnboardingInput = ({
  icon: Icon,
  label,
  error,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  error?: string;
  children: ReactNode;
}) => (
  <label className="group block space-y-1.5">
    <span className="flex items-center gap-1.5 font-heading text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
    <div
      className={`flex min-h-11 flex-wrap items-center gap-2 rounded-xl border bg-background/58 px-3 py-2 transition-colors sm:min-h-12 sm:flex-nowrap sm:gap-3 sm:px-3.5 sm:py-2.5 ${
        error ? "border-destructive/55" : "border-glass-border"
      } group-focus-within:border-primary/55 group-focus-within:bg-card/90`}
    >
      {children}
    </div>
    {error && <p className="text-[11px] text-destructive">{error}</p>}
  </label>
);

const modeTransition = { duration: 0.22, ease: "easeOut" as const };

const GoogleOnboardingScreen = () => {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [agreedAll, setAgreedAll] = useState(false);

  const [errors, setErrors] = useState<{
    phone?: string;
    dateOfBirth?: string;
    agreedAll?: string;
  }>({});
  const submitAbortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      submitAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await getMyProfile();
        const user = res.data.user;
        const completedAt = user.onboarding?.completedAt;
        const legalAccepted = Boolean(user.legalAgreements?.acceptedAt);
        const hasPhone = Boolean(String(user.phone_number || "").trim());
        const hasDob = Boolean(user.dateOfBirth);

        if (!user.socialProvider) {
          navigate("/", { replace: true });
          return;
        }

        if (completedAt && legalAccepted && hasPhone && hasDob) {
          navigate("/", { replace: true });
          return;
        }

        setPhone(String(user.phone_number || ""));
        setUsername(String(user.username || ""));
        setDateOfBirth(formatDateInput(user.dateOfBirth));
        setAgreedAll(Boolean(user.legalAgreements?.acceptedAt));
      } catch (error) {
        const errorToast = getErrorToast(error, {
          action: "Load onboarding",
          fallback: "Could not open onboarding.",
        });
        toast.error(errorToast.title, { description: errorToast.description });
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
  }, [navigate]);

  const ageBandLabel = useMemo(() => {
    if (!dateOfBirth) return "";
    const age = getAgeYears(dateOfBirth);
    if (!age) return "";
    if (age < 13) return "Not eligible (under 13)";
    if (age < 18) return "Teen account (13-17)";
    return "Adult account (18+)";
  }, [dateOfBirth]);

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const nextErrors: typeof errors = {};
    if (countryCode !== "+91")
      nextErrors.phone = "Only +91 is supported right now.";
    if (!phone.trim() || !isValidIndianPhoneNumber(phone))
      nextErrors.phone = "Enter a valid 10 digit Indian phone number.";
    if (!dateOfBirth) nextErrors.dateOfBirth = "Date of birth is required.";
    if (dateOfBirth && getAgeYears(dateOfBirth) < 13) {
      nextErrors.dateOfBirth =
        "Battle4Arena is for players aged 13+. Please check your date of birth.";
    }
    if (!agreedAll)
      nextErrors.agreedAll = "Please accept the policies to continue.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Complete the required details to continue.");
      return;
    }

    try {
      setSubmitting(true);
      submitAbortRef.current?.abort();
      const controller = new AbortController();
      submitAbortRef.current = controller;

      const payload: CompleteOnboardingPayload = {
        phone_number: normalizePhoneNumber(phone),
        username: username.trim() || undefined,
        dateOfBirth,
        agreements: {
          terms: agreedAll,
          privacy: agreedAll,
          community: agreedAll,
        },
        agreementsVersion: "2026-05-19",
      };

      const res = await completeOnboarding(payload, {
        signal: controller.signal,
      });
      toast.success(res.message || "Onboarding completed.");
      navigate("/", { replace: true });
    } catch (error) {
      const errorToast = getErrorToast(error, {
        action: "Complete onboarding",
        fallback: "Could not complete onboarding.",
      });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      if (mountedRef.current) setSubmitting(false);
      submitAbortRef.current = null;
    }
  };

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-background">
      <img
        src={heroBg}
        alt="Battle4Arena esports arena"
        className="absolute inset-0 h-full w-full object-cover"
        width={1280}
        height={1024}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.28),transparent_32rem),linear-gradient(90deg,hsl(var(--background)/0.98),hsl(var(--background)/0.86)_45%,hsl(var(--background)/0.54))]" />
      <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--foreground)/0.05)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--foreground)/0.035)_1px,transparent_1px)] bg-[size:44px_44px] opacity-35" />

      <main className="relative z-10 mx-auto grid min-h-[100dvh] w-full max-w-5xl items-center gap-4 px-3 py-4 sm:gap-6 sm:px-6 sm:py-8">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto w-full max-w-md"
        >
          <div className="mb-3 flex items-center gap-3 sm:mb-4">
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="arena-icon-button"
              aria-label="Back to login"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <p className="font-display text-xl font-black neon-text-purple min-[380px]:text-2xl">
                BATTLE4ARENA
              </p>
              <p className="text-xs text-muted-foreground">
                Finish your arena setup
              </p>
            </div>
          </div>

          <div className="max-h-[calc(100dvh-6.5rem)] overflow-hidden rounded-xl border border-glass-border bg-card/88 shadow-[0_18px_48px_hsl(0_0%_0%/0.28)] sm:max-h-none">
            <div className="border-b border-glass-border bg-background/35 p-4 sm:p-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-secondary/30 bg-secondary/10 px-3 py-1 font-heading text-[10px] font-bold uppercase tracking-wide text-secondary">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Google account setup
              </div>
              <h1 className="mt-3 font-heading text-xl font-bold min-[380px]:text-2xl">
                Complete your profile
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Add your phone number and date of birth so tournaments, wallet,
                and safety systems work correctly.
              </p>
            </div>

            <motion.div
              className="arena-scrollbar max-h-[calc(100dvh-16rem)] overflow-y-auto p-4 sm:max-h-none sm:overflow-visible sm:p-6"
              layout={!shouldReduceMotion}
              transition={shouldReduceMotion ? { duration: 0 } : modeTransition}
            >
              {loading ? (
                <GlassCard neon className="text-center">
                  <p className="font-heading text-sm font-bold">
                    Loading setup...
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Preparing your onboarding.
                  </p>
                </GlassCard>
              ) : (
                <form onSubmit={handleContinue} className="space-y-4">
                  <OnboardingInput
                    icon={Phone}
                    label="Phone number"
                    error={errors.phone}
                  >
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      disabled={submitting}
                      className="h-10 min-w-[7.5rem] rounded-lg border border-glass-border bg-background/45 px-2 text-sm font-heading text-foreground focus:outline-none"
                      aria-label="Country code"
                    >
                      <option value="+91">+91 (IN)</option>
                      <option value="+1">+1 (US) - Soon</option>
                      <option value="+44">+44 (UK) - Soon</option>
                    </select>
                    <input
                      type="tel"
                      inputMode="tel"
                      placeholder="10 digit phone number"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (
                          errors.phone &&
                          isValidIndianPhoneNumber(e.target.value) &&
                          countryCode === "+91"
                        ) {
                          setErrors((cur) => ({ ...cur, phone: undefined }));
                        }
                      }}
                      disabled={submitting}
                      className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                  </OnboardingInput>

                  <OnboardingInput icon={User} label="Username (optional)">
                    <input
                      type="text"
                      placeholder="ak_player"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={submitting}
                      className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                  </OnboardingInput>

                  <OnboardingInput
                    icon={Calendar}
                    label="Date of birth"
                    error={errors.dateOfBirth}
                  >
                    <input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => {
                        setDateOfBirth(e.target.value);
                        if (
                          errors.dateOfBirth &&
                          e.target.value &&
                          getAgeYears(e.target.value) >= 13
                        ) {
                          setErrors((cur) => ({
                            ...cur,
                            dateOfBirth: undefined,
                          }));
                        }
                      }}
                      disabled={submitting}
                      className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                    {ageBandLabel && (
                      <span className="shrink-0 rounded-full border border-glass-border bg-background/45 px-2 py-1 text-[10px] font-heading font-bold text-muted-foreground">
                        {ageBandLabel}
                      </span>
                    )}
                  </OnboardingInput>

                  <div className="space-y-1">
                    <div
                      className={`flex items-start gap-3 rounded-xl border bg-background/35 px-3 py-3 transition-colors sm:px-3.5 ${
                        errors.agreedAll
                          ? "border-destructive/55"
                          : "border-glass-border"
                      }`}
                    >
                      <Checkbox
                        id="onboarding-legal"
                        checked={agreedAll}
                        disabled={submitting}
                        onCheckedChange={(checked) => {
                          const value = checked === true;
                          setAgreedAll(value);
                          if (value)
                            setErrors((cur) => ({
                              ...cur,
                              agreedAll: undefined,
                            }));
                        }}
                        aria-invalid={Boolean(errors.agreedAll)}
                      />
                      <label
                        htmlFor="onboarding-legal"
                        className="min-w-0 text-xs leading-5 text-muted-foreground"
                      >
                        I agree to the{" "}
                        <Link
                          to={LEGAL_LINKS.terms}
                          className="arena-focus rounded-sm font-heading font-bold text-primary"
                        >
                          Terms & Conditions
                        </Link>
                        ,{" "}
                        <Link
                          to={LEGAL_LINKS.privacy}
                          className="arena-focus rounded-sm font-heading font-bold text-primary"
                        >
                          Privacy Policy
                        </Link>
                        , and{" "}
                        <Link
                          to={LEGAL_LINKS.community}
                          className="arena-focus rounded-sm font-heading font-bold text-primary"
                        >
                          Community Guidelines
                        </Link>
                        .
                      </label>
                    </div>
                    {errors.agreedAll && (
                      <p className="text-[11px] text-destructive">
                        {errors.agreedAll}
                      </p>
                    )}
                  </div>

                  <NeonButton
                    type="submit"
                    full
                    disabled={submitting || !agreedAll}
                    className="min-h-12"
                  >
                    {submitting ? (
                      <ButtonLoadingScreen label="Finishing..." />
                    ) : (
                      "CONTINUE"
                    )}
                  </NeonButton>

                  <div className="rounded-xl border border-glass-border bg-background/35 p-3 text-xs text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="mt-0.5 h-4 w-4 text-secondary" />
                      <div>
                        <p className="font-heading text-xs font-bold text-foreground">
                          Phone verification
                        </p>
                        <p className="mt-1">
                          We will add OTP verification here soon. For now, your
                          phone is saved and marked unverified until
                          verification is enabled.
                        </p>
                      </div>
                    </div>
                  </div>

                  <AnimatePresence initial={false}>
                    {dateOfBirth &&
                      getAgeYears(dateOfBirth) >= 13 &&
                      getAgeYears(dateOfBirth) < 18 && (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 6 }}
                          transition={{ duration: 0.18 }}
                          className="rounded-xl border border-secondary/30 bg-secondary/10 p-3"
                        >
                          <p className="flex items-start gap-2 text-xs text-muted-foreground">
                            <AlertCircle className="mt-0.5 h-4 w-4 text-secondary" />
                            <span>
                              Teen accounts (13-17) must follow strict safety
                              rules. Some features may have extra checks
                              depending on region and tournament type.
                            </span>
                          </p>
                        </motion.div>
                      )}
                  </AnimatePresence>
                </form>
              )}
            </motion.div>
          </div>

          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            Need help? Read the{" "}
            <Link
              to="/help"
              className="arena-focus rounded-sm font-heading font-bold text-primary"
            >
              Help Center
            </Link>
            .
          </p>
        </motion.section>
      </main>
    </div>
  );
};

export default GoogleOnboardingScreen;
