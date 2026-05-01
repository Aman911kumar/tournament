import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Star, Users, Trophy, Calendar, Shield, Flag, MessageCircle } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import BottomNav from "@/components/BottomNav";

const creatorsData: Record<string, {
  name: string; bio: string; followers: string; rating: number; verified: boolean;
  totalTournaments: number; totalPrize: string;
  tournaments: { id: number; name: string; game: string; prize: string; date: string; status: string }[];
  reviews: { user: string; rating: number; comment: string }[];
}> = {
  c1: {
    name: "GamingGuru",
    bio: "India's #1 Free Fire tournament host. 3 years of eSports experience. Fair play guaranteed!",
    followers: "12,500",
    rating: 4.8,
    verified: true,
    totalTournaments: 48,
    totalPrize: "Rs. 5,00,000",
    tournaments: [
      { id: 1, name: "Pro League S4", game: "Free Fire", prize: "Rs. 50,000", date: "Apr 15, 2026", status: "open" },
      { id: 5, name: "Weekend Clash", game: "Free Fire", prize: "Rs. 10,000", date: "Apr 20, 2026", status: "open" },
      { id: 6, name: "Duo Showdown", game: "BGMI", prize: "Rs. 20,000", date: "Apr 22, 2026", status: "upcoming" },
    ],
    reviews: [
      { user: "ShadowX", rating: 5, comment: "Best host ever! Always on time and fair." },
      { user: "BlazeFire", rating: 4, comment: "Good tournaments, great prizes." },
      { user: "NinjaRed", rating: 5, comment: "Smooth experience, will join again!" },
    ],
  },
  c2: {
    name: "ESportsKing",
    bio: "Professional BGMI tournament organizer. 500+ tournaments hosted. Official partner.",
    followers: "8,200",
    rating: 4.6,
    verified: true,
    totalTournaments: 32,
    totalPrize: "Rs. 3,50,000",
    tournaments: [
      { id: 2, name: "Battle Royale Masters", game: "BGMI", prize: "Rs. 1,00,000", date: "Apr 16, 2026", status: "open" },
    ],
    reviews: [
      { user: "StormRider", rating: 5, comment: "Incredible prize pools!" },
      { user: "Phantom", rating: 4, comment: "Well organized events." },
    ],
  },
};

const defaultCreator = creatorsData.c1;

const CreatorProfileScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState<"tournaments" | "reviews">("tournaments");

  const creator = creatorsData[id || "c1"] || defaultCreator;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 pt-6 pb-4 flex items-center gap-3">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <h1 className="font-heading text-xl font-bold">Creator Profile</h1>
      </div>

      {/* Banner + Profile */}
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 mb-4">
        <div className="relative rounded-xl overflow-hidden">
          <div className="h-28 gradient-neon opacity-60" />
          <div className="absolute -bottom-8 left-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center border-4 border-background neon-glow-purple">
                <span className="font-display text-2xl font-bold text-primary-foreground">
                  {creator.name[0]}
                </span>
              </div>
              {creator.verified && (
                <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-secondary flex items-center justify-center border-2 border-background">
                  <Shield className="w-3 h-3 text-secondary-foreground fill-secondary-foreground" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Creator Info */}
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 mt-10 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-lg font-bold">{creator.name}</h2>
              {creator.verified && (
                <span className="text-[10px] font-heading font-semibold px-2 py-0.5 rounded-full bg-secondary/20 text-secondary">
                  Verified
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-body mt-1 max-w-[240px]">{creator.bio}</p>
          </div>
          <div className="flex gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              className="w-8 h-8 glass rounded-full flex items-center justify-center"
            >
              <Flag className="w-3.5 h-3.5 text-muted-foreground" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              className="w-8 h-8 glass rounded-full flex items-center justify-center"
            >
              <MessageCircle className="w-3.5 h-3.5 text-muted-foreground" />
            </motion.button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[
            { label: "Followers", value: creator.followers },
            { label: "Tournaments", value: String(creator.totalTournaments) },
            { label: "Total Prize", value: creator.totalPrize },
            { label: "Rating", value: creator.rating },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="glass rounded-lg p-2 text-center"
            >
              <p className="text-xs font-heading font-bold text-foreground">{s.value}</p>
              <p className="text-[9px] text-muted-foreground">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Follow Button */}
        <div className="mt-4">
          <NeonButton
            full
            variant={isFollowing ? "blue" : "purple"}
            className="text-xs py-2.5"
            onClick={() => setIsFollowing(!isFollowing)}
          >
            {isFollowing ? "FOLLOWING" : "FOLLOW CREATOR"}
          </NeonButton>
        </div>
      </div>

      {/* Tabs */}
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 mb-3 flex gap-2">
        {(["tournaments", "reviews"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-full text-xs font-heading font-medium capitalize transition-colors ${
              activeTab === tab
                ? "bg-primary text-primary-foreground neon-glow-purple"
                : "glass text-muted-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 space-y-3">
        {activeTab === "tournaments" &&
          creator.tournaments.map((t, i) => (
            <GlassCard key={t.id} neon delay={i * 0.1} onClick={() => navigate(`/tournament/${t.id}`)}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-heading font-bold text-sm">{t.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {t.game} - {t.date}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-heading font-bold text-accent neon-text-green">{t.prize}</p>
                  <span
                    className={`text-[10px] font-heading font-semibold px-2 py-0.5 rounded-full ${
                      t.status === "open"
                        ? "bg-accent/20 text-accent"
                        : "bg-secondary/20 text-secondary"
                    }`}
                  >
                    {t.status === "open" ? "Open" : "Upcoming"}
                  </span>
                </div>
              </div>
            </GlassCard>
          ))}

        {activeTab === "reviews" &&
          creator.reviews.map((r, i) => (
            <GlassCard key={i} delay={i * 0.1}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-[10px] font-heading font-bold">{r.user[0]}</span>
                </div>
                <p className="font-heading font-bold text-xs">{r.user}</p>
                <div className="flex items-center gap-0.5 ml-auto">
                  {Array.from({ length: r.rating }).map((_, j) => (
                    <Star key={j} className="w-3 h-3 text-accent fill-accent" />
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground font-body">{r.comment}</p>
            </GlassCard>
          ))}
      </div>

      <BottomNav />
    </div>
  );
};

export default CreatorProfileScreen;
