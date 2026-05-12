import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  AtSign,
  Ban,
  CheckCheck,
  Clipboard,
  Copy,
  Edit3,
  File,
  Flag,
  Hash,
  Image,
  Loader2,
  Lock,
  Megaphone,
  MessageCircle,
  Paperclip,
  Pin,
  PinOff,
  Reply,
  Send,
  Shield,
  Smile,
  Trash2,
  UserRoundX,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import GlassCard from "@/components/GlassCard";
import {
  ChatAccess,
  ChatAttachment,
  ChatMessage,
  deleteChatMessage,
  editChatMessage,
  getChatAccess,
  getChatMessages,
  markChatRead,
  moderateChatRoom,
  pinChatMessage,
  reactToChatMessage,
  reportChatMessage,
  sendChatMessage,
  unpinChatMessage,
  uploadChatAttachment,
} from "@/api/chat";
import { getMyProfile, User } from "@/api/profile";
import { getChatSocket, ChatPresencePayload } from "@/lib/chat-socket";
import { getErrorMessage } from "@/lib/page-utils";
import { toast } from "@/components/ui/sonner";

const EMOJI_REACTIONS = ["👍", "❤️", "😂", "🔥", "😮", "👏", "🏆", "🎯"];
const MESSAGE_PAGE_LIMIT = 30;

const getUserId = (value?: { _id?: string } | string | null) =>
  typeof value === "string" ? value : value?._id || "";

const formatTime = (value?: string | null) => {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
};

const formatDay = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date);
};

const sameDay = (a?: string, b?: string) =>
  Boolean(a && b && new Date(a).toDateString() === new Date(b).toDateString());

const isGroupedWithPrevious = (message: ChatMessage, previous?: ChatMessage) => {
  if (!previous) return false;
  if (message.type === "system" || message.type === "announcement" || message.type === "room_card") return false;
  if (previous.type === "system" || previous.type === "announcement" || previous.type === "room_card") return false;
  if (getUserId(message.sender) !== getUserId(previous.sender)) return false;
  return new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() < 5 * 60 * 1000;
};

const mergeMessage = (messages: ChatMessage[], next: ChatMessage) => {
  const index = messages.findIndex((message) => message._id === next._id);
  if (index === -1) return [...messages, next].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const copy = [...messages];
  copy[index] = next;
  return copy;
};

const uniqueMessages = (messages: ChatMessage[]) => {
  const map = new Map<string, ChatMessage>();
  messages.forEach((message) => map.set(message._id, message));
  return [...map.values()].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

const copyText = async (label: string, value?: string | null) => {
  if (!value) return;
  await navigator.clipboard?.writeText(value);
  toast.success(`${label} copied`);
};

const SocketStatus = ({ connected }: { connected: boolean }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-heading ${
      connected
        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
        : "border-amber-400/30 bg-amber-400/10 text-amber-300"
    }`}
  >
    {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
    {connected ? "Live" : "Reconnecting"}
  </span>
);

const AttachmentPreview = ({ attachment }: { attachment: ChatAttachment }) => {
  if (attachment.type === "image") {
    return (
      <a href={attachment.url} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-lg border border-white/10">
        <img src={attachment.url} alt={attachment.name} loading="lazy" className="max-h-72 w-full object-cover" />
      </a>
    );
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
      className="mt-2 flex items-center gap-2 rounded-lg border border-white/10 bg-background/40 px-3 py-2 text-xs"
    >
      <File className="h-4 w-4 text-primary" />
      <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
      <span className="text-muted-foreground">{Math.ceil(Number(attachment.size || 0) / 1024)} KB</span>
    </a>
  );
};

const RoomCard = ({ message }: { message: ChatMessage }) => {
  const roomId = String(message.metadata?.roomId || "");
  const roomPass = String(message.metadata?.roomPass || "");
  const roomJoinTime = String(message.metadata?.roomJoinTime || "");

  return (
    <div className="mt-2 rounded-lg border border-primary/30 bg-primary/10 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-heading font-bold text-primary">
        <Hash className="h-4 w-4" />
        Room Details
      </div>
      <div className="grid gap-2 min-[420px]:grid-cols-2">
        <button
          type="button"
          onClick={() => copyText("Room ID", roomId)}
          className="flex items-center justify-between rounded-lg border border-white/10 bg-background/40 px-3 py-2 text-left"
        >
          <span className="min-w-0">
            <span className="block text-[10px] text-muted-foreground">Room ID</span>
            <span className="block truncate text-sm font-bold">{roomId || "Not shared"}</span>
          </span>
          <Copy className="h-4 w-4 text-primary" />
        </button>
        <button
          type="button"
          onClick={() => copyText("Room password", roomPass)}
          className="flex items-center justify-between rounded-lg border border-white/10 bg-background/40 px-3 py-2 text-left"
        >
          <span className="min-w-0">
            <span className="block text-[10px] text-muted-foreground">Password</span>
            <span className="block truncate text-sm font-bold">{roomPass || "No password"}</span>
          </span>
          <Lock className="h-4 w-4 text-primary" />
        </button>
      </div>
      {roomJoinTime && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Join time: {new Date(roomJoinTime).toLocaleString()}
        </p>
      )}
    </div>
  );
};

const MessageBubble = ({
  message,
  previous,
  currentUserId,
  access,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onPin,
  onReport,
  onModerate,
}: {
  message: ChatMessage;
  previous?: ChatMessage;
  currentUserId: string;
  access: ChatAccess | null;
  onReply: (message: ChatMessage) => void;
  onEdit: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
  onReact: (message: ChatMessage, emoji: string) => void;
  onPin: (message: ChatMessage) => void;
  onReport: (message: ChatMessage) => void;
  onModerate: (message: ChatMessage, action: "mute" | "ban") => void;
}) => {
  const own = getUserId(message.sender) === currentUserId;
  const grouped = isGroupedWithPrevious(message, previous);
  const isSystem = message.type === "system" || message.type === "announcement";
  const canModerate = Boolean(access?.permissions.canModerate);
  const canEdit = own && message.status === "active" && ["text", "image", "file"].includes(message.type);
  const canDelete = message.status === "active" && (own || access?.permissions.canDeleteAny);
  const seen = own && message.seenBy.some((item) => item.user !== currentUserId);

  if (isSystem) {
    return (
      <div className="my-3 flex justify-center">
        <div className={`rounded-full border px-3 py-1 text-center text-[11px] ${
          message.type === "announcement"
            ? "border-primary/30 bg-primary/10 text-primary"
            : "border-white/10 bg-white/5 text-muted-foreground"
        }`}>
          {message.type === "announcement" && <Megaphone className="mr-1 inline h-3 w-3" />}
          {message.body}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${own ? "justify-end" : "justify-start"} ${grouped ? "mt-1" : "mt-3"}`}>
      <div className={`flex max-w-[86%] gap-2 ${own ? "flex-row-reverse" : "flex-row"}`}>
        {!grouped && (
          <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 bg-muted text-xs font-heading font-bold">
            {(message.sender?.username || "S").slice(0, 1).toUpperCase()}
          </div>
        )}
        {grouped && <div className="w-8 shrink-0" />}

        <div className="min-w-0">
          {!grouped && (
            <div className={`mb-1 flex items-center gap-2 text-[10px] text-muted-foreground ${own ? "justify-end" : ""}`}>
              <span className="font-heading font-bold text-foreground">{own ? "You" : message.sender?.username || "System"}</span>
              <span>{formatTime(message.createdAt)}</span>
            </div>
          )}
          <div
            className={`group relative rounded-2xl border px-3 py-2 shadow-[0_12px_28px_rgba(0,0,0,0.18)] ${
              own
                ? "rounded-br-md border-primary/30 bg-primary/20"
                : "rounded-bl-md border-white/10 bg-card/90"
            } ${message.status === "deleted" ? "opacity-70" : ""}`}
          >
            {message.replyTo && (
              <div className="mb-2 rounded-lg border-l-2 border-primary bg-background/45 px-2 py-1 text-[11px] text-muted-foreground">
                <span className="block font-heading font-bold text-foreground">
                  {message.replyTo.sender?.username || "Message"}
                </span>
                <span className="line-clamp-2">{message.replyTo.body || message.replyTo.type}</span>
              </div>
            )}

            {message.type === "room_card" ? (
              <RoomCard message={message} />
            ) : (
              <>
                {message.body && (
                  <p className="whitespace-pre-wrap break-words text-sm leading-5 text-foreground">{message.body}</p>
                )}
                {message.attachments.map((attachment) => (
                  <AttachmentPreview key={attachment.url} attachment={attachment} />
                ))}
              </>
            )}

            <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
              {message.editedAt && <span>edited</span>}
              <span>{formatTime(message.createdAt)}</span>
              {own && <CheckCheck className={`h-3.5 w-3.5 ${seen ? "text-cyan-300" : "text-muted-foreground"}`} />}
            </div>

            {message.reactions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {message.reactions.map((reaction) => (
                  <button
                    key={reaction.emoji}
                    type="button"
                    onClick={() => onReact(message, reaction.emoji)}
                    className="rounded-full border border-white/10 bg-background/50 px-2 py-0.5 text-xs"
                  >
                    {reaction.emoji} {reaction.users.length}
                  </button>
                ))}
              </div>
            )}
          </div>

          {message.status === "active" && (
            <div className={`mt-1 flex flex-wrap items-center gap-1 ${own ? "justify-end" : ""}`}>
              <button type="button" onClick={() => onReply(message)} className="chat-action">
                <Reply className="h-3.5 w-3.5" />
              </button>
              {EMOJI_REACTIONS.slice(0, 4).map((emoji) => (
                <button key={emoji} type="button" onClick={() => onReact(message, emoji)} className="chat-action">
                  {emoji}
                </button>
              ))}
              <button type="button" onClick={() => copyText("Message", message.body)} className="chat-action">
                <Copy className="h-3.5 w-3.5" />
              </button>
              {canEdit && (
                <button type="button" onClick={() => onEdit(message)} className="chat-action">
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
              )}
              {access?.permissions.canPin && (
                <button type="button" onClick={() => onPin(message)} className="chat-action">
                  <Pin className="h-3.5 w-3.5" />
                </button>
              )}
              {canDelete && (
                <button type="button" onClick={() => onDelete(message)} className="chat-action text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              {!own && (
                <button type="button" onClick={() => onReport(message)} className="chat-action text-amber-300">
                  <Flag className="h-3.5 w-3.5" />
                </button>
              )}
              {canModerate && !own && (
                <>
                  <button type="button" onClick={() => onModerate(message, "mute")} className="chat-action text-amber-300">
                    <UserRoundX className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => onModerate(message, "ban")} className="chat-action text-destructive">
                    <Ban className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SkeletonMessages = () => (
  <div className="space-y-3 px-4 py-4">
    {[0, 1, 2, 3, 4].map((item) => (
      <div key={item} className={`flex ${item % 2 ? "justify-end" : "justify-start"}`}>
        <div className="h-16 w-[72%] animate-pulse rounded-2xl bg-muted/70" />
      </div>
    ))}
  </div>
);

const TournamentCommentsScreen = () => {
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const readTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [profile, setProfile] = useState<User | null>(null);
  const [access, setAccess] = useState<ChatAccess | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [presence, setPresence] = useState<ChatPresencePayload | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [moderationOpen, setModerationOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [slowModeSeconds, setSlowModeSeconds] = useState(0);

  const currentUserId = profile?._id || "";
  const lastMessage = messages[messages.length - 1];
  const canSend = Boolean(access?.permissions.canSend);
  const canModerate = Boolean(access?.permissions.canModerate);

  const typingLabel = useMemo(() => {
    const active = typingUsers.filter((userId) => userId !== currentUserId);
    if (!active.length) return "";
    if (active.length === 1) return "Someone is typing";
    return `${active.length} players are typing`;
  }, [currentUserId, typingUsers]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior });
    });
  }, []);

  const loadInitial = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError("");
    try {
      const [profileRes, accessRes, page] = await Promise.all([
        getMyProfile().catch(() => null),
        getChatAccess(id),
        getChatMessages(id, { limit: MESSAGE_PAGE_LIMIT }),
      ]);
      setProfile(profileRes?.data?.user || null);
      setAccess(accessRes);
      setSlowModeSeconds(Number(accessRes.slowModeSeconds || 0));
      setAnnouncement(accessRes.announcement?.body || "");
      setMessages(page.messages || []);
      setHasMore(Boolean(page.hasMore));
      setNextCursor(page.nextCursor || null);
      setTimeout(() => scrollToBottom("auto"), 0);
    } catch (error) {
      const message = getErrorMessage(error, "Could not open room chat.");
      setLoadError(message);
      toast.error("Load room chat failed", { description: message });
    } finally {
      setLoading(false);
    }
  }, [id, scrollToBottom]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (!id) return;
    const socket = getChatSocket();
    if (!socket) return;

    const handleConnect = () => {
      setConnected(true);
      socket.emit("chat:join", { tournamentId: id }, (ack) => {
        if (ack?.ok && ack.data) {
          setAccess(ack.data.access);
          setPresence(ack.data.presence);
        } else if (ack?.message) {
          toast.error("Chat connection failed", { description: ack.message });
        }
      });
    };
    const handleDisconnect = () => setConnected(false);
    const handleMessage = (message: ChatMessage) => {
      setMessages((current) => mergeMessage(current, message));
      const el = scrollRef.current;
      const nearBottom = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 180;
      if (nearBottom) setTimeout(() => scrollToBottom(), 0);
    };
    const handlePresence = (payload: ChatPresencePayload) => {
      if (payload.tournamentId === id) setPresence(payload);
    };
    const handleTyping = (payload: { tournamentId: string; userId: string; isTyping: boolean }) => {
      if (payload.tournamentId !== id || payload.userId === currentUserId) return;
      setTypingUsers((current) => {
        const next = current.filter((userId) => userId !== payload.userId);
        return payload.isTyping ? [...next, payload.userId] : next;
      });
      window.setTimeout(() => {
        setTypingUsers((current) => current.filter((userId) => userId !== payload.userId));
      }, 2500);
    };
    const handleUpdated = (message: ChatMessage) => setMessages((current) => mergeMessage(current, message));
    const handlePinned = (message: ChatMessage) => setAccess((current) => current ? { ...current, pinnedMessage: message } : current);
    const handleUnpinned = () => setAccess((current) => current ? { ...current, pinnedMessage: null } : current);
    const handleModeration = (payload: { state?: { slowModeSeconds?: number; announcement?: { body?: string } } }) => {
      if (typeof payload.state?.slowModeSeconds === "number") setSlowModeSeconds(payload.state.slowModeSeconds);
      if (payload.state?.announcement) setAnnouncement(payload.state.announcement.body || "");
    };
    const handleForceLeave = (payload: { tournamentId: string; reason?: string }) => {
      if (payload.tournamentId !== id) return;
      toast.error("Room chat closed", { description: payload.reason || "You no longer have access to this chat." });
      navigate(`/tournament/${id}`, { replace: true });
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("chat:message", handleMessage);
    socket.on("chat:message:updated", handleUpdated);
    socket.on("chat:message:deleted", handleUpdated);
    socket.on("chat:reaction", handleUpdated);
    socket.on("chat:pinned", handlePinned);
    socket.on("chat:unpinned", handleUnpinned);
    socket.on("chat:presence", handlePresence);
    socket.on("chat:typing", handleTyping);
    socket.on("chat:moderation", handleModeration);
    socket.on("chat:force-leave", handleForceLeave);
    socket.on("chat:error", (payload) => toast.error("Chat action failed", { description: payload.message }));

    if (socket.connected) handleConnect();
    else socket.connect();

    return () => {
      socket.emit("chat:leave", { tournamentId: id });
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("chat:message", handleMessage);
      socket.off("chat:message:updated", handleUpdated);
      socket.off("chat:message:deleted", handleUpdated);
      socket.off("chat:reaction", handleUpdated);
      socket.off("chat:pinned", handlePinned);
      socket.off("chat:unpinned", handleUnpinned);
      socket.off("chat:presence", handlePresence);
      socket.off("chat:typing", handleTyping);
      socket.off("chat:moderation", handleModeration);
      socket.off("chat:force-leave", handleForceLeave);
    };
  }, [currentUserId, id, navigate, scrollToBottom]);

  useEffect(() => {
    if (!id || !lastMessage?._id || !currentUserId) return;
    if (readTimerRef.current) window.clearTimeout(readTimerRef.current);
    readTimerRef.current = window.setTimeout(() => {
      const socket = getChatSocket();
      if (socket?.connected) socket.emit("chat:read", { tournamentId: id, messageId: lastMessage._id });
      else markChatRead(id, lastMessage._id).catch(() => undefined);
    }, 800);
  }, [currentUserId, id, lastMessage?._id]);

  const loadOlder = useCallback(async () => {
    if (!id || !hasMore || loadingOlder) return;
    const el = scrollRef.current;
    const oldHeight = el?.scrollHeight || 0;
    setLoadingOlder(true);
    try {
      const page = await getChatMessages(id, { before: nextCursor || messages[0]?.createdAt, limit: MESSAGE_PAGE_LIMIT });
      setMessages((current) => uniqueMessages([...(page.messages || []), ...current]));
      setHasMore(Boolean(page.hasMore));
      setNextCursor(page.nextCursor || null);
      requestAnimationFrame(() => {
        if (!el) return;
        el.scrollTop = el.scrollHeight - oldHeight;
      });
    } catch (error) {
      toast.error("Load older messages failed", { description: getErrorMessage(error) });
    } finally {
      setLoadingOlder(false);
    }
  }, [hasMore, id, loadingOlder, messages, nextCursor]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || el.scrollTop > 80) return;
    loadOlder();
  };

  const emitTyping = (isTyping: boolean) => {
    const socket = getChatSocket();
    if (socket?.connected && id) socket.emit("chat:typing", { tournamentId: id, isTyping });
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    emitTyping(true);
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => emitTyping(false), 1200);
  };

  const handleAttach = async (files: FileList | null) => {
    if (!files || !id) return;
    const nextFiles = Array.from(files).slice(0, Math.max(0, 4 - attachments.length));
    if (!nextFiles.length) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of nextFiles) {
        uploaded.push(await uploadChatAttachment(id, file));
      }
      setAttachments((current) => [...current, ...uploaded].slice(0, 4));
    } catch (error) {
      toast.error("Upload failed", { description: getErrorMessage(error, "Could not upload attachment.") });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const sendViaSocket = (payload: Record<string, unknown>) =>
    new Promise<ChatMessage>((resolve, reject) => {
      const socket = getChatSocket();
      if (!socket?.connected) return reject(new Error("Socket is not connected"));
      socket.emit("chat:message", payload as never, (ack) => {
        if (ack?.ok && ack.data) resolve(ack.data);
        else reject(new Error(ack?.message || "Message failed"));
      });
    });

  const handleSend = async () => {
    if (!id || sending || uploading) return;
    const body = input.trim();
    if (!body && attachments.length === 0) return;
    setSending(true);
    try {
      if (editing) {
        const socket = getChatSocket();
        if (socket?.connected) {
          await new Promise((resolve, reject) => {
            socket.emit("chat:edit", { messageId: editing._id, body }, (ack) => {
              if (ack?.ok) resolve(ack.data);
              else reject(new Error(ack?.message || "Edit failed"));
            });
          });
        } else {
          const updated = await editChatMessage(editing._id, body);
          setMessages((current) => mergeMessage(current, updated));
        }
        setEditing(null);
      } else {
        const payload = {
          tournamentId: id,
          body,
          attachments,
          replyTo: replyTo?._id || null,
        };
        try {
          await sendViaSocket(payload);
        } catch {
          const sent = await sendChatMessage(id, payload);
          setMessages((current) => mergeMessage(current, sent));
        }
      }
      setInput("");
      setReplyTo(null);
      setAttachments([]);
      setEmojiOpen(false);
      setTimeout(() => scrollToBottom(), 0);
    } catch (error) {
      toast.error("Send failed", { description: getErrorMessage(error, "Message could not be sent.") });
    } finally {
      setSending(false);
    }
  };

  const updateMessageViaSocket = (event: "chat:delete" | "chat:reaction" | "chat:pin", payload: Record<string, unknown>, fallback: () => Promise<ChatMessage>) => {
    const socket = getChatSocket();
    if (socket?.connected) {
      socket.emit(event as never, payload as never, (ack) => {
        if (!ack?.ok) toast.error("Chat action failed", { description: ack?.message });
      });
      return;
    }
    fallback()
      .then((message) => setMessages((current) => mergeMessage(current, message)))
      .catch((error) => toast.error("Chat action failed", { description: getErrorMessage(error) }));
  };

  const handleDelete = (message: ChatMessage) => {
    if (!window.confirm("Delete this message?")) return;
    updateMessageViaSocket("chat:delete", { messageId: message._id }, () => deleteChatMessage(message._id));
  };

  const handleReact = (message: ChatMessage, emoji: string) => {
    updateMessageViaSocket("chat:reaction", { messageId: message._id, emoji }, () => reactToChatMessage(message._id, emoji));
  };

  const handlePin = (message: ChatMessage) => {
    updateMessageViaSocket("chat:pin", { messageId: message._id }, () => pinChatMessage(message._id));
  };

  const handleUnpin = async () => {
    if (!id) return;
    try {
      const socket = getChatSocket();
      if (socket?.connected) socket.emit("chat:unpin", { tournamentId: id });
      else await unpinChatMessage(id);
      setAccess((current) => current ? { ...current, pinnedMessage: null } : current);
    } catch (error) {
      toast.error("Unpin failed", { description: getErrorMessage(error) });
    }
  };

  const handleReport = async (message: ChatMessage) => {
    const reason = window.prompt("Why are you reporting this message?");
    if (!reason?.trim()) return;
    try {
      await reportChatMessage(message._id, reason.trim());
      toast.success("Message reported");
    } catch (error) {
      toast.error("Report failed", { description: getErrorMessage(error) });
    }
  };

  const handleModerateUser = async (message: ChatMessage, action: "mute" | "ban") => {
    if (!id || !message.sender?._id) return;
    const duration = window.prompt(`${action === "mute" ? "Mute" : "Ban"} duration in minutes. Leave blank for permanent.`);
    const reason = window.prompt("Reason for moderation") || "";
    try {
      await moderateChatRoom(id, {
        action,
        targetUser: message.sender._id,
        durationMinutes: duration ? Number(duration) : 0,
        reason,
      });
      toast.success(action === "mute" ? "User muted" : "User banned");
    } catch (error) {
      toast.error("Moderation failed", { description: getErrorMessage(error) });
    }
  };

  const handleShareRoom = () => {
    const socket = getChatSocket();
    if (!socket?.connected || !id) {
      toast.error("Chat is reconnecting", { description: "Try again in a moment." });
      return;
    }
    socket.emit("chat:share-room", { tournamentId: id }, (ack) => {
      if (!ack?.ok) toast.error("Share room failed", { description: ack?.message });
    });
  };

  const handleSaveModeration = async () => {
    if (!id) return;
    try {
      await moderateChatRoom(id, { action: "slow_mode", slowModeSeconds });
      if (announcement.trim()) {
        await moderateChatRoom(id, { action: "announcement", body: announcement.trim() });
      }
      toast.success("Chat settings updated");
      setModerationOpen(false);
    } catch (error) {
      toast.error("Moderation update failed", { description: getErrorMessage(error) });
    }
  };

  const startEdit = (message: ChatMessage) => {
    setEditing(message);
    setReplyTo(null);
    setInput(message.body || "");
  };

  return (
    <div className="arena-shell min-h-screen flex flex-col bg-background">
      <style>{`
        .chat-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 28px;
          height: 28px;
          border-radius: 999px;
          border: 1px solid hsl(var(--border) / 0.55);
          background: hsl(var(--card) / 0.6);
          color: hsl(var(--muted-foreground));
          font-size: 11px;
          transition: transform 140ms ease, border-color 140ms ease, color 140ms ease;
        }
        .chat-action:active { transform: scale(0.94); }
        .chat-action:hover { color: hsl(var(--foreground)); border-color: hsl(var(--primary) / 0.45); }
      `}</style>

      <header className="sticky top-0 z-20 border-b border-glass-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3 sm:px-5">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate(-1)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-glass-border bg-card/70"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </motion.button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 shrink-0 text-primary" />
              <h1 className="truncate font-heading text-lg font-bold sm:text-xl">
                {access?.tournament.title || "Room Chat"}
              </h1>
            </div>
            <p className="truncate text-[11px] text-muted-foreground">
              {presence?.onlineCount || 0} online · {access?.participantCount || 0} members
            </p>
          </div>
          <SocketStatus connected={connected} />
          {canModerate && (
            <button
              type="button"
              onClick={() => setModerationOpen((value) => !value)}
              className="grid h-10 w-10 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary"
              aria-label="Moderation controls"
            >
              <Shield className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {moderationOpen && canModerate && (
        <div className="border-b border-glass-border bg-card/80 px-4 py-3 backdrop-blur-xl">
          <div className="mx-auto grid w-full max-w-5xl gap-2 sm:grid-cols-[160px_1fr_auto_auto]">
            <select
              value={slowModeSeconds}
              onChange={(event) => setSlowModeSeconds(Number(event.target.value))}
              className="rounded-lg border border-glass-border bg-background px-3 py-2 text-sm font-heading"
            >
              <option value={0}>Slow off</option>
              <option value={5}>5s slow</option>
              <option value={15}>15s slow</option>
              <option value={30}>30s slow</option>
              <option value={60}>60s slow</option>
            </select>
            <input
              value={announcement}
              onChange={(event) => setAnnouncement(event.target.value)}
              placeholder="Announcement"
              className="rounded-lg border border-glass-border bg-background px-3 py-2 text-sm font-heading outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={handleShareRoom}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-heading text-primary"
            >
              <Clipboard className="h-4 w-4" />
              Share Room
            </button>
            <button
              type="button"
              onClick={handleSaveModeration}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-heading font-bold text-primary-foreground"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {access?.announcement?.body && (
        <div className="border-b border-primary/20 bg-primary/10 px-4 py-2 text-center text-xs text-primary">
          <Megaphone className="mr-1 inline h-3.5 w-3.5" />
          {access.announcement.body}
        </div>
      )}

      {access?.pinnedMessage && (
        <button
          type="button"
          onClick={() => scrollToBottom()}
          className="border-b border-amber-400/20 bg-amber-400/10 px-4 py-2 text-left text-xs text-amber-200"
        >
          <div className="mx-auto flex max-w-5xl items-center gap-2">
            <Pin className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{access.pinnedMessage.body || access.pinnedMessage.type}</span>
            {canModerate && (
              <span
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  handleUnpin();
                }}
                className="grid h-7 w-7 place-items-center rounded-full border border-amber-400/30"
              >
                <PinOff className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
        </button>
      )}

      <main ref={scrollRef} onScroll={handleScroll} className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto px-4 sm:px-5">
        {loading ? (
          <SkeletonMessages />
        ) : loadError ? (
          <div className="flex min-h-[50vh] items-center justify-center">
            <GlassCard className="w-full max-w-sm text-center">
              <Shield className="mx-auto mb-3 h-10 w-10 text-amber-300" />
              <h2 className="font-heading text-lg font-bold">Room chat locked</h2>
              <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
            </GlassCard>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex min-h-[50vh] items-center justify-center">
            <GlassCard className="w-full max-w-sm text-center">
              <MessageCircle className="mx-auto mb-3 h-10 w-10 text-primary" />
              <h2 className="font-heading text-lg font-bold">No messages yet</h2>
              <p className="mt-1 text-sm text-muted-foreground">Joined players will see room updates here.</p>
            </GlassCard>
          </div>
        ) : (
          <div className="pb-4 pt-3">
            {loadingOlder && (
              <div className="mb-3 flex justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            )}
            {messages.map((message, index) => {
              const previous = messages[index - 1];
              return (
                <div key={message._id}>
                  {!sameDay(message.createdAt, previous?.createdAt) && (
                    <div className="my-4 flex justify-center">
                      <span className="rounded-full border border-glass-border bg-card/80 px-3 py-1 text-[11px] text-muted-foreground">
                        {formatDay(message.createdAt)}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    message={message}
                    previous={previous}
                    currentUserId={currentUserId}
                    access={access}
                    onReply={setReplyTo}
                    onEdit={startEdit}
                    onDelete={handleDelete}
                    onReact={handleReact}
                    onPin={handlePin}
                    onReport={handleReport}
                    onModerate={handleModerateUser}
                  />
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer className="sticky bottom-0 z-20 border-t border-glass-border bg-background/95 px-4 py-3 backdrop-blur-xl sm:px-5">
        <div className="mx-auto w-full max-w-5xl">
          {typingLabel && <p className="mb-2 text-[11px] text-primary">{typingLabel}...</p>}
          {!loadError && !canSend && (
            <div className="mb-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
              {access?.permissions.mutedUntil ? "You are muted in this room." : "Chat is read-only for your account."}
            </div>
          )}

          {!loadError && (replyTo || editing || attachments.length > 0) && (
            <div className="mb-2 rounded-lg border border-glass-border bg-card/80 p-2">
              {replyTo && (
                <div className="flex items-center gap-2">
                  <Reply className="h-4 w-4 text-primary" />
                  <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    Replying to <span className="font-bold text-foreground">{replyTo.sender?.username || "message"}</span>: {replyTo.body}
                  </p>
                  <button type="button" onClick={() => setReplyTo(null)} className="grid h-7 w-7 place-items-center rounded-full">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              {editing && (
                <div className="flex items-center gap-2">
                  <Edit3 className="h-4 w-4 text-primary" />
                  <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">Editing message</p>
                  <button type="button" onClick={() => { setEditing(null); setInput(""); }} className="grid h-7 w-7 place-items-center rounded-full">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              {attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {attachments.map((attachment) => (
                    <span key={attachment.url} className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-background/50 px-3 py-1 text-xs">
                      {attachment.type === "image" ? <Image className="h-3.5 w-3.5" /> : <File className="h-3.5 w-3.5" />}
                      <span className="max-w-[160px] truncate">{attachment.name}</span>
                      <button type="button" onClick={() => setAttachments((current) => current.filter((item) => item.url !== attachment.url))}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {!loadError && emojiOpen && (
            <div className="mb-2 flex flex-wrap gap-2 rounded-lg border border-glass-border bg-card/90 p-2">
              {EMOJI_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setInput((value) => `${value}${emoji}`)}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-background/50 text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept="image/*,.pdf,.txt,.zip,application/octet-stream"
              onChange={(event) => handleAttach(event.target.files)}
            />
            <button
              type="button"
              disabled={Boolean(loadError) || !canSend || uploading}
              onClick={() => fileInputRef.current?.click()}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-glass-border bg-card text-muted-foreground disabled:opacity-50"
              aria-label="Attach file"
            >
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
            </button>
            <button
              type="button"
              disabled={Boolean(loadError) || !canSend}
              onClick={() => setEmojiOpen((value) => !value)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-glass-border bg-card text-muted-foreground disabled:opacity-50"
              aria-label="Emoji picker"
            >
              <Smile className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1 rounded-lg border border-glass-border bg-card/90 px-3 py-2 focus-within:border-primary">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <AtSign className="h-3 w-3" />
                <span className="truncate">Use @username to tag players</span>
                {slowModeSeconds > 0 && <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-primary">{slowModeSeconds}s slow</span>}
              </div>
              <textarea
                value={input}
                onChange={(event) => handleInputChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                disabled={Boolean(loadError) || !canSend || sending}
                rows={1}
                maxLength={2000}
                placeholder={canSend ? "Message room..." : "You cannot send messages"}
                className="mt-1 max-h-28 min-h-7 w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 disabled:opacity-60"
              />
            </div>
            <motion.button
              whileTap={{ scale: 0.94 }}
              type="button"
              disabled={Boolean(loadError) || !canSend || sending || uploading || (!input.trim() && attachments.length === 0)}
              onClick={handleSend}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-[0_0_22px_hsl(var(--primary)/0.35)] disabled:opacity-50"
              aria-label="Send message"
            >
              {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : editing ? <CheckCheck className="h-5 w-5" /> : <Send className="h-5 w-5" />}
            </motion.button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default TournamentCommentsScreen;
