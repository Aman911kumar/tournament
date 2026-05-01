import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Star, Shield, Bell, BellOff, Search } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import BottomNav from "@/components/BottomNav";

const subscribedCreators = [
  { id: "c1", name: "GamingGuru", followers: "12.5K", tournaments: 48, rating: 4.8, verified: true, notif: true },
  { id: "c2", name: "ESportsKing", followers: "8.2K", tournaments: 32, rating: 4.6, verified: true, notif: true },
  { id: "c4", name: "ArenaQueen", followers: "15K", tournaments: 56, rating: 4.9, verified: true, notif: false },
];

const suggestedCreators = [
  { id: "c3", name: "ProHostX", followers: "5.1K", tournaments: 21, rating: 4.3, verified: false },
  { id: "c5", name: "TurboGamer", followers: "3.8K", tournaments: 15, rating: 4.1, verified: false },
];

const SubscriptionsScreen = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const filteredSubs = subscribedCreators.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 pt-6 pb-4 flex items-center gap-3">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <h1 className="font-heading text-xl font-bold">Subscriptions</h1>
      </div>

      {/* Search */}
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 mb-4">
        <div className="glass rounded-lg flex items-center gap-2 px-3 py-2.5">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search creators..."
            className="bg-transparent text-sm font-heading flex-1 focus:outline-none placeholder:text-muted-foreground/50"
          />
        </div>
      </div>

      {/* Following */}
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 mb-5">
        <h2 className="font-heading text-sm font-bold text-muted-foreground mb-3">
          FOLLOWING ({filteredSubs.length})
        </h2>
        <div className="space-y-3">
          {filteredSubs.length === 0 && (
            <GlassCard className="text-center py-8">
              <Search className="w-9 h-9 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-heading">No creators found</p>
              <p className="text-xs text-muted-foreground mt-1">Try a different search.</p>
            </GlassCard>
          )}

          {filteredSubs.map((c, i) => (
            <GlassCard key={c.id} neon delay={i * 0.08}>
              <div className="flex items-center gap-3">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate(`/creator/${c.id}`)}
                  className="relative shrink-0"
                >
                  <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center">
                    <span className="font-display text-sm font-bold text-primary-foreground">{c.name[0]}</span>
                  </div>
                  {c.verified && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-secondary flex items-center justify-center">
                      <Shield className="w-2.5 h-2.5 text-secondary-foreground fill-secondary-foreground" />
                    </div>
                  )}
                </motion.button>
                <div className="flex-1 min-w-0" onClick={() => navigate(`/creator/${c.id}`)}>
                  <p className="font-heading font-bold text-sm truncate">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {c.followers} followers - {c.tournaments} tournaments
                  </p>
                  <div className="flex items-center gap-0.5 mt-0.5">
                    <Star className="w-2.5 h-2.5 text-accent fill-accent" />
                    <span className="text-[10px] text-accent font-heading">{c.rating}</span>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  className="w-8 h-8 glass rounded-full flex items-center justify-center"
                >
                  {c.notif ? (
                    <Bell className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <BellOff className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </motion.button>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* Suggested */}
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5">
        <h2 className="font-heading text-sm font-bold text-muted-foreground mb-3">SUGGESTED FOR YOU</h2>
        <div className="space-y-3">
          {suggestedCreators.map((c, i) => (
            <GlassCard key={c.id} delay={i * 0.08}>
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0 cursor-pointer"
                  onClick={() => navigate(`/creator/${c.id}`)}
                >
                  <span className="font-display text-sm font-bold text-muted-foreground">{c.name[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-bold text-sm truncate">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground">{c.followers} followers</p>
                </div>
                <NeonButton variant="purple" className="text-[10px] py-1.5 px-3">
                  Follow
                </NeonButton>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default SubscriptionsScreen;
