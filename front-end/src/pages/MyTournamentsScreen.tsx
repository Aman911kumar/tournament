import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  Gamepad2,
  MessageCircle,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  WalletCards,
} from "lucide-react";
import NeonButton from "@/components/NeonButton";
import {
  EmptyState,
  PageHeader,
  PageShell,
  SearchBox,
  SegmentedControl,
  SkeletonBlock,
  StatusPill,
  Surface,
} from "@/components/design-system";
import {
  getMyTournamentRegistrations,
  Tournament,
  TournamentRegistration,
} from "@/api/tournaments";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { formatPrizeSummary, getErrorMessage, getErrorToast } from "@/lib/page-utils";

const gameLabels: Record<string, string> = {
  freefire: "Free Fire",
  bgmi: "BGMI",
  callofduty: "Call of Duty",
  valorant: "Valorant",
};

const statusTone: Record<string, "primary" | "secondary" | "accent" | "danger" | "muted"> = {
  paid: "accent",
  confirmed: "secondary",
  pending: "muted",
  rejected: "danger",
  cancelled: "danger",
  live: "accent",
  completed: "muted",
  upcoming: "primary",
};

type FilterKey = "all" | "upcoming" | "live" | "finished" | "cancelled";

type TournamentEntry = {
  registration: TournamentRegistration;
  tournament: Tournament;
  phase: FilterKey;
};

const filterOptions: Array<{ label: string; value: FilterKey }> = [
  { label: "All", value: "all" },
  { label: "Upcoming", value: "upcoming" },
  { label: "Live", value: "live" },
  { label: "Finished", value: "finished" },
  { label: "Cancelled", value: "cancelled" },
];

const asTournament = (registration: TournamentRegistration) =>
  typeof registration.tournament === "string" ? null : registration.tournament;

const formatDate = (value?: string) => {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const formatTime = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatMoney = (value: number | string | undefined | null) => {
  const amount = Number(value || 0);

  if (!Number.isFinite(amount) || amount <= 0) return "Free";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

const getPhase = (registration: TournamentRegistration, tournament: Tournament): FilterKey => {
  if (registration.status === "cancelled" || tournament.status === "cancelled") return "cancelled";
  if (tournament.status === "running") return "live";
  if (tournament.status === "completed") return "finished";

  const startMs = tournament.startAt ? new Date(tournament.startAt).getTime() : 0;
  if (startMs && startMs > Date.now()) return "upcoming";

  return "live";
};

const getDisplayStatus = (entry: TournamentEntry) => {
  if (entry.phase === "live") return "live";
  if (entry.phase === "finished") return "completed";
  if (entry.phase === "upcoming") return entry.registration.status;
  return entry.phase;
};

const getPhaseLabel = (phase: FilterKey) => {
  if (phase === "finished") return "Finished";
  return phase.charAt(0).toUpperCase() + phase.slice(1);
};

const TournamentRegistrationCard = ({
  entry,
  index,
  onOpen,
  onOpenChat,
}: {
  entry: TournamentEntry;
  index: number;
  onOpen: () => void;
  onOpenChat: () => void;
}) => {
  const { registration, tournament, phase } = entry;
  const displayStatus = getDisplayStatus(entry);
  const participants = Number(tournament.registrationCount ?? tournament.participantCount ?? 0);
  const maxPlayers = Number(tournament.maxPlayers || 0);
  const fill = maxPlayers > 0 ? Math.min((participants / maxPlayers) * 100, 100) : 0;
  const startTime = formatTime(tournament.startAt);

  return (
    <Surface
      interactive
      neon={index === 0}
      onClick={onOpen}
      className="group relative overflow-hidden p-0"
    >
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-1",
          phase === "live"
            ? "bg-accent"
            : phase === "cancelled"
              ? "bg-destructive"
              : "gradient-neon",
        )}
      />
      <div className="p-2.5 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-secondary/25 bg-secondary/10 text-secondary sm:h-8 sm:w-8 sm:rounded-xl">
                <Gamepad2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-heading text-sm font-black leading-tight sm:text-base">
                  {tournament.title}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {gameLabels[tournament.game] ?? tournament.game}
                  {registration.slotNumber ? ` - Slot ${registration.slotNumber}` : ""}
                </p>
              </div>
            </div>
          </div>
          <StatusPill tone={statusTone[displayStatus] ?? "muted"} className="max-w-[92px] shrink-0 truncate capitalize sm:max-w-none">
            {displayStatus}
          </StatusPill>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 min-[430px]:grid-cols-3 sm:mt-4 sm:flex sm:flex-wrap">
          <span className="col-span-2 inline-flex min-h-8 min-w-0 items-center gap-1.5 rounded-full border border-glass-border bg-background/45 px-2.5 text-[11px] text-muted-foreground min-[430px]:col-span-1">
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate text-foreground">{formatDate(tournament.startAt)}</span>
            {startTime && <span className="shrink-0">{startTime}</span>}
          </span>
          <span className="inline-flex min-h-8 min-w-0 items-center gap-1.5 rounded-full border border-glass-border bg-background/45 px-2.5 text-[11px] text-muted-foreground">
            <Trophy className="h-3.5 w-3.5 shrink-0 text-accent" />
            <span className="min-w-0 truncate text-foreground">
              {formatPrizeSummary(tournament)}
            </span>
          </span>
          <span className="inline-flex min-h-8 min-w-0 items-center gap-1.5 rounded-full border border-glass-border bg-background/45 px-2.5 text-[11px] text-muted-foreground">
            <WalletCards className="h-3.5 w-3.5 shrink-0 text-secondary" />
            <span className="min-w-0 truncate text-foreground">
              {formatMoney(registration.paidAmount || tournament.entryFee)}
            </span>
          </span>
        </div>

        <div className="mt-3 space-y-2 sm:mt-4">
          <div className="flex items-center justify-between gap-3 text-[11px]">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {participants}/{maxPlayers || "-"} players
            </span>
            <span className="font-heading font-bold text-primary">
              {getPhaseLabel(phase)}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted/70">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary via-secondary to-accent transition-[width] duration-300"
              style={{ width: `${fill}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-glass-border/70 bg-background/25 px-2.5 py-2 sm:px-4 sm:py-2.5">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenChat();
          }}
          className="arena-focus inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/60 hover:text-secondary sm:min-h-9 sm:px-2.5"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Chat
        </button>
        <span className="inline-flex items-center gap-1 font-heading text-xs font-bold text-primary transition-colors group-hover:text-secondary">
          <span className="sm:hidden">Open</span>
          <span className="hidden sm:inline">Open tournament</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Surface>
  );
};

const MyTournamentsScreen = () => {
  const navigate = useNavigate();
  const [registrations, setRegistrations] = useState<TournamentRegistration[]>([]);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRegistrations = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMyTournamentRegistrations();
      setRegistrations(data);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load your tournaments."));
      const errorToast = getErrorToast(err, {
        action: "Load my tournaments",
        fallback: "Could not load your tournaments.",
      });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getMyTournamentRegistrations();
        if (active) setRegistrations(data);
      } catch (err) {
        if (active) setError(getErrorMessage(err, "Could not load your tournaments."));
        const errorToast = getErrorToast(err, {
          action: "Load my tournaments",
          fallback: "Could not load your tournaments.",
        });
        toast.error(errorToast.title, { description: errorToast.description });
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, []);

  const entries = useMemo<TournamentEntry[]>(() => {
    return registrations
      .map((registration) => {
        const tournament = asTournament(registration);
        if (!tournament) return null;

        return {
          registration,
          tournament,
          phase: getPhase(registration, tournament),
        };
      })
      .filter((entry): entry is TournamentEntry => Boolean(entry))
      .sort((a, b) => new Date(a.tournament.startAt).getTime() - new Date(b.tournament.startAt).getTime());
  }, [registrations]);

  const counts = useMemo(() => {
    return entries.reduce(
      (acc, entry) => {
        acc.all += 1;
        acc[entry.phase] += 1;
        return acc;
      },
      { all: 0, upcoming: 0, live: 0, finished: 0, cancelled: 0 } as Record<FilterKey, number>,
    );
  }, [entries]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();

    return entries.filter((entry) => {
      const { registration, tournament } = entry;
      const matchesFilter = activeFilter === "all" || entry.phase === activeFilter;
      const gameLabel = gameLabels[tournament.game] ?? tournament.game;
      const matchesSearch =
        !search ||
        tournament.title.toLowerCase().includes(search) ||
        tournament.game.toLowerCase().includes(search) ||
        gameLabel.toLowerCase().includes(search) ||
        String(registration.slotNumber ?? "").includes(search);

      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, entries, query]);

  const confirmedCount = entries.filter((entry) =>
    ["paid", "confirmed"].includes(entry.registration.status),
  ).length;

  return (
    <PageShell wide contentClassName="max-w-5xl space-y-3 pb-4 sm:space-y-4">
      <PageHeader
        title="My Tournaments"
        subtitle={
          <>
            <span className="sm:hidden">Joined matches and live rooms</span>
            <span className="hidden sm:inline">Registered matches, live rooms, and tournament access</span>
          </>
        }
        onBack={() => navigate(-1)}
        action={
          <NeonButton
            variant="ghost"
            className="hidden min-h-9 px-3 py-2 text-xs sm:inline-flex"
            onClick={() => navigate("/tournaments")}
          >
            Browse
          </NeonButton>
        }
      />

      <Surface className="overflow-hidden p-0">
        <div className="relative p-2.5 sm:p-4">
          <div className="absolute inset-x-0 top-0 h-px gradient-neon" />
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 font-heading text-[10px] font-bold text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                PLAYER HUB
              </div>
              <h2 className="mt-2 font-heading text-base font-black leading-tight sm:mt-3 sm:text-2xl">
                Tournament command center
              </h2>
              <p className="mt-1 hidden max-w-2xl text-xs text-muted-foreground sm:block sm:text-sm">
                Track your joined events, open live chat fast, and jump back into match details without hunting through the tournament list.
              </p>
            </div>
            <div className="arena-data-grid grid-cols-3 sm:min-w-[260px]">
              <div className="arena-data-tile text-center">
                <p className="font-heading text-base font-black text-primary sm:text-lg">{counts.all}</p>
                <p className="text-[10px] text-muted-foreground">Joined</p>
              </div>
              <div className="arena-data-tile text-center">
                <p className="font-heading text-base font-black text-accent sm:text-lg">{confirmedCount}</p>
                <p className="text-[10px] text-muted-foreground">Ready</p>
              </div>
              <div className="arena-data-tile text-center">
                <p className="font-heading text-base font-black text-secondary sm:text-lg">{counts.live}</p>
                <p className="text-[10px] text-muted-foreground">Live</p>
              </div>
            </div>
          </div>
        </div>
      </Surface>

      <div className="grid gap-2.5 sm:gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="Search tournament, game, slot..."
        />
        <SegmentedControl
          value={activeFilter}
          onChange={setActiveFilter}
          className="lg:max-w-[560px]"
          options={filterOptions.map((option) => ({
            value: option.value,
            label: (
              <span className="inline-flex items-center gap-1.5">
                {option.label}
                <span className="rounded-full bg-background/50 px-1.5 text-[10px]">
                  {counts[option.value]}
                </span>
              </span>
            ),
          }))}
        />
      </div>

      <div className="grid gap-2.5 sm:gap-3 lg:grid-cols-2">
        {loading &&
          [0, 1, 2, 3].map((item) => (
            <Surface key={item} className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-3">
                <SkeletonBlock className="h-9 w-9 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <SkeletonBlock className="h-4 w-2/3" />
                  <SkeletonBlock className="h-3 w-1/3" />
                </div>
                <SkeletonBlock className="h-7 w-16 rounded-full" />
              </div>
              <div className="grid grid-cols-2 gap-2 min-[430px]:grid-cols-3">
                <SkeletonBlock className="col-span-2 h-8 rounded-full min-[430px]:col-span-1" />
                <SkeletonBlock className="h-8 rounded-full" />
                <SkeletonBlock className="h-8 rounded-full" />
              </div>
              <SkeletonBlock className="h-1.5 rounded-full" />
            </Surface>
          ))}

        {!loading && error && (
          <div className="lg:col-span-2">
            <EmptyState
              icon={RefreshCcw}
              title="Could not load tournaments"
              description={error}
              action={
                <NeonButton variant="ghost" className="text-xs" onClick={loadRegistrations}>
                  Retry
                </NeonButton>
              }
            />
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="lg:col-span-2">
            <EmptyState
              icon={Clock3}
              title={entries.length === 0 ? "No joined tournaments" : "No matches in this view"}
              description={
                entries.length === 0
                  ? "Register for a tournament and your match hub will appear here."
                  : "Try a different status filter or search term."
              }
              action={
                <NeonButton variant="purple" className="text-xs" onClick={() => navigate("/tournaments")}>
                  Browse Tournaments
                </NeonButton>
              }
            />
          </div>
        )}

        {!loading &&
          !error &&
          filtered.map((entry, index) => (
            <TournamentRegistrationCard
              key={entry.registration._id}
              entry={entry}
              index={index}
              onOpen={() => navigate(`/tournament/${entry.tournament._id}`)}
              onOpenChat={() => navigate(`/tournament/${entry.tournament._id}/chat`)}
            />
          ))}
      </div>

      {!loading && !error && entries.length > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-glass-border bg-card/55 px-2.5 py-2 text-[11px] text-muted-foreground sm:px-3 sm:py-2.5 sm:text-xs">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-accent" />
            <span className="truncate">Payments and slots sync from your registrations.</span>
          </span>
          <button
            type="button"
            onClick={() => navigate("/tournaments")}
            className="arena-focus shrink-0 rounded-lg px-2 py-1 font-heading font-bold text-primary"
          >
            Find more
          </button>
        </div>
      )}
    </PageShell>
  );
};

export default MyTournamentsScreen;
