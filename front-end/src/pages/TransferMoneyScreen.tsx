import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BrowserQRCodeReader, IScannerControls } from "@zxing/browser";
import QRCode from "qrcode";
import { ArrowLeft, AtSign, BadgeIndianRupee, Camera, CheckCircle2, FileText, KeyRound, QrCode, ScanLine, Send, Sparkles, X } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { toast } from "@/components/ui/sonner";
import { getTransferPinStatus, transferMoney } from "@/api/wallet";
import { getMyProfile, User as ProfileUser } from "@/api/profile";
import { formatCurrency, getErrorToast } from "@/lib/page-utils";

const inputClass =
  "w-full bg-background/50 border border-glass-border rounded-lg px-3 py-2.5 text-sm font-heading placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors";

type ScannedTransferDetails = {
  recipient: string;
  amount?: string;
  note?: string;
};

const buildTransferQrPayload = (profile: ProfileUser | null) => {
  const recipient = profile?.username || profile?.email || profile?.phone_number || profile?._id || "";
  return JSON.stringify({
    app: "BattleArena",
    action: "transfer",
    recipient,
    username: profile?.username || "",
    note: "BattleArena wallet transfer",
  });
};

const parseTransferQrPayload = (value: string): ScannedTransferDetails => {
  const text = value.trim();
  if (!text) return { recipient: "" };

  try {
    const parsed = JSON.parse(text) as {
      app?: string;
      action?: string;
      recipient?: string;
      username?: string;
      email?: string;
      phone_number?: string;
      amount?: string | number;
      note?: string;
    };
    if (parsed.action === "transfer" || parsed.app === "BattleArena") {
      return {
        recipient: String(parsed.recipient || parsed.username || parsed.email || parsed.phone_number || "").trim(),
        amount: parsed.amount ? String(parsed.amount) : undefined,
        note: parsed.note ? String(parsed.note) : undefined,
      };
    }
  } catch {
    // Non-JSON QR codes can still contain a URL or plain recipient.
  }

  try {
    const url = new URL(text);
    return {
      recipient: url.searchParams.get("recipient") || url.searchParams.get("username") || text,
      amount: url.searchParams.get("amount") || undefined,
      note: url.searchParams.get("note") || undefined,
    };
  } catch {
    return { recipient: text };
  }
};

const typeIntoField = (value: string, setter: (value: string) => void, delay = 12) => {
  setter("");
  let index = 0;
  const timer = window.setInterval(() => {
    index += 1;
    setter(value.slice(0, index));
    if (index >= value.length) window.clearInterval(timer);
  }, delay);
};

const TransferMoneyScreen = () => {
  const navigate = useNavigate();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [transferPin, setTransferPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hasTransferPin, setHasTransferPin] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [scanFilled, setScanFilled] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const scanHandledRef = useRef(false);

  const amountValue = Number(amount || 0);
  const fee = useMemo(() => Math.round(amountValue * 2) / 100, [amountValue]);
  const receiverGets = Math.max(amountValue - fee, 0);
  const canSubmit = recipient.trim() !== "" && amountValue > 0 && /^\d{6}$/.test(transferPin) && hasTransferPin === true && !submitting;

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await getMyProfile();
        setProfile(res.data.user);
      } catch {
        setProfile(null);
      }
    };

    loadProfile();
  }, []);

  useEffect(() => {
    getTransferPinStatus()
      .then((res) => setHasTransferPin(Boolean(res.data.hasTransferPin)))
      .catch(() => setHasTransferPin(false));
  }, []);

  useEffect(() => {
    const payload = buildTransferQrPayload(profile);
    if (!payload) return;

    QRCode.toDataURL(payload, {
      width: 320,
      margin: 2,
      color: {
        dark: "#0f172a",
        light: "#dcfce7",
      },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [profile]);

  const stopScanner = () => {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    const stream = videoRef.current?.srcObject;
    if (stream instanceof MediaStream) {
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (!scannerOpen || !videoRef.current) return;

    let cancelled = false;
    const reader = new BrowserQRCodeReader();

    setScannerError("");
    scanHandledRef.current = false;

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setScannerError("Camera scanning is not available here. Open the app on localhost or HTTPS, then allow camera access.");
      return () => {
        cancelled = true;
      };
    }

    reader
      .decodeFromVideoDevice(undefined, videoRef.current, (result) => {
        if (!result || cancelled || scanHandledRef.current) return;
        const scanned = parseTransferQrPayload(result.getText());
        if (!scanned.recipient) return;
        scanHandledRef.current = true;
        cancelled = true;
        stopScanner();
        typeIntoField(scanned.recipient, setRecipient);
        if (scanned.amount && Number(scanned.amount) > 0) typeIntoField(String(scanned.amount), setAmount);
        if (scanned.note) typeIntoField(scanned.note, setNote, 8);
        setScanFilled(true);
        toast.success("QR scanned", { description: "Transfer details filled automatically." });
        setScannerOpen(false);
      })
      .then((controls) => {
        scannerControlsRef.current = controls;
      })
      .catch((error) => {
        if (cancelled) return;
        setScannerError(error instanceof Error ? error.message : "Camera scanner could not start.");
      });

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [scannerOpen]);

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error("Missing details", { description: "Enter recipient, amount, and your 6 digit transfer PIN." });
      return;
    }

    try {
      setSubmitting(true);
      await transferMoney({
        recipient: recipient.trim(),
        amount: amountValue,
        note: note.trim() || undefined,
        transferPin,
      });
      toast.success("Money transferred", {
        description: `${formatCurrency(receiverGets)} sent after ${formatCurrency(fee)} platform fee.`,
      });
      navigate("/wallet");
    } catch (error) {
      const errorToast = getErrorToast(error, { action: "Transfer money", fallback: "Transfer failed." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 pb-4 pt-6 sm:px-5">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate(-1)}
          className="grid h-10 w-10 place-items-center rounded-full border border-glass-border bg-background/60"
        >
          <ArrowLeft className="h-5 w-5" />
        </motion.button>
        <div className="min-w-0">
          <h1 className="font-heading text-xl font-bold">Transfer Money</h1>
          <p className="truncate text-xs text-muted-foreground font-heading">Fast wallet transfers with QR receive and scan</p>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 sm:px-5 lg:grid-cols-[1fr_320px]">
        <GlassCard neon className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-heading text-lg font-bold">Send Balance</p>
              <p className="mt-1 text-xs text-muted-foreground">Enter recipient, amount, and confirm transfer.</p>
            </div>
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 text-xs font-heading font-semibold text-primary"
            >
              <ScanLine className="h-4 w-4" />
              Scan QR
            </button>
          </div>

          {scanFilled && (
            <div className="flex items-center gap-2 rounded-xl border border-accent/25 bg-accent/10 px-3 py-2 text-xs font-heading text-accent">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              QR details filled. Review once before sending.
            </div>
          )}

          {hasTransferPin === false && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-secondary/30 bg-secondary/10 px-3 py-3">
              <div>
                <p className="font-heading text-sm font-bold text-secondary">Transfer PIN required</p>
                <p className="mt-1 text-xs text-muted-foreground">Set a 6 digit PIN before sending wallet balance.</p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/wallet/transfer-pin")}
                className="rounded-lg border border-secondary/40 px-3 py-2 text-xs font-heading font-semibold text-secondary"
              >
                Set PIN
              </button>
            </div>
          )}

          {scannerOpen && (
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-heading text-sm font-bold">Scan Recipient QR</p>
                  <p className="text-xs text-muted-foreground">Point camera at a BattleArena receive QR.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setScannerOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-full border border-glass-border text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="overflow-hidden rounded-xl border border-glass-border bg-black">
                <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
              </div>
              {scannerError && <p className="mt-2 text-xs text-destructive">{scannerError}</p>}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-heading text-muted-foreground">
                <AtSign className="h-3.5 w-3.5" /> Recipient
              </label>
              <input
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                placeholder="Username, phone, email, or user ID"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-heading text-muted-foreground">
                <BadgeIndianRupee className="h-3.5 w-3.5" /> Amount
              </label>
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="100"
                className={`${inputClass} font-display text-xl font-bold`}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-heading text-muted-foreground">
              <FileText className="h-3.5 w-3.5" /> Note
            </label>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional message"
              rows={3}
              className={`${inputClass} resize-none font-body`}
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label className="flex items-center gap-1.5 text-xs font-heading text-muted-foreground">
                <KeyRound className="h-3.5 w-3.5" /> Transfer PIN
              </label>
              <button
                type="button"
                onClick={() => navigate("/wallet/transfer-pin")}
                className="text-[10px] font-heading text-primary"
              >
                {hasTransferPin ? "Change PIN" : "Set PIN"}
              </button>
            </div>
            <input
              inputMode="numeric"
              maxLength={6}
              value={transferPin}
              onChange={(event) => setTransferPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Enter 6 digit PIN"
              className={`${inputClass} text-center font-display text-xl tracking-[0.35em]`}
            />
          </div>

          <div className="rounded-xl border border-glass-border bg-background/35 p-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="min-w-0 rounded-lg bg-background/55 p-3">
                <p className="text-[10px] text-muted-foreground font-heading">Amount</p>
                <p className="truncate text-sm font-heading font-bold">{formatCurrency(amountValue || 0)}</p>
              </div>
              <div className="min-w-0 rounded-lg bg-background/55 p-3">
                <p className="text-[10px] text-muted-foreground font-heading">Fee 2%</p>
                <p className="truncate text-sm font-heading font-bold text-destructive">{formatCurrency(fee || 0)}</p>
              </div>
              <div className="min-w-0 rounded-lg border border-accent/30 bg-accent/10 p-3">
                <p className="text-[10px] text-muted-foreground font-heading">Receiver</p>
                <p className="truncate text-sm font-heading font-bold text-accent">{formatCurrency(receiverGets || 0)}</p>
              </div>
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="group relative h-14 w-full overflow-hidden rounded-xl border border-accent/50 bg-accent text-accent-foreground shadow-[0_0_24px_hsl(var(--accent)/0.28)] transition-all hover:shadow-[0_0_34px_hsl(var(--accent)/0.42)] disabled:cursor-not-allowed disabled:border-muted disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
          >
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            <span className="relative flex items-center justify-center gap-2 font-heading text-sm font-black tracking-wide">
              {submitting ? (
                <>
                  <Sparkles className="h-4 w-4 animate-pulse" />
                  SENDING...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  SEND {amountValue > 0 ? formatCurrency(amountValue) : "MONEY"}
                </>
              )}
            </span>
          </motion.button>
        </GlassCard>

        <GlassCard className="h-fit overflow-hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-heading text-sm font-bold">Receive QR</p>
              <p className="mt-1 text-xs text-muted-foreground">Let others scan this to send you money.</p>
            </div>
            <QrCode className="h-5 w-5 text-accent" />
          </div>

          <div className="mx-auto mt-5 w-full max-w-[300px] rounded-3xl bg-gradient-to-br from-primary via-secondary to-accent p-[2px] shadow-[0_0_32px_hsl(var(--accent)/0.22)]">
            <div className="grid aspect-square place-items-center rounded-3xl bg-background p-4">
              <div className="grid h-full w-full place-items-center rounded-2xl bg-gradient-to-br from-accent/20 via-primary/10 to-secondary/20 p-3">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Receive money QR code" className="h-full w-full rounded-xl bg-white p-1" />
                ) : (
                  <QrCode className="h-16 w-16 text-accent" />
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-glass-border bg-background/35 p-3 text-center">
            <p className="text-[10px] font-heading text-muted-foreground">Receiving as</p>
            <p className="mt-1 truncate font-heading text-sm font-bold text-accent">
              {profile?.username || profile?.email || profile?.phone_number || "Your account"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 text-xs font-heading font-semibold text-primary lg:hidden"
          >
            <Camera className="h-4 w-4" />
            Scan QR
          </button>
        </GlassCard>
      </div>
    </div>
  );
};

export default TransferMoneyScreen;
