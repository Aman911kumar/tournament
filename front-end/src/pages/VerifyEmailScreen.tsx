import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import { confirmEmailVerification } from "@/api/profile";
import { getErrorMessage } from "@/lib/page-utils";

const VerifyEmailScreen = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    let active = true;
    const token = searchParams.get("token") || "";

    if (!token) {
      setStatus("error");
      setMessage("Verification token is missing.");
      return;
    }

    confirmEmailVerification(token)
      .then((res) => {
        if (!active) return;
        setStatus("success");
        setMessage(res.message || "Email verified successfully.");
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
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto flex min-h-[70vh] w-full max-w-md items-center">
        <GlassCard neon className="w-full text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-primary/10">
            {status === "loading" && <LoaderCircle className="h-7 w-7 animate-spin text-primary" />}
            {status === "success" && <CheckCircle2 className="h-7 w-7 text-accent" />}
            {status === "error" && <AlertCircle className="h-7 w-7 text-destructive" />}
          </div>
          <h1 className="font-heading text-xl font-bold">
            {status === "success" ? "Email Verified" : status === "error" ? "Verification Failed" : "Checking Link"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          <NeonButton full variant={status === "success" ? "green" : "purple"} className="mt-6" onClick={() => navigate(status === "success" ? "/profile" : "/edit-profile")}>
            {status === "success" ? "GO TO PROFILE" : "BACK TO PROFILE"}
          </NeonButton>
        </GlassCard>
      </div>
    </div>
  );
};

export default VerifyEmailScreen;
