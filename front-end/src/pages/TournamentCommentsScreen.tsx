import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Send, MessageCircle } from "lucide-react";
import GlassCard from "@/components/GlassCard";

const mockComments = [
  { id: 1, user: "ShadowX", message: "Let's go! This tournament is going to be intense.", time: "5 min ago" },
  { id: 2, user: "BlazeFire", message: "Anyone looking for a duo partner?", time: "12 min ago" },
  { id: 3, user: "NinjaRed", message: "First time joining GamingGuru's tournament. Excited!", time: "20 min ago" },
  { id: 4, user: "StormRider", message: "The prize pool is insane. Good luck everyone.", time: "35 min ago" },
  { id: 5, user: "Phantom", message: "Last tournament was so well organized. Can't wait!", time: "1 hour ago" },
];

const TournamentCommentsScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [message, setMessage] = useState("");
  const [comments, setComments] = useState(mockComments);

  const handleSend = () => {
    if (!message.trim()) return;
    setComments([
      { id: Date.now(), user: "You", message: message.trim(), time: "Just now" },
      ...comments,
    ]);
    setMessage("");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-5 pt-6 pb-4 flex items-center gap-3">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-primary" />
          <h1 className="font-heading text-xl font-bold">Comments</h1>
        </div>
        <span className="ml-auto text-xs text-muted-foreground font-heading">
          {comments.length} messages
        </span>
      </div>

      {/* Comments List */}
      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 sm:px-5 space-y-3 pb-4">
        {comments.length === 0 && (
          <GlassCard className="text-center py-10">
            <MessageCircle className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-heading">No comments yet</p>
            <p className="text-xs text-muted-foreground mt-1">Start the conversation for tournament #{id}.</p>
          </GlassCard>
        )}

        {comments.map((c, i) => (
          <GlassCard key={c.id} delay={i * 0.05}>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <span className="text-[10px] font-heading font-bold">{c.user[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`font-heading text-xs font-bold ${c.user === "You" ? "text-primary" : "text-foreground"}`}>
                    {c.user}
                  </p>
                  <span className="text-[10px] text-muted-foreground/60">{c.time}</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-body mt-0.5 break-words">{c.message}</p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Input */}
      <div className="px-4 sm:px-5 py-3 glass border-t border-glass-border">
        <div className="mx-auto w-full max-w-2xl">
        <div className="flex gap-2">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message..."
            className="min-w-0 flex-1 bg-transparent border border-glass-border rounded-lg px-3 py-2.5 text-sm font-heading placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors"
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleSend}
            disabled={!message.trim()}
            className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center neon-glow-purple disabled:opacity-50"
          >
            <Send className="w-4 h-4 text-primary-foreground" />
          </motion.button>
        </div>
        </div>
      </div>
    </div>
  );
};

export default TournamentCommentsScreen;
