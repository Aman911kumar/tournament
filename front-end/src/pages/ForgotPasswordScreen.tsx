import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, KeyRound, Lock, Phone } from "lucide-react";
import NeonButton from "@/components/NeonButton";
import ButtonLoadingScreen from "@/components/ui/buttonLoadingScreen";
import { forgotPassword, resetPassword } from "@/api/auth";
import { toast } from "@/components/ui/sonner";
import { getErrorToast } from "@/lib/page-utils";

const PASSWORD_MIN_LENGTH = 6;

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const normalizePhoneNumber = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
};

const isValidPhoneNumber = (value: string) => /^[6-9]\d{9}$/.test(normalizePhoneNumber(value));

const isValidUsername = (value: string) => /^[a-zA-Z0-9_]{4,30}$/.test(value.trim());

const ForgotPasswordScreen = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loadingRequest, setLoadingRequest] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);
  const [tokenRequested, setTokenRequested] = useState(false);

  useEffect(() => {
    const urlToken = searchParams.get("token");
    if (urlToken) {
      setToken(urlToken);
      setTokenRequested(true);
    }
  }, [searchParams]);

  const handleRequestToken = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedIdentifier = identifier.trim();

    if (!trimmedIdentifier) {
      toast.error("Username, phone number, or email is required.");
      return;
    }

    if (!isValidPhoneNumber(trimmedIdentifier) && !isValidEmail(trimmedIdentifier) && !isValidUsername(trimmedIdentifier)) {
      toast.error("Enter a valid username, phone number, or email.");
      return;
    }

    try {
      setLoadingRequest(true);
      const response = await forgotPassword(trimmedIdentifier);
      const resetToken = response.data?.resetToken;
      if (resetToken) setToken(resetToken);
      setTokenRequested(true);
      toast.success("Reset email sent", {
        description: resetToken ? "Token filled below for local development." : response.message,
      });
    } catch (error) {
      const errorToast = getErrorToast(error, { action: "Forgot password", fallback: "Could not generate reset token." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setLoadingRequest(false);
    }
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedToken = token.trim();

    if (!trimmedToken) {
      toast.error("Reset token is required.");
      return;
    }

    if (newPassword.trim().length < PASSWORD_MIN_LENGTH) {
      toast.error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    try {
      setLoadingReset(true);
      const response = await resetPassword({ token: trimmedToken, newPassword });
      toast.success(response.message || "Password reset successfully.");
      navigate("/login");
    } catch (error) {
      const errorToast = getErrorToast(error, { action: "Reset password", fallback: "Could not reset password." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setLoadingReset(false);
    }
  };

  return (
    <div className="arena-shell min-h-screen px-5 py-8">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card"
          aria-label="Back to login"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div>
          <h1 className="font-display text-3xl font-bold tracking-wider neon-text-purple">Reset Password</h1>
      <p className="mt-2 text-sm text-muted-foreground">
            Enter your registered username, phone number, or email. We will send a reset link to your saved email.
          </p>
        </div>

        <form onSubmit={handleRequestToken} className="space-y-4 rounded-xl border border-border bg-card/70 p-4">
          <div>
            <p className="font-heading text-sm font-bold">Find Account</p>
            <p className="mt-1 text-xs text-muted-foreground">Use the same username, phone, or email you use for login.</p>
          </div>
          <div className="glass rounded-lg flex items-center gap-3 px-4 py-3">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Username, phone no. or email"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              disabled={loadingRequest}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <NeonButton type="submit" full disabled={loadingRequest}>
            {loadingRequest ? <ButtonLoadingScreen /> : tokenRequested ? "GENERATE AGAIN" : "GET RESET TOKEN"}
          </NeonButton>
        </form>

        <form onSubmit={handleResetPassword} className="space-y-4 rounded-xl border border-border bg-card/70 p-4">
          <div>
            <p className="font-heading text-sm font-bold">Set New Password</p>
            <p className="mt-1 text-xs text-muted-foreground">Open the email link or paste the reset token. Tokens expire after 10 minutes.</p>
          </div>
          <div className="glass rounded-lg flex items-center gap-3 px-4 py-3">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Reset token"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              disabled={loadingReset}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <div className="glass rounded-lg flex items-center gap-3 px-4 py-3">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="New password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              disabled={loadingReset}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <button type="button" onClick={() => setShowPassword((value) => !value)} disabled={loadingReset}>
              {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
            </button>
          </div>
          <div className="glass rounded-lg flex items-center gap-3 px-4 py-3">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              disabled={loadingReset}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <NeonButton type="submit" full disabled={loadingReset}>
            {loadingReset ? <ButtonLoadingScreen /> : "RESET PASSWORD"}
          </NeonButton>
        </form>
      </div>
    </div>
  );
};

export default ForgotPasswordScreen;
