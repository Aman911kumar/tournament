import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion, useInView, useReducedMotion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import heroBg from "@/assets/hero-bg.jpg";
import gameBgmi from "@/assets/game-bgmi.jpg";
import gameCod from "@/assets/game-cod.jpg";
import gameFreefire from "@/assets/game-freefire.jpg";
import gameValorant from "@/assets/game-valorant.jpg";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Crown,
  Download,
  Gamepad2,
  Gift,
  Headphones,
  LockKeyhole,
  MessageCircle,
  Radio,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Trophy,
  Users,
  WalletCards,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const apkUrl = import.meta.env.VITE_APK_DOWNLOAD_URL || import.meta.env.VITE_APK_URL || "";
const apkHref = apkUrl || "#apk-download";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Tournaments", href: "#tournaments" },
  { label: "Creators", href: "#creators" },
  { label: "FAQ", href: "#faq" },
];

const heroStats = [
  { label: "Prize-ready matches", value: 120, suffix: "+" },
  { label: "Realtime alerts", value: 24, suffix: "/7" },
  { label: "Creator tools", value: 9, suffix: "+" },
];

const features = [
  {
    title: "Fast tournaments",
    description: "Discover live, upcoming, and completed matches with clean slots, entry fees, and prize details.",
    icon: Trophy,
    tone: "text-primary",
  },
  {
    title: "Secure wallet",
    description: "Wallet, withdrawals, UPI/bank details, transfer PIN, and transaction history in one flow.",
    icon: WalletCards,
    tone: "text-accent",
  },
  {
    title: "Creator system",
    description: "Creators can launch matches, manage room details, distribute rewards, and moderate players.",
    icon: Crown,
    tone: "text-secondary",
  },
  {
    title: "Realtime notifications",
    description: "Room ID, password, rewards, wallet activity, and tournament alerts feel instant.",
    icon: BellRing,
    tone: "text-[hsl(var(--neon-pink))]",
  },
  {
    title: "Room sharing",
    description: "Copy-ready room ID and password cards keep players ready before the match starts.",
    icon: Copy,
    tone: "text-primary",
  },
  {
    title: "Rewards engine",
    description: "Prize distribution, earnings views, and winner records built for competitive play.",
    icon: Gift,
    tone: "text-accent",
  },
];

const tournaments = [
  {
    title: "Free Fire Clash",
    game: "Free Fire",
    image: gameFreefire,
    status: "Live",
    prize: "Rs. 8,000",
    slots: "41/48",
    tone: "accent",
  },
  {
    title: "BGMI Squad Rush",
    game: "BGMI",
    image: gameBgmi,
    status: "Upcoming",
    prize: "Rs. 12,500",
    slots: "26/100",
    tone: "secondary",
  },
  {
    title: "Valorant Night Cup",
    game: "Valorant",
    image: gameValorant,
    status: "Featured",
    prize: "Rs. 18,000",
    slots: "8/16",
    tone: "primary",
  },
  {
    title: "COD Mobile Sprint",
    game: "COD Mobile",
    image: gameCod,
    status: "Completed",
    prize: "Rs. 5,000",
    slots: "50/50",
    tone: "muted",
  },
];

const leaderboard = [
  { name: "AK Phantom", tag: "Free Fire", amount: "Rs. 42,800", rank: "01" },
  { name: "NovaRex", tag: "BGMI", amount: "Rs. 31,250", rank: "02" },
  { name: "CypherAce", tag: "Valorant", amount: "Rs. 28,900", rank: "03" },
];

const realtimeFeed = [
  { title: "Room details pushed", detail: "BGMI Squad Rush - ID copied by 28 players", icon: Radio },
  { title: "Wallet credited", detail: "AK Phantom received Rs. 1,200 reward", icon: WalletCards },
  { title: "Tournament created", detail: "Creator DarkZone launched Free Fire Clash", icon: Trophy },
];

const testimonials = [
  {
    name: "Rohit",
    role: "Competitive player",
    text: "The room alerts and slot system make it feel made for mobile players. No hunting for match details.",
  },
  {
    name: "Shradha Plays",
    role: "Creator",
    text: "Creator dashboard, reward controls, and moderation tools save serious time before match start.",
  },
  {
    name: "Aman",
    role: "Squad leader",
    text: "Wallet transfers and tournament history are clear. The app feels fast even on my older phone.",
  },
];

const faqs = [
  {
    question: "Is Battle4Arena built for Android?",
    answer: "Yes. The interface is mobile-first and APK-ready, while the browser version remains available for desktop and testing.",
  },
  {
    question: "Can creators manage room ID and password?",
    answer: "Creators can prepare room credentials and send realtime notifications to joined players when the match is ready.",
  },
  {
    question: "Does the platform support wallet and rewards?",
    answer: "Battle4Arena includes wallet balances, transfer flows, withdrawals, rewards, prize distribution, and transaction history.",
  },
  {
    question: "Are notifications realtime?",
    answer: "The platform is designed around realtime Socket.IO updates for wallet activity, tournament activity, and room alerts.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0 },
};

const toneClasses: Record<string, string> = {
  primary: "border-primary/35 bg-primary/10 text-primary",
  secondary: "border-secondary/35 bg-secondary/10 text-secondary",
  accent: "border-accent/35 bg-accent/10 text-accent",
  muted: "border-glass-border bg-muted/45 text-muted-foreground",
};

const MotionSection = ({ id, children, className = "" }: { id?: string; children: ReactNode; className?: string }) => {
  const reduce = useReducedMotion();
  return (
    <motion.section
      id={id}
      variants={reduce ? undefined : fadeUp}
      initial={reduce ? undefined : "hidden"}
      whileInView={reduce ? undefined : "visible"}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.section>
  );
};

const SectionHeading = ({
  eyebrow,
  title,
  description,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  description: string;
  align?: "left" | "center";
}) => (
  <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
    <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-heading text-[10px] font-bold uppercase tracking-wide text-primary">
      <Sparkles className="h-3.5 w-3.5" />
      {eyebrow}
    </p>
    <h2 className="font-display text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">{title}</h2>
    <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
  </div>
);

const CountUp = ({ value, suffix = "" }: { value: number; suffix?: string }) => {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const duration = 900;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);

  return (
    <span ref={ref}>
      {display.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
};

const LandingCard = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-lg border border-glass-border bg-card/72 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.045)] ${className}`}>
    {children}
  </div>
);

const LandingPage = () => {
  const reduce = useReducedMotion();

  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="fixed inset-0 -z-10">
        <img src={heroBg} alt="" className="h-full w-full object-cover opacity-[0.42]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,hsl(var(--primary)/0.24),transparent_28rem),radial-gradient(circle_at_78%_18%,hsl(var(--secondary)/0.18),transparent_24rem),linear-gradient(180deg,hsl(var(--background)/0.92),hsl(var(--background)/0.98))]" />
        <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--foreground)/0.045)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--foreground)/0.03)_1px,transparent_1px)] bg-[size:48px_48px] opacity-35" />
      </div>

      <header className="sticky top-0 z-40 border-b border-glass-border bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--card))_100%)] shadow-[0_14px_34px_hsl(var(--background)/0.45)]">
        <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-5 lg:px-6">
          <a href="#hero" className="arena-focus flex items-center gap-2 rounded-md">
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
              <Gamepad2 className="h-5 w-5" />
            </span>
            <span className="font-display text-lg font-black tracking-wide">BATTLE4ARENA</span>
          </a>
          <div className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="arena-focus rounded-lg px-3 py-2 font-heading text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/login">Login</Link>
            </Button>
            <Button asChild size="sm">
              <a href={apkHref}>
                <Download className="h-4 w-4" />
                APK
              </a>
            </Button>
          </div>
        </nav>
      </header>

      <main>
        <section id="hero" className="relative mx-auto grid min-h-[calc(100svh-4rem)] w-full max-w-7xl items-center gap-10 px-4 py-12 sm:px-5 lg:grid-cols-[minmax(0,1fr)_480px] lg:px-6 lg:py-16">
          <motion.div
            initial={reduce ? undefined : { opacity: 0, y: 24 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 font-heading text-xs font-bold text-accent">
              <Radio className="h-3.5 w-3.5" />
              Realtime tournament platform for mobile esports
            </p>
            <h1 className="font-display text-5xl font-black leading-[0.95] sm:text-6xl lg:text-7xl">
              Play. Host. Win.
              <span className="block bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                Battle like a pro.
              </span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Battle4Arena brings tournaments, wallet rewards, creator tools, realtime room alerts, and secure APK-ready gaming flows into one premium esports platform.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="min-h-12">
                <a href={apkHref}>
                  <Smartphone className="h-5 w-5" />
                  Download APK
                </a>
              </Button>
              <Button asChild size="lg" variant="soft" className="min-h-12">
                <Link to="/login">
                  Play Now
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {heroStats.map((stat) => (
                <LandingCard key={stat.label} className="p-4">
                  <p className="font-display text-2xl font-black text-foreground">
                    <CountUp value={stat.value} suffix={stat.suffix} />
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
                </LandingCard>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={reduce ? undefined : { opacity: 0, x: 24 }}
            animate={reduce ? undefined : { opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.08 }}
            className="relative"
          >
            <div className="absolute -inset-4 rounded-lg bg-gradient-to-br from-primary/18 via-secondary/10 to-accent/12 opacity-80" />
            <LandingCard className="relative overflow-hidden p-4">
              <div className="relative h-[520px] overflow-hidden rounded-lg border border-glass-border bg-background/60">
                <img src={gameFreefire} alt="Free Fire tournament preview" className="absolute inset-0 h-full w-full object-cover opacity-55" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/12" />
                <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-3">
                  <span className="rounded-full border border-accent/35 bg-accent/15 px-3 py-1 font-heading text-[10px] font-bold text-accent">LIVE NOW</span>
                  <span className="rounded-full border border-glass-border bg-card/80 px-3 py-1 font-heading text-[10px] text-muted-foreground">41/48 slots</span>
                </div>
                <motion.div
                  animate={reduce ? undefined : { y: [0, -8, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute left-4 right-4 top-24 rounded-lg border border-glass-border bg-card/82 p-4"
                >
                  <p className="font-heading text-xs text-muted-foreground">Prize Pool</p>
                  <p className="mt-1 font-display text-4xl font-black text-accent">Rs. 8,000</p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted/60">
                    <div className="h-full w-[82%] rounded-full bg-gradient-to-r from-primary to-accent" />
                  </div>
                </motion.div>
                <div className="absolute bottom-4 left-4 right-4 grid gap-3">
                  {realtimeFeed.slice(0, 2).map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.title} className="flex items-center gap-3 rounded-lg border border-glass-border bg-card/86 p-3">
                        <span className="grid h-10 w-10 place-items-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-heading text-sm font-bold">{item.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </LandingCard>
          </motion.div>
        </section>

        <MotionSection id="apk-download" className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-5 lg:px-6">
          <LandingCard className="overflow-hidden">
            <div className="grid gap-8 p-5 sm:p-6 lg:grid-cols-[1fr_420px] lg:p-8">
              <div>
                <SectionHeading
                  eyebrow="Android first"
                  title="Download the Battle4Arena APK"
                  description="Built for future APK conversion, low-end Android performance, fast match entry, and touch-friendly tournament workflows."
                />
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {[
                    ["Version", "1.0 Beta"],
                    ["Size target", "Lightweight"],
                    ["Support", "Android 8+"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-glass-border bg-background/45 p-4">
                      <p className="font-heading text-[10px] uppercase text-muted-foreground">{label}</p>
                      <p className="mt-1 font-heading text-lg font-bold">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Button asChild size="lg">
                    <a href={apkHref}>
                      <Download className="h-5 w-5" />
                      Download APK
                    </a>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link to="/login">Continue in Browser</Link>
                  </Button>
                </div>
              </div>
              <div className="relative min-h-80 rounded-lg border border-glass-border bg-background/55 p-5">
                <div className="mx-auto h-full max-w-[230px] rounded-[2rem] border border-glass-border bg-card/90 p-3">
                  <div className="h-full rounded-[1.5rem] border border-glass-border bg-background p-4">
                    <div className="mx-auto mb-5 h-1.5 w-16 rounded-full bg-muted" />
                    <Smartphone className="mx-auto h-12 w-12 text-accent" />
                    <p className="mt-5 text-center font-heading text-lg font-bold">APK Ready UI</p>
                    <div className="mt-5 space-y-2">
                      {["Fast taps", "Room alerts", "Wallet safety", "Low GPU motion"].map((item) => (
                        <div key={item} className="flex items-center gap-2 rounded-lg border border-glass-border bg-card/60 px-3 py-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </LandingCard>
        </MotionSection>

        <MotionSection id="features" className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-5 lg:px-6">
          <SectionHeading
            eyebrow="Platform features"
            title="Everything players and creators need"
            description="Battle4Arena combines player match discovery with creator operations, secure wallet flows, notifications, and moderation."
            align="center"
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <motion.div key={feature.title} whileHover={reduce ? undefined : { y: -4 }} transition={{ duration: 0.18 }}>
                  <LandingCard className="h-full p-5 transition-colors hover:border-primary/40">
                    <div className={`grid h-11 w-11 place-items-center rounded-lg border border-glass-border bg-background/50 ${feature.tone}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-5 font-heading text-lg font-bold">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.description}</p>
                  </LandingCard>
                </motion.div>
              );
            })}
          </div>
        </MotionSection>

        <MotionSection id="tournaments" className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-5 lg:px-6">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <SectionHeading
              eyebrow="Tournament showcase"
              title="Live cards that feel ready to play"
              description="Preview slots, prize pools, status, and game identity in a mobile-friendly tournament stream."
            />
            <Button asChild variant="soft">
              <Link to="/login">
                Browse tournaments
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="arena-scrollbar mt-8 flex gap-4 overflow-x-auto pb-3">
            {tournaments.map((tournament) => (
              <motion.article
                key={tournament.title}
                whileHover={reduce ? undefined : { y: -4 }}
                className="w-[290px] shrink-0 overflow-hidden rounded-lg border border-glass-border bg-card/75"
              >
                <div className="relative h-40">
                  <img src={tournament.image} alt={tournament.title} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
                  <span className={`absolute left-3 top-3 rounded-full border px-2.5 py-1 font-heading text-[10px] font-bold ${toneClasses[tournament.tone]}`}>
                    {tournament.status}
                  </span>
                </div>
                <div className="p-4">
                  <p className="font-heading text-lg font-bold">{tournament.title}</p>
                  <p className="text-xs text-muted-foreground">{tournament.game}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-background/50 p-3">
                      <p className="text-[10px] text-muted-foreground">Prize</p>
                      <p className="font-heading text-sm font-bold text-accent">{tournament.prize}</p>
                    </div>
                    <div className="rounded-lg bg-background/50 p-3">
                      <p className="text-[10px] text-muted-foreground">Slots</p>
                      <p className="font-heading text-sm font-bold">{tournament.slots}</p>
                    </div>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </MotionSection>

        <MotionSection id="creators" className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-5 lg:px-6">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <SectionHeading
                eyebrow="Creator mode"
                title="Host tournaments with control"
                description="Creators get dashboard tools for tournament setup, room sharing, moderation, winner payouts, and follower engagement."
              />
              <div className="mt-6 grid gap-3">
                {[
                  { icon: LockKeyhole, title: "Room ID/password push", text: "Send match credentials to joined players in realtime." },
                  { icon: ShieldCheck, title: "Player moderation", text: "Ban, report, remove, and review abusive tournament players." },
                  { icon: Gift, title: "Reward management", text: "Distribute prizes and track winner payout history." },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <LandingCard key={item.title} className="flex items-center gap-4 p-4">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="font-heading text-sm font-bold">{item.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.text}</p>
                      </div>
                    </LandingCard>
                  );
                })}
              </div>
            </div>
            <LandingCard className="overflow-hidden p-4">
              <div className="rounded-lg border border-glass-border bg-background/55 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-heading text-sm font-bold">Creator Dashboard</p>
                    <p className="text-xs text-muted-foreground">Room system preview</p>
                  </div>
                  <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 font-heading text-[10px] font-bold text-accent">Ready</span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {[
                    ["Room ID", "B4A-8842"],
                    ["Password", "7XQ2"],
                    ["Joined", "41 players"],
                    ["Prize", "Rs. 8,000"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-glass-border bg-card/70 p-4">
                      <p className="font-heading text-[10px] uppercase text-muted-foreground">{label}</p>
                      <p className="mt-1 font-heading text-lg font-bold">{value}</p>
                    </div>
                  ))}
                </div>
                <Button className="mt-4 w-full">
                  <BellRing className="h-4 w-4" />
                  Push room notification
                </Button>
              </div>
            </LandingCard>
          </div>
        </MotionSection>

        <MotionSection className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-5 lg:px-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <LandingCard className="p-5 sm:p-6">
              <SectionHeading
                eyebrow="Leaderboard"
                title="Prize stats that keep players grinding"
                description="Showcase winners, earnings, top players, and performance signals with clean hierarchy."
              />
              <div className="mt-6 space-y-3">
                {leaderboard.map((player) => (
                  <div key={player.rank} className="flex items-center gap-3 rounded-lg border border-glass-border bg-background/45 p-3">
                    <span className="grid h-10 w-10 place-items-center rounded-lg border border-secondary/25 bg-secondary/10 font-display text-sm font-black text-secondary">
                      {player.rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-heading text-sm font-bold">{player.name}</p>
                      <p className="text-xs text-muted-foreground">{player.tag}</p>
                    </div>
                    <p className="font-heading text-sm font-bold text-accent">{player.amount}</p>
                  </div>
                ))}
              </div>
            </LandingCard>

            <LandingCard className="p-5 sm:p-6">
              <SectionHeading
                eyebrow="Realtime engine"
                title="Socket.IO-style live experience"
                description="Notifications, tournament creation, wallet events, and room credentials feel alive across web and mobile."
              />
              <div className="mt-6 space-y-3">
                {realtimeFeed.map((item) => {
                  const Icon = item.icon;
                  return (
                    <motion.div
                      key={item.title}
                      animate={reduce ? undefined : { x: [0, 4, 0] }}
                      transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                      className="flex items-center gap-3 rounded-lg border border-glass-border bg-background/45 p-3"
                    >
                      <span className="grid h-10 w-10 place-items-center rounded-lg border border-accent/25 bg-accent/10 text-accent">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-heading text-sm font-bold">{item.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </LandingCard>
          </div>
        </MotionSection>

        <MotionSection className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-5 lg:px-6">
          <SectionHeading
            eyebrow="Community"
            title="Built for players, squads, and creators"
            description="Modern community-style cards for trust, conversion, and quick product clarity."
            align="center"
          />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {testimonials.map((item) => (
              <LandingCard key={item.name} className="p-5">
                <div className="mb-4 flex gap-1 text-accent">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={index} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="text-sm leading-6 text-muted-foreground">"{item.text}"</p>
                <div className="mt-5 flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-lg border border-primary/25 bg-primary/10 font-heading font-bold text-primary">
                    {item.name.slice(0, 1)}
                  </span>
                  <div>
                    <p className="font-heading text-sm font-bold">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.role}</p>
                  </div>
                </div>
              </LandingCard>
            ))}
          </div>
        </MotionSection>

        <MotionSection id="faq" className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-5 lg:px-6">
          <SectionHeading
            eyebrow="FAQ"
            title="Questions before you enter?"
            description="Clear answers for players, creators, APK users, and tournament organizers."
            align="center"
          />
          <LandingCard className="mt-8 p-2">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((item, index) => (
                <AccordionItem key={item.question} value={`item-${index}`} className="border-glass-border px-4">
                  <AccordionTrigger className="font-heading text-sm font-bold hover:no-underline">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-6 text-muted-foreground">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </LandingCard>
        </MotionSection>
      </main>

      <footer className="border-t border-glass-border bg-background/88">
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-5 md:grid-cols-[1fr_auto] lg:px-6">
          <div>
            <p className="font-display text-xl font-black">BATTLE4ARENA</p>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground">
              Premium esports tournaments, creator tools, realtime notifications, wallet rewards, and APK-ready mobile gaming.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={apkHref}>
                <Download className="h-4 w-4" />
                APK
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <a href="#faq">
                <Headphones className="h-4 w-4" />
                Support
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <a href="#faq">Privacy</a>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <a href="#faq">Rules</a>
            </Button>
            <Button variant="ghost" size="sm">
              <MessageCircle className="h-4 w-4" />
              Community
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
