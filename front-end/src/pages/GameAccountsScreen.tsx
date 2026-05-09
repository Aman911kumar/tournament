import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Gamepad2,
  Plus,
  Trash2,
  Pencil,
  ShieldCheck,
  ShieldAlert,
  Hash,
  User as UserIcon,
  Trophy,
  X,
  Loader2,
  RefreshCcw,
  AlertCircle,
} from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import {
  GameAccount,
  GameAccountPayload,
  createGameAccount,
  deleteGameAccount,
  listGameAccounts,
  updateGameAccount,
  verifyGameAccount,
} from "@/api/gameAccounts";
import {
  CACHE_KEYS,
  getSavedDataLabel,
  getSavedDataNotice,
  readCache,
  writeAuthenticatedCache,
} from "@/lib/offline-cache";
import { getErrorMessage, getErrorToast } from "@/lib/page-utils";

// ---- Constants ----
// `slug` is what the backend expects, `name` is what we show in the UI.
const GAMES = [
  { slug: "freefire", name: "Free Fire", color: "from-accent to-accent/40" },
  { slug: "bgmi", name: "BGMI", color: "from-primary to-primary/40" },
  { slug: "callofduty", name: "Call of Duty", color: "from-secondary to-secondary/40" },
  { slug: "valorant", name: "Valorant", color: "from-destructive to-destructive/40" },
  // { slug: "clashroyale", name: "Clash Royale", color: "from-primary to-secondary" },
];

const EMPTY_FORM: GameAccountPayload = { game: "freefire", inGameName: "", gameId: "", level: "" };

// ---- Helpers ----
// Look up game meta by backend slug (preferred) or display name (fallback for legacy data).
const getGameMeta = (value: string) =>
  GAMES.find((g) => g.slug === value || g.name === value) ?? GAMES[0];

const getSanitizedPayload = (form: GameAccountPayload): GameAccountPayload => ({
  game: form.game,
  inGameName: form.inGameName.trim(),
  gameId: form.gameId.trim(),
  level: form.level?.trim() || "",
});

// ---- Sub-components ----
interface AccountCardProps {
  account: GameAccount;
  index: number;
  verifyingId: string | null;
  onEdit: (account: GameAccount) => void;
  onDelete: (id: string) => void;
  onVerify: (id: string) => void;
  disabled: boolean;
}

const AccountCard = ({
  account,
  index,
  verifyingId,
  onEdit,
  onDelete,
  onVerify,
  disabled,
}: AccountCardProps) => {
  const meta = getGameMeta(account.game);
  const isVerifying = verifyingId === account._id;
  return (
    <GlassCard delay={index * 0.04} className="relative overflow-hidden p-3.5 sm:p-4">
      <div
        className={`absolute -top-12 -right-12 w-32 h-32 rounded-full blur-2xl bg-gradient-to-br ${meta.color} opacity-20`}
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start">
        <div
          className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center shrink-0`}
        >
          <Gamepad2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-heading font-bold text-sm truncate max-w-full">{meta.name}</p>
            {account.verified ?
              (<span className="flex items-center gap-1 text-[10px] text-accent bg-accent/10 px-1.5 py-0.5 rounded-full shrink-0">
                <ShieldCheck className="w-3 h-3" /> Verified
              </span>)
              :
              (
                <span className="flex items-center gap-1 text-[10px] text-red-400 bg-red-400/10 border border-red-400/30 px-1.5 py-0.5 rounded-full shrink-0">
                  <ShieldAlert className="w-3 h-3 text-red-400" />
                  <span className="text-red-400">Not Verified</span>
                </span>
              )
            }
            {account.level && (
              <span className="flex items-center gap-1 text-[10px] text-secondary bg-secondary/10 px-1.5 py-0.5 rounded-full shrink-0">
                <Trophy className="w-3 h-3" /> Lv {account.level}
              </span>
            )}
          </div>
          <div className="mt-1.5 space-y-0.5">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <UserIcon className="w-3 h-3 shrink-0" />
              <span className="text-foreground min-w-0 truncate">{account.inGameName}</span>
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-mono">
              <Hash className="w-3 h-3 shrink-0" />
              <span className="text-foreground min-w-0 truncate">{account.gameId}</span>
            </p>
          </div>
        </div>

        <div className="flex w-22 flex-col items-center gap-2 sm:shrink-0">
          {!account.verified && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => onVerify(account._id)}
              disabled={disabled || isVerifying}
              title="Verify account"
              className="h-8 w-full rounded-full border border-accent/40 bg-accent/10 px-4 text-s font-heading font-semibold text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
            >
              {isVerifying ? (
                <span className="inline-flex w-22 items-center justify-center gap-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Wait..
                </span>
              ) : (
                <span className="inline-flex items-center justify-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Verify
                </span>
              )}
            </motion.button>
          )}
          <div className="flex w-full justify-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => onEdit(account)}
              disabled={disabled}
              title="Edit account"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/45 bg-primary/10 text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
            >
              <Pencil className="w-4 h-4" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => onDelete(account._id)}
              disabled={disabled}
              title="Delete account"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-destructive/45 bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </div>
    </GlassCard>
  );
};

interface AccountFormModalProps {
  open: boolean;
  isEditing: boolean;
  loading: boolean;
  form: GameAccountPayload;
  onChange: (form: GameAccountPayload) => void;
  onClose: () => void;
  onSubmit: () => void;
}

const AccountFormModal = ({
  open,
  isEditing,
  loading,
  form,
  onChange,
  onClose,
  onSubmit,
}: AccountFormModalProps) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/88 flex items-center sm:items-center justify-center p-3 sm:p-4"
        onClick={() => !loading && onClose()}
      >
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: "spring", damping: 22 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md max-h-[92svh] overflow-y-auto glass neon-border rounded-lg p-4 sm:p-5 relative"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-lg font-bold">
              {isEditing ? "Edit Account" : "Link New Account"}
            </h3>
            <button
              onClick={() => !loading && onClose()}
              disabled={loading}
              className="w-8 h-8 rounded-full glass flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-xs font-heading text-muted-foreground mb-2 block">
                Select Game
              </Label>
              <div className="grid grid-cols-2 gap-2 min-[420px]:flex min-[420px]:flex-wrap">
                {GAMES.map((g) => (
                  <button
                    key={g.slug}
                    type="button"
                    disabled={loading}
                    onClick={() => onChange({ ...form, game: g.slug })}
                    className={`px-3 py-2 min-[420px]:py-1.5 rounded-full text-xs font-heading font-medium border transition-all disabled:opacity-60 ${form.game === g.slug
                      ? "border-primary bg-primary/15 text-primary neon-glow-purple"
                      : "border-border/40 text-muted-foreground hover:border-primary/40"
                      }`}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs font-heading text-muted-foreground mb-1.5 block">
                In-Game Name
              </Label>
              <Input
                value={form.inGameName}
                onChange={(e) => onChange({ ...form, inGameName: e.target.value })}
                placeholder="e.g. ShadowReaper"
                disabled={loading}
                className="bg-background/50"
              />
            </div>

            <div>
              <Label className="text-xs font-heading text-muted-foreground mb-1.5 block">
                Game ID / UID
              </Label>
              <Input
                value={form.gameId}
                onChange={(e) => onChange({ ...form, gameId: e.target.value })}
                placeholder="e.g. 5147829301"
                disabled={loading}
                className="bg-background/50 font-mono"
              />
            </div>

            <div>
              <Label className="text-xs font-heading text-muted-foreground mb-1.5 block">
                Level <span className="opacity-60">(optional)</span>
              </Label>
              <Input
                value={form.level ?? ""}
                onChange={(e) => onChange({ ...form, level: e.target.value })}
                placeholder="e.g. 75"
                disabled={loading}
                className="bg-background/50"
              />
            </div>

            <NeonButton full onClick={onSubmit} disabled={loading} className="min-h-11">
              <span className="inline-flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Saving..." : isEditing ? "Save Changes" : "Link Account"}
              </span>
            </NeonButton>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

// ---- Main screen ----
const GameAccountsScreen = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<GameAccount[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<GameAccountPayload>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cacheNotice, setCacheNotice] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    const cachedAccounts = readCache<GameAccount[]>(CACHE_KEYS.gameAccounts);

    try {
      setFetching(true);
      setLoadError(null);
      if (cachedAccounts) {
        setAccounts(cachedAccounts.data);
        setCacheNotice(getSavedDataLabel(cachedAccounts.savedAt));
      }

      const data = await listGameAccounts();
      const nextAccounts = data?.data ?? [];
      setAccounts(nextAccounts);
      setCacheNotice(null);
      writeAuthenticatedCache(CACHE_KEYS.gameAccounts, nextAccounts, data);
    } catch (error) {
      const message = getErrorMessage(error, "Failed to load game accounts.");
      if (cachedAccounts) {
        setAccounts(cachedAccounts.data);
        setLoadError(null);
        const notice = getSavedDataNotice(cachedAccounts.savedAt, error);
        setCacheNotice(notice);
        toast.info("Showing saved game accounts.", { description: notice });
      } else {
        setLoadError(message);
        const errorToast = getErrorToast(error, { action: "Load game accounts", fallback: "Failed to load game accounts." });
        toast.error(errorToast.title, { description: errorToast.description });
      }
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (account: GameAccount) => {
    setEditingId(account._id);
    setForm({
      game: account.game,
      inGameName: account.inGameName,
      gameId: account.gameId,
      level: account.level ?? "",
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    const payload = getSanitizedPayload(form);

    if (!payload.game || !payload.inGameName || !payload.gameId) {
      toast.error("Game, in-game name and ID are required.");
      return;
    }

    try {
      setLoading(true);

      if (editingId) {
        const res = await updateGameAccount(editingId, payload);
        const updated = res.data ?? ({ _id: editingId, ...payload } as GameAccount);
        setAccounts((prev) => {
          const next = prev.map((a) => (a._id === editingId ? { ...a, ...updated } : a));
          writeAuthenticatedCache(CACHE_KEYS.gameAccounts, next, res);
          return next;
        });
        toast.success(res.message);
      } else {
        const res = await createGameAccount(payload);
        const created = (res.data ?? {}) as Partial<GameAccount>;
        const newAccount: GameAccount = {
          _id: created._id ?? Date.now().toString(),
          ...payload,
          verified: created.verified ?? false,
        };
        setAccounts((prev) => {
          const next = [newAccount, ...prev];
          writeAuthenticatedCache(CACHE_KEYS.gameAccounts, next, res);
          return next;
        });
        toast.success(res.message);
      }

      setOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
    } catch (error) {
      const errorToast = getErrorToast(error, { action: editingId ? "Update game account" : "Create game account", fallback: "Failed to save account." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const previous = accounts;
    setAccounts((p) => {
      const next = p.filter((a) => a._id !== id);
      return next;
    });
    try {
      const res = await deleteGameAccount(id);
      writeAuthenticatedCache(CACHE_KEYS.gameAccounts, accounts.filter((a) => a._id !== id), res);
      toast.success(res.message);
    } catch (error) {
      setAccounts(previous);
      const errorToast = getErrorToast(error, { action: "Delete game account", fallback: "Failed to remove account." });
      toast.error(errorToast.title, { description: errorToast.description });
    }
  };

  const handleVerify = async (id: string) => {
    try {
      setVerifyingId(id);
      const res = await verifyGameAccount(id);
      const isVerified = res.data?.verified ?? true;
      setAccounts((prev) => {
        const next = prev.map((a) => (a._id === id ? { ...a, verified: isVerified } : a));
        writeAuthenticatedCache(CACHE_KEYS.gameAccounts, next, res);
        return next;
      });
      toast.success(res.message || (isVerified ? "Account verified" : "Verification requested"));
    } catch (error) {
      const errorToast = getErrorToast(error, { action: "Verify game account", fallback: "Failed to verify account." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setVerifyingId(null);
    }
  };

  const verifiedCount = accounts.filter((a) => a.verified).length;
  const hasAccounts = accounts.length > 0;
  const isBusy = loading || verifyingId !== null;

  return (
    <div className="arena-shell min-h-screen pb-28 relative overflow-hidden">
      {/* ambient glow */}
      <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-primary/8 blur-xl pointer-events-none" />
      <div className="absolute top-1/2 -left-24 h-56 w-56 rounded-full bg-secondary/8 blur-xl pointer-events-none" />

      {/* Header */}
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-5 pt-5 sm:pt-6 pb-4 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full glass flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
          </motion.button>
          <div>
            <h1 className="font-heading text-lg sm:text-xl font-bold">Game Accounts</h1>
            <p className="text-[11px] text-muted-foreground">Link your in-game profiles</p>
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.92 }}
          whileHover={{ scale: 1.05 }}
          onClick={openCreate}
          disabled={fetching}
          className="w-10 h-10 rounded-full gradient-primary neon-glow-purple flex items-center justify-center"
          title="Link new account"
        >
          <Plus className="w-5 h-5 text-primary-foreground" />
        </motion.button>
      </div>

      {/* Hero summary */}
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-5 mb-5 relative z-10">
        <GlassCard neon className="relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/15 rounded-full blur-2xl" />
          <div className="flex items-center gap-4">
            <motion.div
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              className="w-14 h-14 rounded-lg gradient-primary flex items-center justify-center neon-border"
            >
              <Gamepad2 className="w-7 h-7 text-primary-foreground" />
            </motion.div>
            <div className="flex-1 min-w-0">
              <p className="font-display text-2xl font-bold text-primary">{accounts.length}</p>
              <p className="text-xs text-muted-foreground font-heading">Linked Accounts</p>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl font-bold text-accent">{verifiedCount}</p>
              <p className="text-xs text-muted-foreground font-heading">Verified</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Accounts list */}
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-5 space-y-3 relative z-10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Your Accounts
            </h2>
            {cacheNotice && (
              <p className="mt-0.5 max-w-[220px] truncate text-[10px] font-heading text-secondary" title={cacheNotice}>
                {cacheNotice}
              </p>
            )}
          </div>
          {loadError && (
            <button
              type="button"
              onClick={loadAccounts}
              className="inline-flex items-center gap-1.5 text-xs font-heading text-primary"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              Retry
            </button>
          )}
        </div>

        {fetching && (
          <div className="space-y-3">
            {[0, 1, 2].map((item) => (
              <GlassCard key={item} className="p-3.5 sm:p-4">
                <div className="flex items-center gap-3 animate-pulse">
                  <div className="w-11 h-11 rounded-xl bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/3 rounded bg-muted" />
                    <div className="h-2.5 w-2/3 rounded bg-muted" />
                    <div className="h-2.5 w-1/2 rounded bg-muted" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="w-8 h-8 rounded-full bg-muted" />
                    <div className="w-8 h-8 rounded-full bg-muted" />
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}

        {!fetching && loadError && (
          <GlassCard className="text-center py-8 px-5">
            <AlertCircle className="w-10 h-10 mx-auto text-destructive mb-2" />
            <p className="text-sm font-heading">Could not load accounts</p>
            <p className="text-xs text-muted-foreground mt-1 break-words">{loadError}</p>
            <NeonButton onClick={loadAccounts} className="mt-4 px-5 py-2.5">
              Retry
            </NeonButton>
          </GlassCard>
        )}

        {!fetching && !loadError && !hasAccounts && (
          <GlassCard className="text-center py-10 px-5">
            <Gamepad2 className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-heading">No game accounts yet</p>
            <p className="text-xs text-muted-foreground mt-1">Tap + to link your first one</p>
            <NeonButton onClick={openCreate} className="mt-4 px-5 py-2.5">
              Link Account
            </NeonButton>
          </GlassCard>
        )}

        {!fetching && !loadError && accounts.map((account, i) => (
          <AccountCard
            key={account._id}
            account={account}
            index={i}
            verifyingId={verifyingId}
            onEdit={openEdit}
            onDelete={handleDelete}
            onVerify={handleVerify}
            disabled={isBusy}
          />
        ))}
      </div>

      <div className="">
      <AccountFormModal
        open={open}
        isEditing={editingId !== null}
        loading={loading}
        form={form}
        onChange={setForm}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
      />
      </div>

    </div>
  );
};

export default GameAccountsScreen;
