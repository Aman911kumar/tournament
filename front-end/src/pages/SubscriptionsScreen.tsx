import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Star, Shield, Search } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import NeonButton from "@/components/NeonButton";
import BottomNav from "@/components/BottomNav";
import { CreatorChannel, getCreators } from "@/api/creators";

const SubscriptionsScreen = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [creators, setCreators] = useState<(CreatorChannel & { tournamentCount?: number })[]>([]);

  useEffect(() => {
    let active = true;
    getCreators()
      .then((data) => {
        if (active) setCreators(data);
      })
      .catch(() => {
        if (active) setCreators([]);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredCreators = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return creators;
    return creators.filter((creator) =>
      creator.name.toLowerCase().includes(query) ||
      creator.handle.toLowerCase().includes(query) ||
      creator.owner?.username?.toLowerCase().includes(query)
    );
  }, [creators, search]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 pt-6 pb-4 flex items-center gap-3">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <h1 className="font-heading text-xl font-bold">Creators</h1>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 mb-4">
        <div className="glass rounded-lg flex items-center gap-2 px-3 py-2.5">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search creators..."
            className="bg-transparent text-sm font-heading flex-1 focus:outline-none placeholder:text-muted-foreground/50"
          />
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5">
        <h2 className="font-heading text-sm font-bold text-muted-foreground mb-3">
          CREATORS ({filteredCreators.length})
        </h2>
        <div className="space-y-3">
          {filteredCreators.length === 0 && (
            <GlassCard className="text-center py-8">
              <Search className="w-9 h-9 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-heading">No creators found</p>
              <p className="text-xs text-muted-foreground mt-1">Try a different search.</p>
            </GlassCard>
          )}

          {filteredCreators.map((creator, index) => (
            <GlassCard key={creator._id} neon delay={index * 0.08}>
              <div className="flex items-center gap-3">
                <button onClick={() => navigate(`/creator/${creator._id}`)} className="relative shrink-0">
                  {creator.avatar?.url ? (
                    <img src={creator.avatar.url} alt="" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center">
                      <span className="font-display text-sm font-bold text-primary-foreground">{creator.name[0]}</span>
                    </div>
                  )}
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-secondary flex items-center justify-center">
                    <Shield className="w-2.5 h-2.5 text-secondary-foreground fill-secondary-foreground" />
                  </div>
                </button>
                <button className="flex-1 min-w-0 text-left" onClick={() => navigate(`/creator/${creator._id}`)}>
                  <p className="font-heading font-bold text-sm truncate">{creator.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {creator.memberCount.toLocaleString("en-IN")} followers - {creator.tournamentCount ?? 0} tournaments
                  </p>
                  <div className="flex items-center gap-0.5 mt-0.5">
                    <Star className="w-2.5 h-2.5 text-accent fill-accent" />
                    <span className="text-[10px] text-accent font-heading">{creator.owner?.stats?.rating ?? 4.5}</span>
                  </div>
                </button>
                <NeonButton variant="purple" className="text-[10px] py-1.5 px-3" onClick={() => navigate(`/creator/${creator._id}`)}>
                  View
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
