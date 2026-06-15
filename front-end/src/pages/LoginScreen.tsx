import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BellRing,
  Crown,
  Eye,
  EyeOff,
  Gamepad2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  Trophy,
  User,
  WalletCards,
} from "lucide-react";
import NeonButton from "@/components/NeonButton";
import heroBg from "@/assets/hero-bg.jpg";
import { login, signup, AuthResponse, ENDPOINTS } from "@/api/auth";
import { toast } from "@/components/ui/sonner";
import { setAuthTokens } from "@/lib/auth-storage";
import ButtonLoadingScreen from "@/components/ui/buttonLoadingScreen";
import { getErrorToast } from "@/lib/page-utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { resolveAbsoluteApiUrl } from "@/lib/oauth";
import appConfig from "@/config/project.config";

const PASSWORD_MIN_LENGTH = 6;
const DEEPLINK_SCHEME = appConfig.auth.deepLinkScheme;

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const normalizePhoneNumber = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits.length === 12 && digits.startsWith("91")
    ? digits.slice(2)
    : digits;
};

const isValidPhoneNumber = (value: string) =>
  /^[6-9]\d{9}$/.test(normalizePhoneNumber(value));

const isValidUsername = (value: string) =>
  /^[a-zA-Z0-9_]{4,30}$/.test(value.trim());

const arenaStats = [
  { label: "Daily matches", value: "Live", icon: Trophy },
  { label: "Wallet", value: "Secure", icon: WalletCards },
  { label: "Room alerts", value: "Instant", icon: BellRing },
];

const LEGAL_LINKS = {
  terms: "/legal/terms",
  privacy: "/legal/privacy",
  community: "/legal/community",
};

const modeTransition = { duration: 0.22, ease: "easeOut" as const };

const modeVariants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction * 18,
    filter: "blur(4px)",
  }),
  center: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -18,
    filter: "blur(4px)",
  }),
};

const AuthInput = ({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Mail;
  label: string;
  children: ReactNode;
}) => (
  <label className="group block space-y-1.5">
    <span className="flex items-center gap-1.5 font-heading text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
    <div className="flex min-h-11 items-center gap-2 rounded-xl border border-glass-border bg-background/58 px-3 py-2 transition-colors group-focus-within:border-primary/55 group-focus-within:bg-card/90 sm:min-h-12 sm:gap-3 sm:px-3.5 sm:py-2.5">
      {children}
    </div>
  </label>
);

// Redirect-based auth is used for both Google and Facebook (Web + APK/WebView compatible).

const LoginScreen = () => {
  const [isSignup, setIsSignup] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [username, setUsername] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<
    "google" | "facebook" | null
  >(null);
  const [agreedPolicies, setAgreedPolicies] = useState(false);
  const [agreementError, setAgreementError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"username" | "email" | "identifier" | "password", string>>
  >({});
  const shouldReduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const submittingRef = useRef(false);
  const submitAbortRef = useRef<AbortController | null>(null);
  const agreementRef = useRef<HTMLButtonElement | null>(null);
  const socialSubmittingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    // Clear agreement state when leaving signup mode.
    if (!isSignup) {
      setAgreedPolicies(false);
      setAgreementError("");
    }
    setFieldErrors({});
  }, [isSignup]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      submitAbortRef.current?.abort();
    };
  }, []);

  const completeLogin = (res: AuthResponse) => {
    setAuthTokens({
      accessToken: res.data.accessToken,
      refreshToken: res?.data.refreshToken,
    });
    const user = res.data.user;
    const phoneNumber = String(user?.phone_number || "").trim();
    const isSocialUser = Boolean(user?.socialProvider);
    const needsOnboarding =
      isSocialUser &&
      (!user?.onboarding?.completedAt ||
        !user?.legalAgreements?.acceptedAt ||
        !phoneNumber ||
        /^(google|facebook):/i.test(phoneNumber) ||
        !user?.dateOfBirth);
    const needsPasswordSetup =
      isSocialUser && !needsOnboarding && user?.passwordLoginEnabled !== true;
    toast.success(res.message);
    navigate(
      needsOnboarding
        ? "/onboarding"
        : needsPasswordSetup
          ? "/change-password"
          : "/",
    );
  };

  const startRedirectSocialLogin = async (provider: "google" | "facebook") => {
    if (socialSubmittingRef.current || loading || Boolean(socialLoading))
      return;
    socialSubmittingRef.current = true;
    setSocialLoading(provider);

    try {
      const isNative = Capacitor.isNativePlatform();
      const returnTo = isNative
        ? `${DEEPLINK_SCHEME}://oauth/callback`
        : `${window.location.origin}/oauth/callback`;

      const startPath = `${ENDPOINTS.oauthStart(provider)}?returnTo=${encodeURIComponent(returnTo)}`;
      const startUrl = resolveAbsoluteApiUrl(startPath);

      if (isNative) {
        await Browser.open({ url: startUrl });
        // OAuthCallbackScreen will finish the login when the app is reopened via deep link.
      } else {
        window.location.href = startUrl;
      }
    } catch (err) {
      const errorToast = getErrorToast(err, {
        action: `${provider} login`,
        fallback: `${provider} login failed.`,
      });
      toast.error(errorToast.title, { description: errorToast.description });
      if (mountedRef.current) setSocialLoading(null);
      socialSubmittingRef.current = false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || loading) return;

    const identifierValue = identifier.trim();
    const normalizedPhone = normalizePhoneNumber(identifierValue);
    const loginIdentifier = isValidEmail(identifierValue)
      ? identifierValue.toLowerCase()
      : isValidPhoneNumber(identifierValue)
        ? normalizedPhone
        : identifierValue;
    const normalizedEmail = email.trim().toLowerCase();

    const nextErrors: Partial<
      Record<"username" | "email" | "identifier" | "password", string>
    > = {};

    if (!identifierValue) {
      nextErrors.identifier = isSignup
        ? "Phone number is required."
        : "Username, phone, or email is required.";
    }
    if (!password) {
      nextErrors.password = "Password is required.";
    }
    if (isSignup && !username.trim()) {
      nextErrors.username = "Username is required.";
    }
    if (isSignup && !normalizedEmail) {
      nextErrors.email = "Email is required.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      toast.error("Phone/email and password are required.");
      return;
    }

    if (
      !isValidPhoneNumber(identifierValue) &&
      !isValidEmail(identifierValue) &&
      !isValidUsername(identifierValue)
    ) {
      setFieldErrors((current) => ({
        ...current,
        identifier: "Enter a valid username, phone number, or email.",
      }));
      toast.error("Enter a valid username, phone number, or email.");
      return;
    }

    if (password.trim().length < PASSWORD_MIN_LENGTH) {
      setFieldErrors((current) => ({
        ...current,
        password: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
      }));
      toast.error(
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
      );
      return;
    }

    if (isSignup && !isValidUsername(username)) {
      setFieldErrors((current) => ({
        ...current,
        username: "Username must be 4-30 letters, numbers, or underscores.",
      }));
      toast.error("Username must be 4-30 letters, numbers, or underscores.");
      return;
    }

    if (isSignup && !isValidEmail(normalizedEmail)) {
      setFieldErrors((current) => ({
        ...current,
        email: "Enter a valid email address.",
      }));
      toast.error("Enter a valid email address.");
      return;
    }

    if (isSignup && !isValidPhoneNumber(identifierValue)) {
      setFieldErrors((current) => ({
        ...current,
        identifier: "Enter a valid 10 digit phone number.",
      }));
      toast.error("Enter a valid 10 digit phone number.");
      return;
    }

    try {
      if (isSignup && !agreedPolicies) {
        const message =
          "Please agree to the Terms & Conditions and Privacy Policy to continue.";
        setAgreementError(message);
        toast.error(message);
        requestAnimationFrame(() => agreementRef.current?.focus());
        return;
      }

      setAgreementError("");
      setFieldErrors({});
      submittingRef.current = true;
      if (mountedRef.current) setLoading(true);
      submitAbortRef.current?.abort();
      const controller = new AbortController();
      submitAbortRef.current = controller;
      const res = isSignup
        ? await signup(
            {
              email: normalizedEmail,
              password,
              username: username.trim(),
              phone_number: normalizedPhone,
            },
            { signal: controller.signal },
          )
        : await login(
            { identifier: loginIdentifier, password },
            { signal: controller.signal },
          );
      completeLogin(res);
    } catch (err) {
      const errorToast = getErrorToast(err, {
        action: isSignup ? "Signup" : "Login",
        fallback: "Authentication failed.",
      });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      if (mountedRef.current) setLoading(false);
      submittingRef.current = false;
      submitAbortRef.current = null;
    }
  };

  return (
    <div className="b4a-responsive-root relative min-h-[100dvh] overflow-hidden bg-background">
      <img
        src={heroBg}
        alt="Battle4Arena esports arena"
        className="absolute inset-0 h-full w-full object-cover"
        width={1280}
        height={1024}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--primary)/0.08),transparent_22rem)]" />
      <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--foreground)/0.035)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--foreground)/0.026)_1px,transparent_1px)] bg-[size:32px_32px] opacity-55" />

      <main className="relative z-10 mx-auto grid min-h-[100dvh] w-full max-w-7xl items-center gap-4 px-3 py-4 sm:gap-6 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1fr)_minmax(420px,440px)] lg:gap-8 lg:px-8">
        <section className="hidden h-[min(760px,calc(100dvh-3rem))] min-h-0 flex-col justify-between rounded-lg border border-glass-border bg-card/45 p-6 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.045)] lg:flex">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 font-heading text-xs font-bold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Premium esports arena
            </div>
            <h1 className="mt-6 max-w-2xl font-display text-6xl font-black leading-[0.94] neon-text-purple">
              BATTLE4ARENA
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground">
              Join tournaments, follow creators, manage wallet transfers, and
              get room alerts from one clean competitive hub.
            </p>
          </div>

          <div className="grid gap-3">
            <div className="grid grid-cols-3 gap-3">
              {arenaStats.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="rounded-lg border border-glass-border bg-background/50 p-4"
                  >
                    <Icon className="h-5 w-5 text-primary" />
                    <p className="mt-4 font-heading text-xl font-bold">
                      {item.value}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto w-full max-w-md"
        >
          <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
            <div>
              <p className="font-display text-xl font-black neon-text-purple min-[380px]:text-2xl">
                BATTLE4ARENA
              </p>
              <p className="text-xs text-muted-foreground">
                Competitive tournament hub
              </p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary min-[380px]:h-11 min-[380px]:w-11">
              <Gamepad2 className="h-5 w-5" />
            </div>
          </div>

          <div className="flex max-h-[calc(100dvh-7rem)] min-h-0 flex-col overflow-hidden rounded-md border border-glass-border bg-card/95 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)] sm:max-h-none sm:min-h-[704px] lg:h-[min(760px,calc(100dvh-3rem))] lg:min-h-0">
            <div className="border-b border-glass-border bg-background/35 p-1.5 sm:p-2">
              <div className="grid grid-cols-2 gap-1 rounded-xl border border-glass-border bg-background/45 p-1">
                {[
                  { label: "Login", value: false, icon: ShieldCheck },
                  { label: "Sign Up", value: true, icon: Crown },
                ].map((item) => {
                  const Icon = item.icon;
                  const active = isSignup === item.value;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setIsSignup(item.value)}
                      disabled={loading}
                      className={`arena-focus relative inline-flex min-h-11 items-center justify-center gap-2 overflow-hidden rounded-lg font-heading text-xs font-bold transition-colors sm:min-h-10 ${
                        active
                          ? "text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted/65 hover:text-foreground"
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="auth-mode-pill"
                          className="absolute inset-0 rounded-lg bg-primary"
                          transition={
                            shouldReduceMotion
                              ? { duration: 0 }
                              : modeTransition
                          }
                        />
                      )}
                      <span className="relative z-10 inline-flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5" />
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <motion.div
              className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-6"
              layout={!shouldReduceMotion}
              transition={shouldReduceMotion ? { duration: 0 } : modeTransition}
            >
              <AnimatePresence
                mode="wait"
                initial={false}
                custom={isSignup ? 1 : -1}
              >
                <motion.div
                  key={isSignup ? "signup" : "login"}
                  custom={isSignup ? 1 : -1}
                  variants={shouldReduceMotion ? undefined : modeVariants}
                  initial={shouldReduceMotion ? { opacity: 0 } : "enter"}
                  animate={shouldReduceMotion ? { opacity: 1 } : "center"}
                  exit={shouldReduceMotion ? { opacity: 0 } : "exit"}
                  transition={
                    shouldReduceMotion ? { duration: 0.01 } : modeTransition
                  }
                  className="arena-scrollbar flex h-full min-h-0 flex-col overflow-y-auto pr-1"
                >
                  <div className="mb-4 sm:mb-6">
                    <h2 className="font-heading text-xl font-bold min-[380px]:text-2xl">
                      {isSignup
                        ? "Create your arena profile"
                        : "Enter your battle room"}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {isSignup
                        ? "Create your account, then join your first tournament."
                        : "Use your username, phone number, or email to continue."}
                    </p>
                  </div>

                  <form
                    onSubmit={handleSubmit}
                    className="space-y-3.5 sm:space-y-4"
                  >
                    {isSignup && (
                      <>
                        <AuthInput icon={User} label="Username">
                          <input
                            type="text"
                            placeholder="ak_player"
                            value={username}
                            onChange={(e) => {
                              const value = e.target.value;
                              setUsername(value);
                              if (
                                fieldErrors.username &&
                                isValidUsername(value)
                              ) {
                                setFieldErrors((current) => ({
                                  ...current,
                                  username: undefined,
                                }));
                              }
                            }}
                            disabled={loading}
                            aria-invalid={Boolean(fieldErrors.username)}
                            aria-describedby={
                              fieldErrors.username
                                ? "auth-username-error"
                                : undefined
                            }
                            className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                          />
                        </AuthInput>
                        {fieldErrors.username && (
                          <p
                            id="auth-username-error"
                            className="text-[11px] text-destructive"
                          >
                            {fieldErrors.username}
                          </p>
                        )}
                        <AuthInput icon={Mail} label="Email address">
                          <input
                            type="email"
                            placeholder="example@email.com"
                            value={email}
                            onChange={(e) => {
                              const value = e.target.value;
                              setEmail(value);
                              if (
                                fieldErrors.email &&
                                isValidEmail(value.trim().toLowerCase())
                              ) {
                                setFieldErrors((current) => ({
                                  ...current,
                                  email: undefined,
                                }));
                              }
                            }}
                            disabled={loading}
                            aria-invalid={Boolean(fieldErrors.email)}
                            aria-describedby={
                              fieldErrors.email ? "auth-email-error" : undefined
                            }
                            className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                          />
                        </AuthInput>
                        {fieldErrors.email && (
                          <p
                            id="auth-email-error"
                            className="text-[11px] text-destructive"
                          >
                            {fieldErrors.email}
                          </p>
                        )}
                      </>
                    )}

                    <AuthInput
                      icon={
                        !isSignup && isValidEmail(identifier) ? Mail : Phone
                      }
                      label={isSignup ? "Phone number" : "Login ID"}
                    >
                      <input
                        type={isSignup ? "tel" : "text"}
                        inputMode={isSignup ? "tel" : "text"}
                        placeholder={
                          isSignup
                            ? "10 digit phone number"
                            : "Username, phone, or email"
                        }
                        value={identifier}
                        onChange={(e) => {
                          const value = e.target.value;
                          setIdentifier(value);
                          const ok = isSignup
                            ? isValidPhoneNumber(value)
                            : isValidEmail(value) ||
                              isValidPhoneNumber(value) ||
                              isValidUsername(value);
                          if (fieldErrors.identifier && ok) {
                            setFieldErrors((current) => ({
                              ...current,
                              identifier: undefined,
                            }));
                          }
                        }}
                        disabled={loading}
                        aria-invalid={Boolean(fieldErrors.identifier)}
                        aria-describedby={
                          fieldErrors.identifier
                            ? "auth-identifier-error"
                            : undefined
                        }
                        className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                      />
                    </AuthInput>
                    {fieldErrors.identifier && (
                      <p
                        id="auth-identifier-error"
                        className="text-[11px] text-destructive"
                      >
                        {fieldErrors.identifier}
                      </p>
                    )}

                    <AuthInput icon={Lock} label="Password">
                      <input
                        type={showPass ? "text" : "password"}
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => {
                          const value = e.target.value;
                          setPassword(value);
                          if (
                            fieldErrors.password &&
                            value.trim().length >= PASSWORD_MIN_LENGTH
                          ) {
                            setFieldErrors((current) => ({
                              ...current,
                              password: undefined,
                            }));
                          }
                        }}
                        disabled={loading}
                        aria-invalid={Boolean(fieldErrors.password)}
                        aria-describedby={
                          fieldErrors.password
                            ? "auth-password-error"
                            : undefined
                        }
                        className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        disabled={loading}
                        className="arena-focus grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                        aria-label={
                          showPass ? "Hide password" : "Show password"
                        }
                      >
                        {showPass ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </AuthInput>
                    {fieldErrors.password && (
                      <p
                        id="auth-password-error"
                        className="text-[11px] text-destructive"
                      >
                        {fieldErrors.password}
                      </p>
                    )}

                    {isSignup && (
                      <div className="space-y-1">
                        <div
                          className={`flex items-start gap-3 rounded-xl border bg-background/35 px-3 py-3 transition-colors sm:px-3.5 ${
                            agreementError
                              ? "border-destructive/55"
                              : "border-glass-border"
                          }`}
                        >
                          <Checkbox
                            ref={agreementRef}
                            id="signup-agree"
                            checked={agreedPolicies}
                            disabled={loading}
                            onCheckedChange={(checked) => {
                              const value = checked === true;
                              setAgreedPolicies(value);
                              if (value) setAgreementError("");
                            }}
                            aria-invalid={Boolean(agreementError)}
                          />
                          <label
                            htmlFor="signup-agree"
                            className="min-w-0 text-xs leading-5 text-muted-foreground"
                          >
                            I agree to the{" "}
                            <Link
                              to={LEGAL_LINKS.terms}
                              className="arena-focus rounded-sm font-heading font-bold text-primary"
                            >
                              Terms & Conditions
                            </Link>{" "}
                            and{" "}
                            <Link
                              to={LEGAL_LINKS.privacy}
                              className="arena-focus rounded-sm font-heading font-bold text-primary"
                            >
                              Privacy Policy
                            </Link>
                            . I will follow the{" "}
                            <Link
                              to={LEGAL_LINKS.community}
                              className="arena-focus rounded-sm font-heading font-bold text-primary"
                            >
                              Community Guidelines
                            </Link>
                            .
                          </label>
                        </div>
                        {agreementError && (
                          <p className="text-[11px] text-destructive">
                            {agreementError}
                          </p>
                        )}
                      </div>
                    )}

                    {!isSignup && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => navigate("/forgot-password")}
                          className="arena-focus rounded-md font-heading text-xs font-semibold text-primary"
                        >
                          Forgot password?
                        </button>
                      </div>
                    )}

                    <NeonButton
                      type="submit"
                      full
                      disabled={loading || (isSignup && !agreedPolicies)}
                      className="min-h-12"
                    >
                      {loading ? (
                        <ButtonLoadingScreen
                          label={isSignup ? "Creating..." : "Logging in..."}
                        />
                      ) : (
                        <>
                          {isSignup ? "Create Account" : "Login"}
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </NeonButton>
                  </form>

                  <div className={isSignup ? "" : "mt-auto pt-5 sm:pt-6"}>
                    <div className="my-5 flex items-center gap-3 sm:my-6 sm:gap-4">
                      <div className="h-px flex-1 bg-glass-border" />
                      <span className="font-heading text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        Or continue with
                      </span>
                      <div className="h-px flex-1 bg-glass-border" />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => void startRedirectSocialLogin("google")}
                        disabled={loading || Boolean(socialLoading)}
                        type="button"
                        className="arena-focus flex min-h-11 items-center justify-center gap-2 rounded-xl border border-glass-border bg-background/55 px-3 text-sm font-heading font-semibold text-foreground transition-colors hover:border-primary/45 hover:bg-primary/10 disabled:opacity-50"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24">
                          <path
                            fill="currentColor"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                          />
                          <path
                            fill="currentColor"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="currentColor"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          />
                          <path
                            fill="currentColor"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
                        {socialLoading === "google" ? (
                          <ButtonLoadingScreen />
                        ) : (
                          "Google"
                        )}
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() =>
                          void startRedirectSocialLogin("facebook")
                        }
                        disabled={loading || Boolean(socialLoading)}
                        type="button"
                        className="arena-focus flex min-h-11 items-center justify-center gap-2 rounded-xl border border-glass-border bg-background/55 px-3 text-sm font-heading font-semibold text-foreground transition-colors hover:border-secondary/45 hover:bg-secondary/10 disabled:opacity-50"
                      >
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                        </svg>
                        {socialLoading === "facebook" ? (
                          <ButtonLoadingScreen />
                        ) : (
                          "Facebook"
                        )}
                      </motion.button>
                    </div>

                    <p className="mt-6 text-center font-heading text-xs text-muted-foreground">
                      {isSignup
                        ? "Already have an account? "
                        : "New to Battle4Arena? "}
                      <button
                        type="button"
                        onClick={() => setIsSignup(!isSignup)}
                        disabled={loading}
                        className="arena-focus rounded-md font-bold text-primary"
                      >
                        {isSignup ? "Login" : "Create account"}
                      </button>
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </div>
        </motion.section>
      </main>
    </div>
  );
};

export default LoginScreen;
