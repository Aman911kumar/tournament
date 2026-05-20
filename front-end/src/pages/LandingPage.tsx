import { lazy, Suspense, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  Trophy,
  Wallet,
  Bell,
  MessagesSquare,
  Crown,
  Radio,
  Shield,
  Users,
  Swords,
  Gamepad2,
  Download,
  ChevronRight,
  Star,
  Zap,
  Flame,
  CheckCircle2,
  Menu,
  X,
  Smartphone,
  Twitter,
  Youtube,
  Instagram,
  Github,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import heroBg from "@/assets/hero-bg.jpg";
import gameFreefire from "@/assets/game-freefire.jpg";
import gameBgmi from "@/assets/game-bgmi.jpg";
import gameValorant from "@/assets/game-valorant.jpg";
import gameCod from "@/assets/game-cod.jpg";
/* ---------- Reusable bits ---------- */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const Section = ({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) => (
  <motion.section
    id={id}
    variants={stagger}
    initial="hidden"
    whileInView="show"
    viewport={{ once: true, amount: 0.15 }}
    className={cn("relative max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-28", className)}
  >
    {children}
  </motion.section>
);
const SectionTag = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    variants={fadeUp}
    className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-[11px] font-heading uppercase tracking-[0.2em] text-primary mb-4"
  >
    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-glow-pulse" />
    {children}
  </motion.div>
);
const SectionTitle = ({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: string;
}) => (
  <div className="text-center mb-12 md:mb-16">
    <SectionTag>{eyebrow}</SectionTag>
    <motion.h2
      variants={fadeUp}
      className="font-display text-3xl md:text-5xl font-extrabold tracking-tight"
    >
      {title}
    </motion.h2>
    {subtitle && (
      <motion.p
        variants={fadeUp}
        className="mt-4 text-sm md:text-base text-muted-foreground max-w-2xl mx-auto font-body"
      >
        {subtitle}
      </motion.p>
    )}
  </div>
);
/* ---------- Background ---------- */
const ArenaBackground = () => (
  <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
    {/* base */}
    <div className="absolute inset-0 bg-background" />
    {/* grid */}
    <div
      className="absolute inset-0 opacity-[0.25]"
      style={{
        backgroundImage:
          "linear-gradient(hsl(var(--border)/0.6) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)/0.6) 1px, transparent 1px)",
        backgroundSize: "56px 56px",
        maskImage:
          "radial-gradient(ellipse at 50% 0%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)",
      }}
    />
    {/* color blobs */}
    <div className="absolute -top-32 -left-24 w-[36rem] h-[36rem] rounded-full bg-primary/20 blur-[120px]" />
    <div className="absolute top-1/3 -right-24 w-[30rem] h-[30rem] rounded-full bg-secondary/20 blur-[120px]" />
    <div className="absolute bottom-0 left-1/3 w-[26rem] h-[26rem] rounded-full bg-accent/10 blur-[120px]" />
    {/* scanline */}
    <div
      className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
      style={{
        backgroundImage:
          "repeating-linear-gradient(0deg, rgba(255,255,255,0.6) 0px, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 4px)",
      }}
    />
  </div>
);
/* ---------- Nav ---------- */
const NAV_LINKS = [
  { label: "Tournaments", href: "#tournaments" },
  { label: "Features", href: "#features" },
  { label: "Creators", href: "#creators" },
  { label: "Download", href: "#download" },
  { label: "FAQ", href: "#faq" },
];
const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        scrolled ? "py-2" : "py-4"
      )}
    >
      <div className="max-w-6xl mx-auto px-4">
        <nav
          className={cn(
            "flex items-center justify-between rounded-2xl border px-4 md:px-5 py-2.5 transition-all duration-300",
            scrolled
              ? "border-glass-border bg-background/70 backdrop-blur-md shadow-[0_10px_40px_-20px_rgba(0,0,0,0.6)]"
              : "border-transparent bg-transparent"
          )}
        >
          <Link to="/landing" className="flex items-center gap-2">
            <span className="relative w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <Swords className="w-4 h-4 text-primary-foreground" />
            </span>
            <span className="font-display text-base font-extrabold tracking-widest neon-text-purple">
              BATTLE4ARENA
            </span>
          </Link>
          <ul className="hidden md:flex items-center gap-7">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="text-xs font-heading uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="hidden md:flex items-center gap-2">
            <Link
              to="/login"
              className="text-xs font-heading uppercase tracking-wider text-muted-foreground hover:text-foreground px-3 py-2"
            >
              Sign in
            </Link>
            <a
              href="#download"
              className="group inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-heading font-semibold uppercase tracking-wider text-primary-foreground neon-glow-purple transition-transform active:scale-[0.97]"
            >
              <Download className="w-3.5 h-3.5" />
              Get APK
            </a>
          </div>
          <button
            aria-label="Toggle menu"
            onClick={() => setOpen((v) => !v)}
            className="md:hidden w-9 h-9 rounded-lg border border-glass-border bg-card/60 flex items-center justify-center"
          >
            {open ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </nav>
        {open && (
          <div className="md:hidden mt-2 rounded-2xl border border-glass-border bg-background/90 backdrop-blur-md p-4">
            <ul className="flex flex-col gap-1">
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block px-3 py-2.5 rounded-lg text-sm font-heading text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Link
                to="/login"
                className="text-center text-xs font-heading uppercase tracking-wider rounded-lg border border-glass-border py-2.5"
              >
                Sign in
              </Link>
              <a
                href="#download"
                onClick={() => setOpen(false)}
                className="text-center text-xs font-heading uppercase tracking-wider rounded-lg bg-primary text-primary-foreground py-2.5 neon-glow-purple"
              >
                Get APK
              </a>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
/* ---------- Hero ---------- */
const HeroStats = [
  { k: "1.2M+", v: "Active Players" },
  { k: "48K+", v: "Tournaments" },
  { k: "Rs 12Cr+", v: "Prize Awarded" },
  { k: "99.9%", v: "Uptime" },
];
const Hero = () => {
  const reduce = useReducedMotion();
  return (
    <section className="relative pt-32 md:pt-40 pb-20 md:pb-28 px-5 md:px-8 max-w-6xl mx-auto">
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden rounded-[40px]">
        <img
          src={heroBg}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-30"
          width={1280}
          height={720}
          loading="lazy"
          decoding="async"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.32),transparent_55%),linear-gradient(180deg,hsl(var(--background)/0.92),hsl(var(--background)/0.55)_45%,hsl(var(--background)/0.92))]" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="text-center"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/30 bg-accent/5 text-[11px] font-heading uppercase tracking-[0.2em] text-accent mb-6">
          <Radio className="w-3 h-3 animate-glow-pulse" />
          Live Season 4 - Grand Championship Open
        </div>
        <h1 className="font-display text-4xl sm:text-6xl md:text-7xl font-black leading-[1.05] tracking-tight">
          <span className="block">Where Legends</span>
          <span className="block bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            Battle for Glory.
          </span>
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-sm md:text-lg text-muted-foreground font-body">
          The competitive home for mobile esports - host tournaments, climb leaderboards, win
          real cash prizes and rise through a community built for winners.
        </p>
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="#download"
            className="group inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-heading font-semibold uppercase tracking-wider text-primary-foreground neon-glow-purple transition-transform active:scale-[0.97]"
          >
            <Download className="w-4 h-4" />
            Download APK
            <ChevronRight className="w-4 h-4 -mr-1 transition-transform group-hover:translate-x-0.5" />
          </a>
          <a
            href="#tournaments"
            className="inline-flex items-center gap-2 rounded-xl border border-glass-border bg-card/40 backdrop-blur-sm px-6 py-3.5 text-sm font-heading font-semibold uppercase tracking-wider text-foreground hover:bg-card/70 transition-colors"
          >
            <Trophy className="w-4 h-4 text-accent" />
            Join Tournament
          </a>
        </div>
        {/* Stats row */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 max-w-4xl mx-auto"
        >
          {HeroStats.map((s) => (
            <motion.div
              key={s.v}
              variants={fadeUp}
              className="relative rounded-xl border border-glass-border bg-card/40 backdrop-blur-sm p-4 overflow-hidden"
            >
              <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
              <p className="font-display text-xl md:text-3xl font-extrabold">{s.k}</p>
              <p className="text-[11px] md:text-xs text-muted-foreground font-heading uppercase tracking-wider mt-1">
                {s.v}
              </p>
            </motion.div>
          ))}
        </motion.div>
        {/* Floating glow card */}
        {!reduce && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
            className="hidden md:block absolute left-6 top-44 w-56 rounded-xl border border-glass-border bg-card/60 backdrop-blur-md p-3"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                <Flame className="w-4 h-4 text-accent" />
              </div>
              <div className="text-left">
                <p className="text-[11px] font-heading uppercase tracking-wider text-muted-foreground">Live now</p>
                <p className="text-xs font-heading font-bold">BGMI - Ranked Cup</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Prize</span>
              <span className="font-heading font-bold text-accent">Rs 50,000</span>
            </div>
          </motion.div>
        )}
        {!reduce && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.7 }}
            className="hidden md:block absolute right-6 top-56 w-56 rounded-xl border border-glass-border bg-card/60 backdrop-blur-md p-3"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <Crown className="w-4 h-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-[11px] font-heading uppercase tracking-wider text-muted-foreground">Top creator</p>
                <p className="text-xs font-heading font-bold">@GamingGuru</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Rating</span>
              <span className="font-heading font-bold text-secondary inline-flex items-center gap-1">
                <Star className="w-3 h-3 fill-secondary" /> 4.9
              </span>
            </div>
          </motion.div>
        )}
      </motion.div>
    </section>
  );
};
/* ---------- Tournaments ---------- */
type TStatus = "LIVE" | "UPCOMING" | "FINISHED";
const TOURNAMENTS: {
  name: string;
  game: string;
  prize: string;
  slots: string;
  status: TStatus;
  fee: string;
}[] = [
  { name: "Pro League S4", game: "Free Fire", prize: "Rs 50,000", slots: "78/100", status: "LIVE", fee: "Free" },
  { name: "Battle Royale Cup", game: "BGMI", prize: "Rs 25,000", slots: "45/64", status: "UPCOMING", fee: "Rs 49" },
  { name: "Tactical Masters", game: "Valorant", prize: "Rs 15,000", slots: "20/32", status: "UPCOMING", fee: "Rs 29" },
  { name: "Warzone Classic", game: "Call of Duty", prize: "Rs 40,000", slots: "100/100", status: "FINISHED", fee: "Free" },
];
const statusStyle: Record<TStatus, string> = {
  LIVE: "bg-accent/20 text-accent border-accent/40",
  UPCOMING: "bg-primary/20 text-primary border-primary/40",
  FINISHED: "bg-muted text-muted-foreground border-border",
};
const TournamentsSection = () => (
  <Section id="tournaments">
    <SectionTitle
      eyebrow="Live Arena"
      title={
        <>
          Tournaments that <span className="text-primary neon-text-purple">never sleep</span>
        </>
      }
      subtitle="Discover live and upcoming tournaments across every major mobile esport. Join in seconds."
    />
    <motion.div variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {TOURNAMENTS.map((t) => (
        <motion.article
          key={t.name}
          variants={fadeUp}
          whileHover={{ y: -4 }}
          className="group relative rounded-2xl border border-glass-border bg-card/50 backdrop-blur-sm p-4 overflow-hidden"
        >
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center justify-between mb-3">
            <span
              className={cn(
                "text-[10px] font-heading uppercase tracking-wider px-2 py-0.5 rounded-full border",
                statusStyle[t.status]
              )}
            >
              {t.status === "LIVE" && "● "}
              {t.status}
            </span>
            <span className="text-[10px] text-muted-foreground font-heading uppercase">{t.fee}</span>
          </div>
          <h3 className="font-heading font-bold text-base">{t.name}</h3>
          <p className="text-xs text-muted-foreground">{t.game}</p>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground font-heading uppercase tracking-wider">Prize Pool</p>
              <p className="font-display font-extrabold text-lg text-accent neon-text-green">{t.prize}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground font-heading uppercase tracking-wider">Slots</p>
              <p className="font-heading font-semibold text-sm">{t.slots}</p>
            </div>
          </div>
        </motion.article>
      ))}
    </motion.div>
  </Section>
);
/* ---------- Features ---------- */
const FEATURES = [
  { icon: Trophy, title: "Tournaments", desc: "Create or join solo, duo, squad. Custom rules, slots, prize splits." },
  { icon: Wallet, title: "Secure Wallet", desc: "Instant deposits, withdrawals and audited transaction history." },
  { icon: Star, title: "Rewards", desc: "Win XP, badges and cash. Streaks, bonuses and seasonal drops." },
  { icon: Bell, title: "Realtime Alerts", desc: "Match starts, room codes and rank changes in real time." },
  { icon: MessagesSquare, title: "Room Chat", desc: "Private rooms with moderators, voice and quick reactions." },
  { icon: Crown, title: "Creator System", desc: "Organize tournaments, build a fanbase, earn from your community." },
  { icon: Radio, title: "Live Match Support", desc: "Stream overlays, spectators and watch-party rooms." },
  { icon: Users, title: "Leaderboards", desc: "Global, regional and friends. Climb and earn ranked rewards." },
  { icon: Shield, title: "Anti-Cheat & Moderation", desc: "Reports, evidence reviews and instant ban tools." },
];
const FeaturesSection = () => (
  <Section id="features">
    <SectionTitle
      eyebrow="Platform"
      title={
        <>
          Built for the way <span className="text-secondary">esports plays</span>
        </>
      }
      subtitle="Every piece of the competitive stack - payments, matchmaking, moderation and creators - in one app."
    />
    <motion.div
      variants={stagger}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      {FEATURES.map((f) => (
        <motion.div
          key={f.title}
          variants={fadeUp}
          whileHover={{ y: -3 }}
          className="group relative rounded-2xl border border-glass-border bg-card/40 backdrop-blur-sm p-5 overflow-hidden"
        >
          <div className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)/0.25), transparent 60%)" }} />
          <div className="relative w-11 h-11 rounded-xl border border-glass-border bg-gradient-to-br from-primary/15 to-secondary/10 flex items-center justify-center mb-4">
            <f.icon className="w-5 h-5 text-primary" />
          </div>
          <h3 className="font-heading font-bold text-base">{f.title}</h3>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{f.desc}</p>
        </motion.div>
      ))}
    </motion.div>
  </Section>
);
/* ---------- Creators ---------- */
const CreatorSection = () => (
  <Section id="creators">
    <div className="grid lg:grid-cols-2 gap-10 items-center">
      <div>
        <SectionTag>For Creators</SectionTag>
        <motion.h2 variants={fadeUp} className="font-display text-3xl md:text-5xl font-extrabold tracking-tight">
          Run pro-grade tournaments,{" "}
          <span className="text-primary neon-text-purple">earn from every match.</span>
        </motion.h2>
        <motion.p variants={fadeUp} className="mt-4 text-sm md:text-base text-muted-foreground">
          A complete organizer dashboard with room ID/password management, moderation tools,
          revenue reporting and audience growth - without leaving the app.
        </motion.p>
        <motion.ul variants={stagger} className="mt-6 space-y-3">
          {[
            "Secure room code distribution to verified players",
            "Built-in moderation, reports and warnings",
            "Automated prize distribution to player wallets",
            "Realtime revenue & engagement analytics",
          ].map((t) => (
            <motion.li key={t} variants={fadeUp} className="flex items-start gap-3 text-sm">
              <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 shrink-0" />
              <span className="text-muted-foreground">{t}</span>
            </motion.li>
          ))}
        </motion.ul>
        <motion.div variants={fadeUp} className="mt-7">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-xl bg-secondary px-5 py-3 text-xs font-heading font-semibold uppercase tracking-wider text-secondary-foreground neon-glow-blue"
          >
            Become a Creator <ChevronRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
      {/* Mock dashboard */}
      <motion.div variants={fadeUp} className="relative">
        <div className="absolute inset-0 -m-6 rounded-3xl bg-gradient-to-tr from-primary/20 via-secondary/10 to-transparent blur-2xl" />
        <div className="relative rounded-2xl border border-glass-border bg-card/70 backdrop-blur-md p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-heading uppercase tracking-wider text-muted-foreground">Creator Dashboard</p>
              <h3 className="font-heading font-bold text-base">Pro League S4</h3>
            </div>
            <span className="text-[10px] font-heading uppercase px-2 py-0.5 rounded-full border border-accent/40 bg-accent/10 text-accent">
              ● LIVE
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-5">
            {[
              { l: "Players", v: "78/100" },
              { l: "Revenue", v: "Rs 14,200" },
              { l: "Reports", v: "2" },
            ].map((s) => (
              <div key={s.l} className="rounded-xl border border-glass-border bg-background/40 p-3">
                <p className="text-[10px] text-muted-foreground font-heading uppercase tracking-wider">{s.l}</p>
                <p className="font-display font-extrabold text-lg">{s.v}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-glass-border bg-background/40 p-3">
            <p className="text-[10px] text-muted-foreground font-heading uppercase tracking-wider mb-2">Room Access</p>
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono">ID 482910 - PW arena#4</span>
              <span className="text-accent text-[11px] font-heading">Distributed</span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-glass-border bg-background/40 p-3">
              <p className="text-[10px] text-muted-foreground font-heading uppercase tracking-wider">Engagement</p>
              <div className="mt-2 h-8 rounded bg-gradient-to-r from-primary/30 via-secondary/30 to-accent/30 overflow-hidden">
                <div className="h-full w-3/4 gradient-primary" />
              </div>
            </div>
            <div className="rounded-xl border border-glass-border bg-background/40 p-3">
              <p className="text-[10px] text-muted-foreground font-heading uppercase tracking-wider">Payouts</p>
              <p className="font-display font-extrabold text-lg text-accent">Rs 38,500</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  </Section>
);
/* ---------- Realtime ---------- */
const RealtimeFeed = [
  { icon: Trophy, t: "GhostSniper won 1st in BGMI Cup", c: "+Rs 5,000 credited", time: "now" },
  { icon: Radio, t: "Room code released for Pro League", c: "ID 482910", time: "1m" },
  { icon: Bell, t: "Match starts in 5 minutes", c: "Solo Showdown", time: "3m" },
  { icon: MessagesSquare, t: "Moderator pinned rules", c: "#team-alpha", time: "6m" },
];
const RealtimeSection = () => (
  <Section>
    <div className="grid lg:grid-cols-2 gap-10 items-center">
      <motion.div variants={fadeUp} className="relative order-2 lg:order-1">
        <div className="rounded-2xl border border-glass-border bg-card/70 backdrop-blur-md p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-heading uppercase tracking-wider text-muted-foreground">Live Feed</p>
            <span className="inline-flex items-center gap-1 text-[10px] font-heading text-accent">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-glow-pulse" /> Realtime
            </span>
          </div>
          <ul className="space-y-2">
            {RealtimeFeed.map((f, i) => (
              <motion.li
                key={f.t}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center gap-3 p-3 rounded-xl border border-glass-border bg-background/40"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                  <f.icon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-heading font-semibold truncate">{f.t}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{f.c}</p>
                </div>
                <span className="text-[10px] text-muted-foreground">{f.time}</span>
              </motion.li>
            ))}
          </ul>
        </div>
      </motion.div>
      <div className="order-1 lg:order-2">
        <SectionTag>Realtime</SectionTag>
        <motion.h2 variants={fadeUp} className="font-display text-3xl md:text-5xl font-extrabold tracking-tight">
          Every match, every move -{" "}
          <span className="text-accent neon-text-green">in real time.</span>
        </motion.h2>
        <motion.p variants={fadeUp} className="mt-4 text-sm md:text-base text-muted-foreground">
          Socket-powered notifications, instant room codes, live chat and match activity keep
          every player in sync. No refreshing. No waiting.
        </motion.p>
        <motion.div variants={stagger} className="mt-6 grid grid-cols-3 gap-3">
          {[
            { k: "<60ms", v: "Latency" },
            { k: "24/7", v: "Live Ops" },
            { k: "5M+", v: "Events/day" },
          ].map((s) => (
            <motion.div
              key={s.v}
              variants={fadeUp}
              className="rounded-xl border border-glass-border bg-card/40 backdrop-blur-sm p-3 text-center"
            >
              <p className="font-display text-lg font-extrabold">{s.k}</p>
              <p className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground">{s.v}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  </Section>
);
/* ---------- APK Download ---------- */
const DownloadSection = () => (
  <Section id="download">
    <motion.div
      variants={fadeUp}
      className="relative overflow-hidden rounded-3xl border border-glass-border bg-gradient-to-br from-primary/15 via-card/80 to-secondary/15 p-6 md:p-12"
    >
      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-primary/30 blur-3xl" />
      <div className="absolute -bottom-20 -left-10 w-72 h-72 rounded-full bg-secondary/20 blur-3xl" />
      <div className="relative grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <SectionTag>Android - Beta</SectionTag>
          <h2 className="font-display text-3xl md:text-5xl font-extrabold tracking-tight">
            Take the arena{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              everywhere.
            </span>
          </h2>
          <p className="mt-4 text-sm md:text-base text-muted-foreground max-w-md">
            Lightweight. Optimized for low-end Android. Battery friendly. Built for one-handed
            competitive play.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <a
              href="#"
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-heading font-semibold uppercase tracking-wider text-primary-foreground neon-glow-purple"
            >
              <Download className="w-4 h-4" /> Download APK
            </a>
            <a
              href="#"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-glass-border bg-card/60 backdrop-blur-sm px-6 py-3.5 text-sm font-heading font-semibold uppercase tracking-wider hover:bg-card/80"
            >
              <Smartphone className="w-4 h-4" /> Install Guide
            </a>
          </div>
          <ul className="mt-6 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-accent" /> Android 7+ supported</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-accent" /> ~22 MB lightweight</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-accent" /> Optimized for 2GB RAM</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-accent" /> Verified by SHA-256</li>
          </ul>
        </div>
        {/* Phone mock */}
        <motion.div variants={fadeUp} className="relative mx-auto w-[240px] h-[480px]">
          <div className="absolute inset-0 rounded-[42px] border border-glass-border bg-background shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]" />
          <div className="absolute inset-2 rounded-[36px] overflow-hidden bg-gradient-to-b from-card to-background">
            <div className="h-6 flex justify-center items-center">
              <span className="w-16 h-1.5 rounded-full bg-muted" />
            </div>
            <div className="px-3 pt-3 pb-2">
              <p className="font-display text-xs font-extrabold tracking-widest neon-text-purple">BATTLE4ARENA</p>
              <p className="text-[10px] text-muted-foreground font-heading">Welcome back, Warrior</p>
            </div>
            <div className="mx-3 my-2 p-3 rounded-xl border border-glass-border bg-card/60">
              <p className="text-[10px] font-heading uppercase text-accent">
                <span className="mr-1">●</span>
                LIVE
              </p>
              <p className="font-heading font-bold text-xs mt-1">Grand Championship</p>
              <p className="text-[10px] text-muted-foreground">Rs 1,00,000 - 256 players</p>
            </div>
            <div className="mx-3 grid grid-cols-2 gap-2">
              {[
                { name: "Free Fire", img: gameFreefire },
                { name: "BGMI", img: gameBgmi },
                { name: "Valorant", img: gameValorant },
                { name: "COD", img: gameCod },
              ].map((g) => (
                <div
                  key={g.name}
                  className="relative aspect-square overflow-hidden rounded-lg border border-glass-border bg-card/50"
                >
                  <img
                    src={g.img}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-80"
                    loading="lazy"
                    decoding="async"
                    width={256}
                    height={256}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/35 to-transparent" />
                  <span className="relative z-10 flex h-full items-end p-2 text-[10px] font-heading font-semibold text-foreground">
                    {g.name}
                  </span>
                </div>
              ))}
            </div>
            <div className="mx-3 mt-3 p-2 rounded-lg bg-primary text-primary-foreground text-center text-[10px] font-heading uppercase tracking-wider">
              Join Tournament
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  </Section>
);
/* ---------- Community / Stats ---------- */
const CommunitySection = () => (
  <Section>
    <SectionTitle
      eyebrow="Community"
      title={
        <>
          Trusted by <span className="text-primary neon-text-purple">a million warriors</span>
        </>
      }
    />
    <motion.div variants={stagger} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[
        { name: "Aarav S.", role: "Pro Player - BGMI", text: "Cleanest tournament app I've used. Payouts are instant." },
        { name: "Riya M.", role: "Creator - 18K fans", text: "Running weekly cups is finally effortless. Mod tools are top-tier." },
        { name: "Karan V.", role: "Free Fire Squad", text: "Lag-free room joins and clear rules. We grind every night." },
      ].map((r) => (
        <motion.figure
          key={r.name}
          variants={fadeUp}
          className="rounded-2xl border border-glass-border bg-card/40 backdrop-blur-sm p-5"
        >
          <div className="flex items-center gap-1 text-accent mb-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="w-3.5 h-3.5 fill-accent" />
            ))}
          </div>
          <blockquote className="text-sm text-foreground/90 font-body">"{r.text}"</blockquote>
          <figcaption className="mt-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center">
              <span className="font-display font-bold text-sm text-primary-foreground">{r.name[0]}</span>
            </div>
            <div>
              <p className="text-xs font-heading font-bold">{r.name}</p>
              <p className="text-[10px] text-muted-foreground">{r.role}</p>
            </div>
          </figcaption>
        </motion.figure>
      ))}
    </motion.div>
  </Section>
);
/* ---------- Leaderboard ---------- */
const LEADERS = [
  { rank: 1, name: "GhostSniper", points: 9420, prize: "Rs 50,000", tag: "Champion" },
  { rank: 2, name: "NeonRanger", points: 8890, prize: "Rs 25,000", tag: "Elite" },
  { rank: 3, name: "PhantomX", points: 8210, prize: "Rs 15,000", tag: "Elite" },
  { rank: 4, name: "ZeroCool", points: 7780, prize: "Rs 8,000", tag: "Pro" },
  { rank: 5, name: "ArenaQueen", points: 7510, prize: "Rs 5,000", tag: "Pro" },
];
const LeaderboardSection = () => (
  <Section>
    <SectionTitle
      eyebrow="Leaderboard"
      title={
        <>
          The <span className="text-accent neon-text-green">grind</span> is real
        </>
      }
      subtitle="Live season rankings update every match. Rise, dominate, get paid."
    />
    <motion.div
      variants={fadeUp}
      className="rounded-2xl border border-glass-border bg-card/50 backdrop-blur-sm overflow-hidden"
    >
      <div className="grid grid-cols-12 px-4 py-3 text-[10px] font-heading uppercase tracking-wider text-muted-foreground border-b border-glass-border">
        <div className="col-span-1">#</div>
        <div className="col-span-5">Player</div>
        <div className="col-span-3 text-right">Points</div>
        <div className="col-span-3 text-right">Prize</div>
      </div>
      {LEADERS.map((p, i) => (
        <motion.div
          key={p.name}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.05 }}
          className="grid grid-cols-12 items-center px-4 py-3 border-b border-glass-border/60 last:border-0 hover:bg-muted/20 transition-colors"
        >
          <div className="col-span-1">
            <span
              className={cn(
                "inline-flex w-6 h-6 rounded-md items-center justify-center font-display font-bold text-xs",
                p.rank === 1 && "bg-accent/20 text-accent",
                p.rank === 2 && "bg-secondary/20 text-secondary",
                p.rank === 3 && "bg-primary/20 text-primary",
                p.rank > 3 && "bg-muted text-muted-foreground"
              )}
            >
              {p.rank}
            </span>
          </div>
          <div className="col-span-5 flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center shrink-0">
              <span className="font-display font-bold text-xs text-primary-foreground">{p.name[0]}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-heading font-semibold truncate">{p.name}</p>
              <p className="text-[10px] text-muted-foreground">{p.tag}</p>
            </div>
          </div>
          <div className="col-span-3 text-right font-heading text-sm">{p.points.toLocaleString()}</div>
          <div className="col-span-3 text-right font-display font-extrabold text-accent">{p.prize}</div>
        </motion.div>
      ))}
    </motion.div>
  </Section>
);
/* ---------- FAQ ---------- */
const FAQ = [
  { q: "Is Battle4Arena free to use?", a: "Yes - joining and creating an account is free. Some tournaments may have entry fees set by their organizers, but plenty of free events run daily." },
  { q: "How fast are withdrawals?", a: "Most withdrawals complete within minutes to your linked UPI/bank account. Larger payouts may require quick KYC verification." },
  { q: "Which games are supported?", a: "Free Fire, BGMI, Call of Duty Mobile and Valorant Mobile, with more titles being added every season." },
  { q: "Is the platform fair?", a: "We use device-fingerprint anti-cheat, screenshot validation, mod review and automatic ban enforcement to keep matches fair." },
  { q: "Can I become a creator/organizer?", a: "Absolutely. Apply from your profile and unlock the creator dashboard to run paid tournaments and grow your fanbase." },
];
const FaqSection = () => (
  <Section id="faq">
    <SectionTitle
      eyebrow="FAQ"
      title={
        <>
          Questions, <span className="text-secondary">answered.</span>
        </>
      }
    />
    <motion.div variants={fadeUp} className="max-w-3xl mx-auto">
      <Accordion type="single" collapsible className="space-y-3">
        {FAQ.map((item, i) => (
          <AccordionItem
            key={item.q}
            value={`q-${i}`}
            className="rounded-xl border border-glass-border bg-card/50 backdrop-blur-sm px-4"
          >
            <AccordionTrigger className="text-left font-heading text-sm font-semibold hover:no-underline">
              {item.q}
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
              {item.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </motion.div>
  </Section>
);
/* ---------- Footer ---------- */
const Footer = () => (
  <footer className="relative border-t border-glass-border mt-10">
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-12 grid md:grid-cols-4 gap-8">
      <div className="md:col-span-2">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
            <Swords className="w-4 h-4 text-primary-foreground" />
          </span>
          <span className="font-display text-base font-extrabold tracking-widest neon-text-purple">
            BATTLE4ARENA
          </span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground max-w-md">
          The competitive home for mobile esports. Built by gamers, for gamers.
        </p>
        <div className="mt-4 flex gap-2">
          {[Twitter, Youtube, Instagram, Github].map((Icon, i) => (
            <a
              key={i}
              href="#"
              aria-label="social"
              className="w-9 h-9 rounded-lg border border-glass-border bg-card/40 flex items-center justify-center hover:bg-card/70 transition-colors"
            >
              <Icon className="w-4 h-4 text-muted-foreground" />
            </a>
          ))}
        </div>
      </div>
      {[
        { title: "Product", links: ["Tournaments", "Wallet", "Leaderboards", "Download APK"] },
        { title: "Company", links: ["About", "Support", "Terms", "Privacy"] },
      ].map((col) => (
        <div key={col.title}>
          <p className="text-[11px] font-heading uppercase tracking-wider text-muted-foreground mb-3">
            {col.title}
          </p>
          <ul className="space-y-2">
            {col.links.map((l) => (
              <li key={l}>
                <a href="#" className="text-sm text-foreground/80 hover:text-primary transition-colors">
                  {l}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
    <div className="border-t border-glass-border">
      <div className="max-w-6xl mx-auto px-5 md:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <p>(c) {new Date().getFullYear()} Battle4Arena. All rights reserved.</p>
        <p className="font-heading uppercase tracking-wider">Game on. <span className="text-primary">Win big.</span></p>
      </div>
    </div>
  </footer>
);
/* ---------- Page ---------- */
const Landing = () => {
  useEffect(() => {
    document.title = "Battle4Arena - Mobile Esports Tournaments, Prizes & Live Arena";
    const desc = "Join Battle4Arena: live mobile esports tournaments, instant wallet, creator tools and real cash prizes. Download the Android APK.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);
  }, []);
  return (
    <div className="min-h-screen text-foreground overflow-x-hidden">
      <ArenaBackground />
      <Navbar />
      <main>
        <Hero />
        <TournamentsSection />
        <FeaturesSection />
        <CreatorSection />
        <RealtimeSection />
        <DownloadSection />
        <CommunitySection />
        <LeaderboardSection />
        <FaqSection />
      </main>
      <Footer />
    </div>
  );
};
export default Landing;
