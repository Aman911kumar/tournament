import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";
import NeonButton from "@/components/NeonButton";
import { confirmPhoneVerification } from "@/api/profile";
import { getErrorMessage } from "@/lib/page-utils";
import { PageShell, StatusPill, Surface } from "@/components/design-system";

const VerifyPhoneScreen = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your phone...");

  useEffect(() => {
    let active = true;
    const token = searchParams.get("token") || "";

    if (!token) {
      setStatus("error");
      setMessage("Verification token is missing.");
      return;
    }

    confirmPhoneVerification(token)
      .then((res) => {
        if (!active) return;
        setStatus("success");
        setMessage(res.message || "Phone verified successfully.");
      })
      .catch((error) => {
        if (!active) return;
        setStatus("error");
        setMessage(getErrorMessage(error, "Verification link is invalid or expired."));
      });

    return () => {
      active = false;
    };
  }, [searchParams]);

  return (
    <PageShell bottomNavPadding={false} contentClassName="flex min-h-[100dvh] max-w-md items-center py-8">
      <Surface neon className="w-full overflow-hidden p-0 text-center">
        <div className="bg-[radial-gradient(circle_at_22%_0%,hsl(var(--secondary)/0.26),transparent_34%),linear-gradient(135deg,hsl(var(--secondary)/0.12),hsl(var(--card)))] p-5">
          <StatusPill tone={status === "success" ? "accent" : status === "error" ? "danger" : "primary"}>
            Phone verification
          </StatusPill>
          <div className="mx-auto mt-5 grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-background/50">
            {status === "loading" && <LoaderCircle className="h-7 w-7 animate-spin text-primary" />}
            {status === "success" && <CheckCircle2 className="h-7 w-7 text-accent" />}
            {status === "error" && <AlertCircle className="h-7 w-7 text-destructive" />}
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <h1 className="font-heading text-xl font-black">
            {status === "success" ? "Phone Verified" : status === "error" ? "Verification Failed" : "Checking Link"}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{message}</p>
          <NeonButton full variant={status === "success" ? "green" : "purple"} className="mt-5 min-h-10 text-xs" onClick={() => navigate(status === "success" ? "/profile" : "/edit-profile")}>
            {status === "success" ? "Go to profile" : "Back to profile"}
          </NeonButton>
        </div>
      </Surface>
    </PageShell>
  );
};

export default VerifyPhoneScreen;
