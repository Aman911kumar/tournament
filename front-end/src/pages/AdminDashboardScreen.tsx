import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CircleDollarSign,
  Crown,
  RefreshCcw,
  ShieldCheck,
  Ticket,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { toast } from "@/components/ui/sonner";
import { AdminDashboardData, CountBucket, getAdminDashboard } from "@/api/admin";
import { formatCurrency, getErrorMessage, getErrorToast } from "@/lib/page-utils";

const bucketColors = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--accent))",
  "hsl(var(--neon-pink))",
  "hsl(var(--destructive))",
];

const formatNumber = (value: number | undefined) => Number(value || 0).toLocaleString("en-IN");

const formatShortDate = (value: string) => {
  const date = new Date(value);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

const cleanLabel = (value: string | null | undefined) => {
  if (!value) return "Unknown";
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const StatCard = ({
  icon: Icon,
  label,
  value,
  note,
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note: string;
  color: string;
}) => (
  <GlassCard className="min-h-[112px]">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] uppercase text-muted-foreground font-heading">{label}</p>
        <p className="mt-2 font-heading text-2xl font-bold leading-tight truncate">{value}</p>
      </div>
      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
    </div>
    <p className="mt-3 text-xs text-muted-foreground truncate">{note}</p>
  </GlassCard>
);

const EmptyBlock = ({ text }: { text: string }) => (
  <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">{text}</div>
);

const DistributionList = ({ data }: { data: CountBucket[] }) => (
  <div className="space-y-3">
    {data.length === 0 ? (
      <p className="text-sm text-muted-foreground">No data yet</p>
    ) : (
      data.map((item, index) => (
        <div key={`${item._id}-${index}`} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: bucketColors[index % bucketColors.length] }}
            />
            <span className="text-sm font-heading truncate">{cleanLabel(item._id)}</span>
          </div>
          <span className="text-sm font-heading text-muted-foreground">{formatNumber(item.count)}</span>
        </div>
      ))
    )}
  </div>
);

const AdminDashboardScreen = () => {
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAdminDashboard(days);
      setDashboard(res.data);
    } catch (err) {
      const message = getErrorMessage(err, "Failed to load admin dashboard.");
      setError(message);
      const errorToast = getErrorToast(err, { action: "Load admin dashboard", fallback: "Failed to load admin dashboard." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const activityData = useMemo(() => {
    if (!dashboard) return [];

    return dashboard.charts.usersByDay.map((row, index) => ({
      date: formatShortDate(row.date),
      users: row.count,
      tournaments: dashboard.charts.tournamentsByDay[index]?.count || 0,
    }));
  }, [dashboard]);

  const revenueData = useMemo(() => {
    if (!dashboard) return [];

    return dashboard.charts.revenueByDay.map((row) => ({
      date: formatShortDate(row.date),
      amount: row.amount,
      payments: row.count,
    }));
  }, [dashboard]);

  const statusData = useMemo(() => {
    if (!dashboard) return [];

    return dashboard.charts.tournamentsByStatus.map((item, index) => ({
      name: cleanLabel(item._id),
      value: item.count,
      fill: bucketColors[index % bucketColors.length],
    }));
  }, [dashboard]);

  const gameData = useMemo(() => {
    if (!dashboard) return [];

    return dashboard.charts.tournamentsByGame.map((item) => ({
      game: cleanLabel(item._id),
      count: item.count,
    }));
  }, [dashboard]);

  if (loading && !dashboard) {
    return (
      <div className="min-h-screen bg-background px-4 py-6">
        <div className="mx-auto w-full max-w-6xl space-y-4">
          <div className="h-12 w-64 bg-muted rounded-lg animate-pulse" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((item) => (
              <div key={item} className="h-28 glass rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="h-80 glass rounded-xl animate-pulse" />
            <div className="h-80 glass rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="min-h-screen bg-background px-4 py-6">
        <div className="mx-auto w-full max-w-xl">
          <button type="button" onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <GlassCard className="text-center py-10">
            <AlertCircle className="w-10 h-10 mx-auto text-destructive mb-3" />
            <h1 className="font-heading text-lg font-bold">Admin dashboard unavailable</h1>
            <p className="text-sm text-muted-foreground mt-2 break-words">{error}</p>
            <Button onClick={fetchDashboard} className="mt-5">
              <RefreshCcw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </GlassCard>
        </div>
      </div>
    );
  }

  if (!dashboard) return null;

  const kpis = [
    {
      icon: Users,
      label: "Users",
      value: formatNumber(dashboard.totals.users),
      note: `${formatNumber(dashboard.totals.activeUsers)} active, ${formatNumber(dashboard.totals.bannedUsers)} banned`,
      color: "text-primary",
    },
    {
      icon: Crown,
      label: "Creators",
      value: formatNumber(dashboard.totals.creators),
      note: `${formatNumber(dashboard.totals.channels)} channels, ${formatNumber(dashboard.totals.channelMembers)} members`,
      color: "text-secondary",
    },
    {
      icon: Trophy,
      label: "Tournaments",
      value: formatNumber(dashboard.totals.tournaments),
      note: `${formatNumber(dashboard.totals.openTournaments)} open, ${formatNumber(dashboard.totals.runningTournaments)} running`,
      color: "text-accent",
    },
    {
      icon: CircleDollarSign,
      label: "Revenue",
      value: formatCurrency(dashboard.totals.totalRevenue),
      note: `${formatNumber(dashboard.totals.successfulPayments)} successful payments`,
      color: "text-neon-pink",
    },
    {
      icon: Wallet,
      label: "Wallet Flow",
      value: formatCurrency(dashboard.totals.netWalletFlow),
      note: `${formatCurrency(dashboard.totals.walletCredits)} in, ${formatCurrency(dashboard.totals.walletDebits)} out`,
      color: "text-primary",
    },
    {
      icon: ShieldCheck,
      label: "Verified IDs",
      value: formatNumber(dashboard.totals.verifiedGameAccounts),
      note: `${formatNumber(dashboard.totals.registrations)} tournament registrations`,
      color: "text-secondary",
    },
    {
      icon: BarChart3,
      label: "Matches",
      value: formatNumber(dashboard.totals.matches),
      note: `${formatNumber(dashboard.totals.finishedMatches)} finished matches`,
      color: "text-accent",
    },
    {
      icon: Ticket,
      label: "Support",
      value: formatNumber(dashboard.totals.openTickets),
      note: "Open or in-progress tickets",
      color: "text-destructive",
    },
  ];

  return (
    <div className="min-h-screen bg-background px-4 sm:px-5 py-6 pb-10">
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-10 h-10 glass rounded-lg flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-heading text-2xl font-bold">Admin Panel</h1>
              <p className="text-xs text-muted-foreground">Live platform statistics and operations overview</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {[7, 30, 90].map((range) => (
              <Button
                key={range}
                type="button"
                size="sm"
                variant={days === range ? "default" : "outline"}
                onClick={() => setDays(range)}
                className="min-w-16"
              >
                {range}d
              </Button>
            ))}
            <Button type="button" size="icon" variant="outline" onClick={fetchDashboard} disabled={loading}>
              <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {kpis.map((item) => (
            <StatCard key={item.label} {...item} />
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-4 mb-5">
          <GlassCard className="min-h-[320px]">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="font-heading text-base font-bold">Growth</h2>
                <p className="text-xs text-muted-foreground">New users and tournaments</p>
              </div>
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            {activityData.length ? (
              <ChartContainer
                className="h-64 w-full"
                config={{
                  users: { label: "Users", color: "hsl(var(--primary))" },
                  tournaments: { label: "Tournaments", color: "hsl(var(--accent))" },
                }}
              >
                <AreaChart data={activityData} margin={{ left: -20, right: 10, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="users" stroke="var(--color-users)" fill="var(--color-users)" fillOpacity={0.2} />
                  <Area
                    type="monotone"
                    dataKey="tournaments"
                    stroke="var(--color-tournaments)"
                    fill="var(--color-tournaments)"
                    fillOpacity={0.16}
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <EmptyBlock text="No growth data yet" />
            )}
          </GlassCard>

          <GlassCard className="min-h-[320px]">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="font-heading text-base font-bold">Revenue</h2>
                <p className="text-xs text-muted-foreground">Successful payment volume</p>
              </div>
              <CircleDollarSign className="w-5 h-5 text-accent" />
            </div>
            {revenueData.length ? (
              <ChartContainer className="h-64 w-full" config={{ amount: { label: "Revenue", color: "hsl(var(--accent))" } }}>
                <BarChart data={revenueData} margin={{ left: -12, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `Rs.${Number(value) / 1000}k`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="amount" fill="var(--color-amount)" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <EmptyBlock text="No revenue data yet" />
            )}
          </GlassCard>
        </div>

        <div className="grid lg:grid-cols-3 gap-4 mb-5">
          <GlassCard className="min-h-[300px]">
            <h2 className="font-heading text-base font-bold mb-1">Tournament Status</h2>
            <p className="text-xs text-muted-foreground mb-4">Current lifecycle split</p>
            {statusData.length ? (
              <ChartContainer className="h-44 w-full" config={{ value: { label: "Count" } }}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={74} paddingAngle={3}>
                    {statusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <EmptyBlock text="No status data yet" />
            )}
            <DistributionList data={dashboard.charts.tournamentsByStatus} />
          </GlassCard>

          <GlassCard className="min-h-[300px]">
            <h2 className="font-heading text-base font-bold mb-1">Games</h2>
            <p className="text-xs text-muted-foreground mb-4">Tournament count by game</p>
            {gameData.length ? (
              <ChartContainer className="h-44 w-full" config={{ count: { label: "Tournaments", color: "hsl(var(--secondary))" } }}>
                <BarChart data={gameData} margin={{ left: -24, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="game" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <EmptyBlock text="No game data yet" />
            )}
            <DistributionList data={dashboard.charts.tournamentsByGame} />
          </GlassCard>

          <GlassCard className="min-h-[300px]">
            <h2 className="font-heading text-base font-bold mb-1">User Roles</h2>
            <p className="text-xs text-muted-foreground mb-4">Role distribution</p>
            <DistributionList data={dashboard.charts.usersByRole} />
            <div className="mt-6 pt-4 border-t border-border">
              <h3 className="font-heading text-sm font-bold mb-3">Payment Status</h3>
              <DistributionList data={dashboard.charts.paymentsByStatus} />
            </div>
          </GlassCard>
        </div>

        <div className="grid xl:grid-cols-3 gap-4">
          <GlassCard className="xl:col-span-1">
            <h2 className="font-heading text-base font-bold mb-4">Top Creators</h2>
            <div className="space-y-3">
              {dashboard.tables.topCreators.length === 0 ? (
                <p className="text-sm text-muted-foreground">No creators yet</p>
              ) : (
                dashboard.tables.topCreators.map((creator, index) => (
                  <div key={creator._id} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center font-heading text-xs">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-heading font-semibold truncate">{creator.name}</p>
                        <p className="text-xs text-muted-foreground truncate">@{creator.handle}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-heading">{formatNumber(creator.memberCount)}</p>
                      <p className="text-[10px] text-muted-foreground">{formatNumber(creator.tournamentCount)} tournaments</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </GlassCard>

          <GlassCard className="xl:col-span-1">
            <h2 className="font-heading text-base font-bold mb-4">Recent Tournaments</h2>
            <div className="space-y-3">
              {dashboard.tables.recentTournaments.map((tournament) => (
                <div key={tournament._id} className="border-b border-border last:border-0 pb-3 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-heading font-semibold truncate">{tournament.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {cleanLabel(tournament.game)} by {tournament.organizer?.username || "Unknown"}
                      </p>
                    </div>
                    <span className="text-[10px] rounded-full bg-muted px-2 py-1 font-heading shrink-0">
                      {cleanLabel(tournament.status)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatCurrency(tournament.prizePool?.total || 0)}</span>
                    <span>{tournament.startAt ? formatShortDate(tournament.startAt) : "No date"}</span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="xl:col-span-1">
            <h2 className="font-heading text-base font-bold mb-4">Latest Tickets</h2>
            <div className="space-y-3">
              {dashboard.tables.recentTickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tickets yet</p>
              ) : (
                dashboard.tables.recentTickets.map((ticket) => (
                  <div key={ticket._id} className="flex items-start justify-between gap-3 border-b border-border last:border-0 pb-3 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-sm font-heading font-semibold truncate">{ticket.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {ticket.user?.username || "Unknown"} - {cleanLabel(ticket.type)}
                      </p>
                    </div>
                    <span className="text-[10px] rounded-full bg-muted px-2 py-1 font-heading shrink-0">
                      {cleanLabel(ticket.status)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardScreen;
