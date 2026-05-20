import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import GlassCard from "@/components/GlassCard";
import ButtonLoadingScreen from "@/components/ui/buttonLoadingScreen";
import { toast } from "@/components/ui/sonner";
import { getErrorToast } from "@/lib/page-utils";
import { oauthComplete } from "@/api/auth";
import { setAuthTokens } from "@/lib/auth-storage";

const parseCode = (search: string) => {
  const params = new URLSearchParams(search);
  return String(params.get("code") || "").trim();
};

export default function OAuthCallbackScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const ranRef = useRef(false);

  const code = useMemo(() => parseCode(location.search), [location.search]);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      try {
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
  }, [code, navigate]);

  return (
    <div className="min-h-[100svh] flex items-center justify-center px-4 py-10">
      <GlassCard neon className="w-full max-w-md text-center">
        <p className="font-heading text-sm font-bold">Signing you in...</p>
        <div className="mt-3 flex justify-center">
          {loading ? <ButtonLoadingScreen label="Please wait" /> : null}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">You can safely close this screen if it takes too long.</p>
      </GlassCard>
    </div>
  );
}

