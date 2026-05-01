import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Bell, Search, ChevronRight, Flame, Zap, Star, Users, Crown } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import BottomNav from "@/components/BottomNav";

import gameFreefire from "@/assets/game-freefire.jpg";
import gameBgmi from "@/assets/game-bgmi.jpg";
import gameCod from "@/assets/game-cod.jpg";
import gameValorant from "@/assets/game-valorant.jpg";

const games = [
  { name: "Free Fire", image: gameFreefire, players: "2.4M" },
  { name: "BGMI", image: gameBgmi, players: "1.8M" },
  { name: "Call of Duty", image: gameCod, players: "3.1M" },
  { name: "Valorant", image: gameValorant, players: "2.9M" },
];

const trendingTournaments = [
  { id: 1, name: "Pro League S4", game: "Free Fire", prize: "Rs. 50,000", slots: "12/100", creator: "GamingGuru", verified: true },
  { id: 2, name: "Battle Royale Cup", game: "BGMI", prize: "Rs. 25,000", slots: "45/64", creator: "ESportsKing", verified: true },
  { id: 3, name: "Tactical Masters", game: "Valorant", prize: "Rs. 15,000", slots: "20/32", creator: "ProHostX", verified: false },
];

const recommendedCreators = [
  { id: "c1", name: "GamingGuru", followers: "12.5K", tournaments: 48, rating: 4.8, verified: true },
  { id: "c2", name: "ESportsKing", followers: "8.2K", tournaments: 32, rating: 4.6, verified: true },
  { id: "c3", name: "ProHostX", followers: "5.1K", tournaments: 21, rating: 4.3, verified: false },
  { id: "c4", name: "ArenaQueen", followers: "15K", tournaments: 56, rating: 4.9, verified: true },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="mx-auto w-full max-w-2xl flex items-center justify-between px-4 sm:px-5 pt-6 pb-4">
        <div>
          <h1 className="font-display text-xl font-bold tracking-wider neon-text-purple">
            BATTLEARENA
          </h1>
          <p className="text-xs text-muted-foreground font-heading">Welcome back, Warrior</p>
        </div>
        <div className="flex gap-3">
          <button className="w-9 h-9 glass rounded-full flex items-center justify-center">
            <Search className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => navigate("/notifications")}
            className="w-9 h-9 glass rounded-full flex items-center justify-center relative"
          >
            <Bell className="w-4 h-4 text-muted-foreground" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent" />
          </button>
        </div>
      </div>

      {/* Live Banner */}
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 mb-6">
        <GlassCard neon className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-4 h-4 text-accent animate-glow-pulse" />
            <span className="text-xs font-heading font-semibold text-accent uppercase tracking-wider">
              Live Now
            </span>
          </div>
          <h2 className="font-heading text-lg font-bold">Grand Championship</h2>
          <p className="text-xs text-muted-foreground font-body mb-1">
            by <span className="text-primary">GamingGuru</span> - Verified Creator
          </p>
          <p className="text-xs text-muted-foreground font-body mb-3">
            Prize Pool: Rs. 1,00,000 - 256 Players
          </p>
          <NeonButton variant="green" className="text-xs py-2 px-4">
            Watch Live
          </NeonButton>
        </GlassCard>
      </div>

      {/* Recommended Creators */}
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-base font-bold flex items-center gap-2">
            <Crown className="w-4 h-4 text-neon-pink" />
            Top Creators
          </h2>
          <button
            onClick={() => navigate("/subscriptions")}
            className="text-xs text-primary font-heading flex items-center gap-1"
          >
            View All <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
          {recommendedCreators.map((creator, i) => (
            <motion.button
              key={creator.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate(`/creator/${creator.id}`)}
              className="glass rounded-xl p-3 min-w-[120px] flex flex-col items-center gap-2 shrink-0"
            >
              <div className="relative">
                <div className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center">
                  <span className="font-display text-lg font-bold text-primary-foreground">
                    {creator.name[0]}
                  </span>
                </div>
                {creator.verified && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-secondary flex items-center justify-center">
                    <Star className="w-3 h-3 text-secondary-foreground fill-secondary-foreground" />
                  </div>
                )}
              </div>
              <p className="font-heading font-bold text-xs text-foreground truncate w-full text-center">
                {creator.name}
              </p>
              <p className="text-[10px] text-muted-foreground">{creator.followers} followers</p>
              <div className="flex items-center gap-1 text-[10px] text-accent">
                <Star className="w-2.5 h-2.5 fill-accent" /> {creator.rating}
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Popular Games */}
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-base font-bold flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Popular Games
          </h2>
          <button className="text-xs text-primary font-heading flex items-center gap-1">
            View All <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {games.map((game, i) => (
            <motion.button
              key={game.name}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/tournaments")}
              className="glass rounded-xl overflow-hidden group"
            >
              <div className="relative aspect-square">
                <img
                  src={game.image}
                  alt={game.name}
                  loading="lazy"
                  width={512}
                  height={512}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="font-heading font-bold text-sm text-foreground">{game.name}</p>
                  <p className="text-[10px] text-muted-foreground">{game.players} playing</p>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Trending Tournaments */}
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-base font-bold flex items-center gap-2">
            <Flame className="w-4 h-4 text-destructive" />
            Trending Tournaments
          </h2>
          <button
            onClick={() => navigate("/tournaments")}
            className="text-xs text-primary font-heading flex items-center gap-1"
          >
            See All <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        {trendingTournaments.map((t, i) => (
          <GlassCard
            key={t.id}
            neon
            className="mb-3"
            delay={i * 0.12}
            onClick={() => navigate(`/tournament/${t.id}`)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-heading font-bold text-sm">{t.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {t.game} - {t.slots} slots
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[10px] text-primary font-heading">by {t.creator}</span>
                  {t.verified && <Star className="w-2.5 h-2.5 text-secondary fill-secondary" />}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-heading font-bold text-accent neon-text-green">{t.prize}</p>
                <NeonButton variant="purple" className="text-[10px] py-1 px-3 mt-1">
                  Join
                </NeonButton>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      <BottomNav />
    </div>
  );
};

export default Index;
