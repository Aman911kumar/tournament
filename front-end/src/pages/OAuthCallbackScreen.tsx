import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ButtonLoadingScreen from "@/components/ui/buttonLoadingScreen";
import { toast } from "@/components/ui/sonner";
import { getErrorToast } from "@/lib/page-utils";
import { oauthComplete } from "@/api/auth";
import { setAuthTokens } from "@/lib/auth-storage";
import { PageShell, StatusPill, Surface } from "@/components/design-system";

const parseCode = (search: string) => {
  const params = new URLSearchParams(search);
  return String(params.get("code") || "").trim();
};

const parseError = (search: string) => {
  const params = new URLSearchParams(search);
  const error = String(params.get("error") || "").trim();
  const description = String(params.get("error_description") || "").trim();
  return { error, description };
};

export default function OAuthCallbackScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const ranRef = useRef(false);

  const code = useMemo(() => parseCode(location.search), [location.search]);
  const { error, description } = useMemo(() => parseError(location.search), [location.search]);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      try {
        if (error) {
          toast.error("Login failed", { description: description || "Please try again." });
          navigate("/login", { replace: true });
          return;
        }

        if (!code) {
          toast.error("Login failed", { description: "Missing login code. Please try again." });
          navigate("/login", { replace: true });
          return;
        }

        setLoading(true);
        const res = await oauthComplete({ code });
        setAuthTokens({ accessToken: res.data.accessToken, refreshToken: res.data.refreshToken });

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
        const needsPasswordSetup = isSocialUser && !needsOnboarding && user?.passwordLoginEnabled !== true;

        toast.success(res.message || "Logged in successfully");
        navigate(needsOnboarding ? "/onboarding" : needsPasswordSetup ? "/change-password" : "/", { replace: true });
      } catch (err) {
        const errorToast = getErrorToast(err, { action: "Complete login", fallback: "Login failed." });
        toast.error(errorToast.title, { description: errorToast.description });
        navigate("/login", { replace: true });
      } finally {
        setLoading(false);
      }
    })();
  }, [code, description, error, navigate]);

  return (
    <PageShell bottomNavPadding={false} contentClassName="flex min-h-[100dvh] max-w-md items-center py-8">
      <Surface neon className="w-full overflow-hidden p-0 text-center">
        <div className="bg-[radial-gradient(circle_at_22%_0%,hsl(var(--primary)/0.28),transparent_34%),linear-gradient(135deg,hsl(var(--primary)/0.14),hsl(var(--card)))] p-5">
          <StatusPill tone="primary">Secure OAuth</StatusPill>
          <p className="mt-4 font-heading text-lg font-black">Signing you in...</p>
        </div>
        <div className="p-4 sm:p-5">
        <div className="mt-3 flex justify-center">
          {loading ? <ButtonLoadingScreen label="Please wait" /> : null}
        </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            You can safely close this screen if it takes too long.
          </p>
        </div>
      </Surface>
    </PageShell>
  );
}
