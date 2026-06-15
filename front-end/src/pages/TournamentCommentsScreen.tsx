import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
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
  Mic,
  MicOff,
  Paperclip,
  PhoneCall,
  PhoneOff,
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
import { User } from "@/api/profile";
import { UserAvatar } from "@/components/identity";
import { getChatSocket, ChatPresencePayload } from "@/lib/chat-socket";
import { useTournamentVoiceRoom } from "@/hooks/useTournamentVoiceRoom";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { getErrorMessage } from "@/lib/page-utils";
import { toast } from "@/components/ui/sonner";

const CHAT_REACTIONS = [
  "\u{1F44D}",
  "\u2764\uFE0F",
  "\u{1F602}",
  "\u{1F525}",
  "\u{1F62E}",
  "\u{1F44F}",
  "\u{1F3C6}",
  "\u{1F3AF}",
];
const MESSAGE_PAGE_LIMIT = 30;
const CHAT_ACTION_COOLDOWN_MS = 900;
const CHAT_SEND_COOLDOWN_MS = 650;

const getUserId = (value?: { _id?: string } | string | null) =>
  typeof value === "string" ? value : value?._id || "";

const getClientRequestId = (message?: ChatMessage | null) =>
  String(message?.metadata?.clientRequestId || "");

const isOptimisticMessage = (message?: ChatMessage | null) =>
  Boolean(
    message?._id?.startsWith("optimistic-") || message?.metadata?.optimistic,
  );

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

const isGroupedWithPrevious = (
  message: ChatMessage,
  previous?: ChatMessage,
) => {
  if (!previous) return false;
  if (
    message.type === "system" ||
    message.type === "announcement" ||
    message.type === "room_card"
  )
    return false;
  if (
    previous.type === "system" ||
    previous.type === "announcement" ||
    previous.type === "room_card"
  )
    return false;
  if (getUserId(message.sender) !== getUserId(previous.sender)) return false;
  return (
    new Date(message.createdAt).getTime() -
      new Date(previous.createdAt).getTime() <
    5 * 60 * 1000
  );
};

const mergeMessage = (messages: ChatMessage[], next: ChatMessage) => {
  const nextClientRequestId = getClientRequestId(next);
  const index = messages.findIndex(
    (message) =>
      message._id === next._id ||
      (nextClientRequestId &&
        getClientRequestId(message) === nextClientRequestId),
  );
  if (index === -1)
    return [...messages, next].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  const copy = [...messages];
  copy[index] = next;
  return copy;
};

const uniqueMessages = (messages: ChatMessage[]) => {
  const map = new Map<string, ChatMessage>();
  messages.forEach((message) => {
    const key = getClientRequestId(message) || message._id;
    const existing = map.get(key);
    if (
      !existing ||
      (isOptimisticMessage(existing) && !isOptimisticMessage(message))
    ) {
      map.set(key, message);
    }
  });
  return [...map.values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
};

const createOptimisticMessage = ({
  tournamentId,
  currentUser,
  body,
  attachments,
  replyTo,
  clientRequestId,
}: {
  tournamentId: string;
  currentUser: User;
  body: string;
  attachments: ChatAttachment[];
  replyTo: ChatMessage | null;
  clientRequestId: string;
}): ChatMessage => {
  const now = new Date().toISOString();
  return {
    _id: `optimistic-${clientRequestId}`,
    tournament: tournamentId,
    sender: {
      _id: currentUser._id,
      username: currentUser.username,
      avatar: currentUser.avatar,
      role: currentUser.role || [],
    },
    type: attachments.some((attachment) => attachment.type === "image")
      ? "image"
      : attachments.length
        ? "file"
        : "text",
    body,
    attachments,
    replyTo: replyTo
      ? {
          _id: replyTo._id,
          body: replyTo.body,
          type: replyTo.type,
          sender: replyTo.sender
            ? { _id: replyTo.sender._id, username: replyTo.sender.username }
            : null,
        }
      : null,
    mentions: [],
    reactions: [],
    seenBy: [{ user: currentUser._id, seenAt: now }],
    status: "active",
    metadata: { optimistic: true, clientRequestId },
    createdAt: now,
    updatedAt: now,
  };
};

const toggleLocalReaction = (
  message: ChatMessage,
  emoji: string,
  userId: string,
): ChatMessage => {
  const reactions = [...message.reactions];
  const index = reactions.findIndex((reaction) => reaction.emoji === emoji);
  if (index === -1) {
    reactions.push({ emoji, users: [userId] });
    return { ...message, reactions, updatedAt: new Date().toISOString() };
  }

  const reaction = reactions[index];
  const hasReacted = reaction.users.includes(userId);
  const users = hasReacted
    ? reaction.users.filter((id) => id !== userId)
    : [...reaction.users, userId];
  if (users.length) reactions[index] = { ...reaction, users };
  else reactions.splice(index, 1);
  return { ...message, reactions, updatedAt: new Date().toISOString() };
};

const copyText = async (label: string, value?: string | null) => {
  if (!value) return;
  await navigator.clipboard?.writeText(value);
  toast.success(`${label} copied`);
};

const SocketStatus = ({ connected }: { connected: boolean }) => (
  <span
    className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-2 text-[10px] font-heading ${
      connected
        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
        : "border-amber-400/30 bg-amber-400/10 text-amber-300"
    }`}
  >
    {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
    <span className="hidden sm:inline">
      {connected ? "Live" : "Reconnecting"}
    </span>
  </span>
);

const AttachmentPreview = ({ attachment }: { attachment: ChatAttachment }) => {
  if (attachment.type === "image") {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
        className="mt-2 block overflow-hidden rounded-lg border border-glass-border bg-background/35"
      >
        <img
          src={attachment.url}
          alt={attachment.name}
          loading="lazy"
          decoding="async"
          className="max-h-64 w-full object-cover sm:max-h-72"
        />
      </a>
    );
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
      className="mt-2 flex items-center gap-2 rounded-lg border border-glass-border bg-background/40 px-3 py-2 text-xs"
    >
      <File className="h-4 w-4 text-primary" />
      <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
      <span className="text-muted-foreground">
        {Math.ceil(Number(attachment.size || 0) / 1024)} KB
      </span>
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
          className="flex items-center justify-between rounded-lg border border-glass-border bg-background/40 px-3 py-2 text-left"
        >
          <span className="min-w-0">
            <span className="block text-[10px] text-muted-foreground">
              Room ID
            </span>
            <span className="block truncate text-sm font-bold">
              {roomId || "Not shared"}
            </span>
          </span>
          <Copy className="h-4 w-4 text-primary" />
        </button>
        <button
          type="button"
          onClick={() => copyText("Room password", roomPass)}
          className="flex items-center justify-between rounded-lg border border-glass-border bg-background/40 px-3 py-2 text-left"
        >
          <span className="min-w-0">
            <span className="block text-[10px] text-muted-foreground">
              Password
            </span>
            <span className="block truncate text-sm font-bold">
              {roomPass || "No password"}
            </span>
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

const MessageBubble = memo(
  ({
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
    const isSystem =
      message.type === "system" || message.type === "announcement";
    const optimistic = isOptimisticMessage(message);
    const canModerate = Boolean(access?.permissions.canModerate);
    const canEdit =
      !optimistic &&
      own &&
      message.status === "active" &&
      ["text", "image", "file"].includes(message.type);
    const canDelete =
      !optimistic &&
      message.status === "active" &&
      (own || access?.permissions.canDeleteAny);
    const seen =
      own && message.seenBy.some((item) => item.user !== currentUserId);

    if (isSystem) {
      return (
        <div className="my-3 flex justify-center">
          <div
            className={`rounded-full border px-3 py-1 text-center text-[11px] ${
              message.type === "announcement"
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-glass-border bg-card/70 text-muted-foreground"
            }`}
          >
            {message.type === "announcement" && (
              <Megaphone className="mr-1 inline h-3 w-3" />
            )}
            {message.body}
          </div>
        </div>
      );
    }

    return (
      <div
        className={`flex ${own ? "justify-end" : "justify-start"} ${grouped ? "mt-1" : "mt-3"}`}
      >
        <div
          className={`flex max-w-[94%] gap-2 sm:max-w-[86%] ${own ? "flex-row-reverse" : "flex-row"}`}
        >
          {!grouped && (
            <UserAvatar
              user={message.sender}
              size="sm"
              className="mt-1"
              name={message.sender?.username || "System"}
            />
          )}
          {grouped && <div className="w-8 shrink-0" />}

          <div className="min-w-0">
            {!grouped && (
              <div
                className={`mb-1 flex items-center gap-2 text-[10px] text-muted-foreground ${own ? "justify-end" : ""}`}
              >
                <span className="font-heading font-bold text-foreground">
                  {own ? "You" : message.sender?.username || "System"}
                </span>
                <span>{formatTime(message.createdAt)}</span>
              </div>
            )}
            <div
              className={`chat-bubble group relative rounded-2xl border px-3 py-2 ${
                own
                  ? "rounded-br-md border-primary/30 bg-primary/20"
                  : "rounded-bl-md border-glass-border bg-card/90"
              } ${message.status === "deleted" ? "opacity-70" : ""} ${optimistic ? "opacity-80" : ""}`}
            >
              {message.replyTo && (
                <div className="mb-2 rounded-lg border-l-2 border-primary bg-background/45 px-2 py-1 text-[11px] text-muted-foreground">
                  <span className="block font-heading font-bold text-foreground">
                    {message.replyTo.sender?.username || "Message"}
                  </span>
                  <span className="line-clamp-2">
                    {message.replyTo.body || message.replyTo.type}
                  </span>
                </div>
              )}

              {message.type === "room_card" ? (
                <RoomCard message={message} />
              ) : (
                <>
                  {message.body && (
                    <p className="whitespace-pre-wrap break-words text-sm leading-5 text-foreground">
                      {message.body}
                    </p>
                  )}
                  {message.attachments.map((attachment) => (
                    <AttachmentPreview
                      key={attachment.url}
                      attachment={attachment}
                    />
                  ))}
                </>
              )}

              <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                {optimistic && (
                  <span className="inline-flex items-center gap-1 text-primary">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    sending
                  </span>
                )}
                {message.editedAt && <span>edited</span>}
                <span>{formatTime(message.createdAt)}</span>
                {own && (
                  <CheckCheck
                    className={`h-3.5 w-3.5 ${seen ? "text-cyan-300" : "text-muted-foreground"}`}
                  />
                )}
              </div>

              {message.reactions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {message.reactions.map((reaction) => (
                    <button
                      key={reaction.emoji}
                      type="button"
                      onClick={() => onReact(message, reaction.emoji)}
                      disabled={optimistic}
                      className="rounded-full border border-glass-border bg-background/50 px-2 py-0.5 text-xs disabled:opacity-50"
                    >
                      {reaction.emoji} {reaction.users.length}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {message.status === "active" && !optimistic && (
              <div
                className={`mt-1 flex flex-wrap items-center gap-1 ${own ? "justify-end" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => onReply(message)}
                  className="chat-action"
                >
                  <Reply className="h-3.5 w-3.5" />
                </button>
                {CHAT_REACTIONS.slice(0, 4).map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onReact(message, emoji)}
                    className="chat-action"
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => copyText("Message", message.body)}
                  className="chat-action"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(message)}
                    className="chat-action"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                )}
                {access?.permissions.canPin && (
                  <button
                    type="button"
                    onClick={() => onPin(message)}
                    className="chat-action"
                  >
                    <Pin className="h-3.5 w-3.5" />
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(message)}
                    className="chat-action text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                {!own && (
                  <button
                    type="button"
                    onClick={() => onReport(message)}
                    className="chat-action text-destructive"
                  >
                    <Flag className="h-3.5 w-3.5" />
                  </button>
                )}
                {canModerate && !own && (
                  <>
                    <button
                      type="button"
                      onClick={() => onModerate(message, "mute")}
                      className="chat-action text-amber-300"
                    >
                      <UserRoundX className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onModerate(message, "ban")}
                      className="chat-action text-destructive"
                    >
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
  },
);
MessageBubble.displayName = "MessageBubble";

const SkeletonMessages = () => (
  <div className="space-y-3 px-4 py-4">
    {[0, 1, 2, 3, 4].map((item) => (
      <div
        key={item}
        className={`flex ${item % 2 ? "justify-end" : "justify-start"}`}
      >
        <div className="b4a-skeleton h-16 w-[72%] rounded-2xl" />
      </div>
    ))}
  </div>
);

const VoiceDock = ({
  voice,
  currentUserId,
  connected,
  canJoin,
}: {
  voice: ReturnType<typeof useTournamentVoiceRoom>;
  currentUserId: string;
  connected: boolean;
  canJoin: boolean;
}) => {
  const active = voice.joined || voice.participants.length > 0;
  const visibleParticipants = voice.participants.slice(0, 3);
  const self = voice.participants.find(
    (participant) => participant.userId === currentUserId,
  );

  return (
    <div
      className="flex shrink-0 items-center gap-1.5"
      title={voice.error || undefined}
    >
      {voice.joined && (
        <div className="hidden max-w-[180px] items-center -space-x-2 overflow-hidden min-[760px]:flex">
          {visibleParticipants.map((participant) => (
            <UserAvatar
              key={participant.userId}
              user={{
                _id: participant.userId,
                username: participant.username,
                avatar: participant.avatar,
                role: participant.role,
              }}
              size="xs"
              status={participant.speaking ? "speaking" : "online"}
              className={`voice-avatar ${participant.speaking ? "voice-avatar-speaking" : ""}`}
              title={
                participant.userId === currentUserId
                  ? "You"
                  : participant.username || "Player"
              }
            />
          ))}
          {voice.participants.length > visibleParticipants.length && (
            <span className="voice-count">
              +{voice.participants.length - visibleParticipants.length}
            </span>
          )}
        </div>
      )}

      {!voice.joined ? (
        <button
          type="button"
          disabled={!canJoin || !connected || voice.status === "joining"}
          onClick={voice.joinVoice}
          className={`arena-focus inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border px-3 font-heading text-xs font-bold transition-colors disabled:opacity-50 ${
            voice.status === "error"
              ? "border-red-400/35 bg-red-500/10 text-red-200 hover:bg-red-500/20"
              : active
                ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20"
                : "border-cyan-400/25 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/20"
          }`}
          aria-label="Join voice call"
        >
          {voice.status === "joining" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : voice.status === "error" ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <PhoneCall className="h-4 w-4" />
          )}
          <span className="hidden md:inline">
            {voice.status === "error"
              ? "Retry voice"
              : voice.participants.length
                ? `${voice.participants.length} in voice`
                : "Join voice"}
          </span>
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={voice.toggleMute}
            className={`arena-focus grid h-10 w-10 shrink-0 place-items-center rounded-lg border transition-colors ${
              voice.muted
                ? "border-amber-400/35 bg-amber-400/10 text-amber-200"
                : self?.speaking
                  ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-200"
                  : "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
            }`}
            aria-label={voice.muted ? "Unmute microphone" : "Mute microphone"}
          >
            {voice.muted ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={voice.leaveVoice}
            className="arena-focus grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-red-400/35 bg-red-500/10 text-red-200 transition-colors hover:bg-red-500/20"
            aria-label="Leave voice call"
          >
            <PhoneOff className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
};

const TournamentCommentsScreen = () => {
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const typingTimeoutsRef = useRef<Map<string, number>>(new Map());
  const readTimerRef = useRef<number | null>(null);
  const lastTypingEmitRef = useRef(0);
  const actionTimestampsRef = useRef<Map<string, number>>(new Map());
  const pendingActionKeysRef = useRef<Set<string>>(new Set());
  const lastBlockedToastRef = useRef(0);
  const lastVoiceErrorRef = useRef("");
  const isAtBottomRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { profile } = useCurrentProfile();
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
  const [pendingSendCount, setPendingSendCount] = useState(0);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [moderationOpen, setModerationOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [slowModeSeconds, setSlowModeSeconds] = useState(0);
  const [newMessageCount, setNewMessageCount] = useState(0);

  const currentUserId = profile?._id || "";
  const lastMessage = messages[messages.length - 1];
  const canSend = Boolean(access?.permissions.canSend);
  const canModerate = Boolean(access?.permissions.canModerate);
  const sending = pendingSendCount > 0;
  const voice = useTournamentVoiceRoom({
    tournamentId: id,
    currentUserId,
    enabled: Boolean(access && !loadError),
  });

  useEffect(() => {
    if (voice.status !== "error" || !voice.error) return;
    if (lastVoiceErrorRef.current === voice.error) return;
    lastVoiceErrorRef.current = voice.error;
    toast.error("Voice chat failed", { description: voice.error });
  }, [voice.error, voice.status]);

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
      isAtBottomRef.current = true;
      setNewMessageCount(0);
    });
  }, []);

  const startGuardedAction = useCallback(
    (key: string, cooldownMs = CHAT_ACTION_COOLDOWN_MS) => {
      const now = Date.now();
      const lastRun = actionTimestampsRef.current.get(key) || 0;
      if (pendingActionKeysRef.current.has(key) || now - lastRun < cooldownMs) {
        if (now - lastBlockedToastRef.current > 1800) {
          lastBlockedToastRef.current = now;
          toast.info("Wait a moment", {
            description: "That action is already being processed.",
          });
        }
        return false;
      }

      actionTimestampsRef.current.set(key, now);
      pendingActionKeysRef.current.add(key);
      return true;
    },
    [],
  );

  const finishGuardedAction = useCallback((key: string) => {
    pendingActionKeysRef.current.delete(key);
  }, []);

  const runGuardedAction = useCallback(
    async (
      key: string,
      action: () => Promise<void>,
      cooldownMs = CHAT_ACTION_COOLDOWN_MS,
    ) => {
      if (!startGuardedAction(key, cooldownMs)) return false;
      try {
        await action();
        return true;
      } finally {
        finishGuardedAction(key);
      }
    },
    [finishGuardedAction, startGuardedAction],
  );

  const loadInitial = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError("");
    try {
      const [accessRes, page] = await Promise.all([
        getChatAccess(id),
        getChatMessages(id, { limit: MESSAGE_PAGE_LIMIT }),
      ]);
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
    const typingTimeouts = typingTimeoutsRef.current;

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
      if (String(message.tournament) !== id) return;
      const own = getUserId(message.sender) === currentUserId;
      setMessages((current) => mergeMessage(current, message));
      const el = scrollRef.current;
      const nearBottom =
        !el || el.scrollHeight - el.scrollTop - el.clientHeight < 180;
      if (nearBottom || own) {
        setTimeout(() => scrollToBottom(), 0);
      } else {
        setNewMessageCount((count) => Math.min(count + 1, 99));
      }
    };
    const handlePresence = (payload: ChatPresencePayload) => {
      if (payload.tournamentId === id) setPresence(payload);
    };
    const handleTyping = (payload: {
      tournamentId: string;
      userId: string;
      isTyping: boolean;
    }) => {
      if (payload.tournamentId !== id || payload.userId === currentUserId)
        return;
      setTypingUsers((current) => {
        const next = current.filter((userId) => userId !== payload.userId);
        return payload.isTyping ? [...next, payload.userId] : next;
      });
      const previousTimer = typingTimeoutsRef.current.get(payload.userId);
      if (previousTimer) window.clearTimeout(previousTimer);
      const timer = window.setTimeout(() => {
        setTypingUsers((current) =>
          current.filter((userId) => userId !== payload.userId),
        );
        typingTimeoutsRef.current.delete(payload.userId);
      }, 2500);
      typingTimeoutsRef.current.set(payload.userId, timer);
    };
    const handleUpdated = (message: ChatMessage) =>
      setMessages((current) => mergeMessage(current, message));
    const handlePinned = (message: ChatMessage) =>
      setAccess((current) =>
        current ? { ...current, pinnedMessage: message } : current,
      );
    const handleUnpinned = () =>
      setAccess((current) =>
        current ? { ...current, pinnedMessage: null } : current,
      );
    const handleModeration = (payload: {
      state?: { slowModeSeconds?: number; announcement?: { body?: string } };
    }) => {
      if (typeof payload.state?.slowModeSeconds === "number")
        setSlowModeSeconds(payload.state.slowModeSeconds);
      if (payload.state?.announcement)
        setAnnouncement(payload.state.announcement.body || "");
    };
    const handleForceLeave = (payload: {
      tournamentId: string;
      reason?: string;
    }) => {
      if (payload.tournamentId !== id) return;
      toast.error("Room chat closed", {
        description:
          payload.reason || "You no longer have access to this chat.",
      });
      navigate(`/tournament/${id}`, { replace: true });
    };
    const handleChatError = (payload: { message?: string }) => {
      toast.error("Chat action failed", { description: payload.message });
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
    socket.on("chat:error", handleChatError);

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
      socket.off("chat:error", handleChatError);
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
      if (readTimerRef.current) window.clearTimeout(readTimerRef.current);
      typingTimeouts.forEach((timer) => window.clearTimeout(timer));
      typingTimeouts.clear();
    };
  }, [currentUserId, id, navigate, scrollToBottom]);

  useEffect(() => {
    if (!id || !lastMessage?._id || !currentUserId) return;
    if (readTimerRef.current) window.clearTimeout(readTimerRef.current);
    readTimerRef.current = window.setTimeout(() => {
      const socket = getChatSocket();
      if (socket?.connected)
        socket.emit("chat:read", {
          tournamentId: id,
          messageId: lastMessage._id,
        });
      else markChatRead(id, lastMessage._id).catch(() => undefined);
    }, 800);
  }, [currentUserId, id, lastMessage?._id]);

  const loadOlder = useCallback(async () => {
    if (!id || !hasMore || loadingOlder) return;
    const el = scrollRef.current;
    const oldHeight = el?.scrollHeight || 0;
    setLoadingOlder(true);
    try {
      const page = await getChatMessages(id, {
        before: nextCursor || messages[0]?.createdAt,
        limit: MESSAGE_PAGE_LIMIT,
      });
      setMessages((current) =>
        uniqueMessages([...(page.messages || []), ...current]),
      );
      setHasMore(Boolean(page.hasMore));
      setNextCursor(page.nextCursor || null);
      requestAnimationFrame(() => {
        if (!el) return;
        el.scrollTop = el.scrollHeight - oldHeight;
      });
    } catch (error) {
      toast.error("Load older messages failed", {
        description: getErrorMessage(error),
      });
    } finally {
      setLoadingOlder(false);
    }
  }, [hasMore, id, loadingOlder, messages, nextCursor]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = distanceFromBottom < 140;
    if (isAtBottomRef.current) setNewMessageCount(0);
    if (el.scrollTop <= 80) loadOlder();
  };

  const emitTyping = (isTyping: boolean) => {
    const socket = getChatSocket();
    const now = Date.now();
    if (isTyping && now - lastTypingEmitRef.current < 900) return;
    if (isTyping) lastTypingEmitRef.current = now;
    if (socket?.connected && id)
      socket.emit("chat:typing", { tournamentId: id, isTyping });
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    emitTyping(true);
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => emitTyping(false), 1200);
  };

  const handleAttach = async (files: FileList | null) => {
    if (!files || !id) return;
    const nextFiles = Array.from(files).slice(
      0,
      Math.max(0, 4 - attachments.length),
    );
    if (!nextFiles.length) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of nextFiles) {
        uploaded.push(await uploadChatAttachment(id, file));
      }
      setAttachments((current) => [...current, ...uploaded].slice(0, 4));
    } catch (error) {
      toast.error("Upload failed", {
        description: getErrorMessage(error, "Could not upload attachment."),
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const sendViaSocket = (payload: Record<string, unknown>) =>
    new Promise<ChatMessage>((resolve, reject) => {
      const socket = getChatSocket();
      if (!socket?.connected)
        return reject(new Error("Socket is not connected"));
      socket.emit("chat:message", payload as never, (ack) => {
        if (ack?.ok && ack.data) resolve(ack.data);
        else reject(new Error(ack?.message || "Message failed"));
      });
    });

  const emitMessageAction = (
    event: "chat:edit" | "chat:delete" | "chat:reaction" | "chat:pin",
    payload: Record<string, unknown>,
  ) =>
    new Promise<ChatMessage>((resolve, reject) => {
      const socket = getChatSocket();
      if (!socket?.connected)
        return reject(new Error("Socket is not connected"));
      const emit = socket.emit.bind(socket) as (
        eventName: typeof event,
        data: Record<string, unknown>,
        callback: (ack?: { ok?: boolean; data?: unknown; message?: string }) => void,
      ) => void;
      emit(event, payload, (ack) => {
        if (ack?.ok && ack.data) resolve(ack.data as ChatMessage);
        else reject(new Error(ack?.message || "Chat action failed"));
      });
    });

  const updateMessageViaSocket = async (
    event: "chat:edit" | "chat:delete" | "chat:reaction" | "chat:pin",
    payload: Record<string, unknown>,
    fallback: () => Promise<ChatMessage>,
  ) => {
    const socket = getChatSocket();
    if (socket?.connected) return emitMessageAction(event, payload);
    return fallback();
  };

  const handleSend = async () => {
    if (!id || uploading || !profile) return;
    const body = input.trim();
    if (!body && attachments.length === 0) return;

    const actionKey = editing
      ? `edit:${editing._id}`
      : `send:${id}:${body}:${replyTo?._id || ""}:${attachments.map((attachment) => attachment.url).join("|")}`;
    if (
      !startGuardedAction(
        actionKey,
        editing ? CHAT_ACTION_COOLDOWN_MS : CHAT_SEND_COOLDOWN_MS,
      )
    )
      return;

    let optimisticClientRequestId = "";
    let restoreAttachments: ChatAttachment[] = [];
    let restoreReply: ChatMessage | null = null;
    setPendingSendCount((count) => count + 1);
    try {
      if (editing) {
        const previousMessage = editing;
        const now = new Date().toISOString();
        const optimisticEdit: ChatMessage = {
          ...previousMessage,
          body,
          editedAt: now,
          updatedAt: now,
          metadata: { ...(previousMessage.metadata || {}), optimistic: true },
        };
        setMessages((current) => mergeMessage(current, optimisticEdit));
        setEditing(null);
        setInput("");
        setEmojiOpen(false);

        try {
          const updated = await updateMessageViaSocket(
            "chat:edit",
            { messageId: previousMessage._id, body },
            () => editChatMessage(previousMessage._id, body),
          );
          setMessages((current) => mergeMessage(current, updated));
        } catch (error) {
          setMessages((current) => mergeMessage(current, previousMessage));
          setEditing(previousMessage);
          setInput(body);
          toast.error("Edit failed", {
            description: getErrorMessage(error, "Message could not be edited."),
          });
        }
      } else {
        const clientRequestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const capturedAttachments = attachments;
        const capturedReply = replyTo;
        optimisticClientRequestId = clientRequestId;
        restoreAttachments = capturedAttachments;
        restoreReply = capturedReply;
        const payload = {
          tournamentId: id,
          body,
          attachments: capturedAttachments,
          replyTo: capturedReply?._id || null,
          metadata: { clientRequestId },
        };

        const optimisticMessage = createOptimisticMessage({
          tournamentId: id,
          currentUser: profile,
          body,
          attachments: capturedAttachments,
          replyTo: capturedReply,
          clientRequestId,
        });

        setMessages((current) => mergeMessage(current, optimisticMessage));
        setInput("");
        setReplyTo(null);
        setAttachments([]);
        setEmojiOpen(false);
        setTimeout(() => scrollToBottom("auto"), 0);

        const socket = getChatSocket();
        const sent = socket?.connected
          ? await sendViaSocket(payload)
          : await sendChatMessage(id, payload);
        setMessages((current) => mergeMessage(current, sent));
      }
      setTimeout(() => scrollToBottom(), 0);
    } catch (error) {
      if (optimisticClientRequestId) {
        setMessages((current) =>
          current.filter(
            (message) =>
              getClientRequestId(message) !== optimisticClientRequestId,
          ),
        );
        setInput((current) => current || body);
        setAttachments((current) =>
          current.length ? current : restoreAttachments,
        );
        setReplyTo((current) => current || restoreReply);
      }
      toast.error("Send failed", {
        description: getErrorMessage(error, "Message could not be sent."),
      });
    } finally {
      setPendingSendCount((count) => Math.max(0, count - 1));
      finishGuardedAction(actionKey);
    }
  };

  const handleDelete = (message: ChatMessage) => {
    if (!window.confirm("Delete this message?")) return;
    const previousMessage = message;
    void runGuardedAction(`delete:${message._id}`, async () => {
      const now = new Date().toISOString();
      setMessages((current) =>
        mergeMessage(current, {
          ...message,
          body: "This message was deleted",
          attachments: [],
          status: "deleted",
          deletedAt: now,
          updatedAt: now,
        }),
      );
      try {
        const updated = await updateMessageViaSocket(
          "chat:delete",
          { messageId: message._id },
          () => deleteChatMessage(message._id),
        );
        setMessages((current) => mergeMessage(current, updated));
      } catch (error) {
        setMessages((current) => mergeMessage(current, previousMessage));
        toast.error("Delete failed", { description: getErrorMessage(error) });
      }
    });
  };

  const handleReact = (message: ChatMessage, emoji: string) => {
    if (!currentUserId || isOptimisticMessage(message)) return;
    const previousMessage = message;
    void runGuardedAction(`react:${message._id}:${emoji}`, async () => {
      setMessages((current) =>
        mergeMessage(
          current,
          toggleLocalReaction(message, emoji, currentUserId),
        ),
      );
      try {
        const updated = await updateMessageViaSocket(
          "chat:reaction",
          { messageId: message._id, emoji },
          () => reactToChatMessage(message._id, emoji),
        );
        setMessages((current) => mergeMessage(current, updated));
      } catch (error) {
        setMessages((current) => mergeMessage(current, previousMessage));
        toast.error("Reaction failed", { description: getErrorMessage(error) });
      }
    });
  };

  const handlePin = (message: ChatMessage) => {
    if (isOptimisticMessage(message)) return;
    const previousPinned = access?.pinnedMessage || null;
    void runGuardedAction(`pin:${message._id}`, async () => {
      const optimisticPinned = {
        ...message,
        pinnedAt: new Date().toISOString(),
      };
      setAccess((current) =>
        current ? { ...current, pinnedMessage: optimisticPinned } : current,
      );
      setMessages((current) => mergeMessage(current, optimisticPinned));
      try {
        const pinned = await updateMessageViaSocket(
          "chat:pin",
          { messageId: message._id },
          () => pinChatMessage(message._id),
        );
        setAccess((current) =>
          current ? { ...current, pinnedMessage: pinned } : current,
        );
        setMessages((current) => mergeMessage(current, pinned));
      } catch (error) {
        setAccess((current) =>
          current ? { ...current, pinnedMessage: previousPinned } : current,
        );
        toast.error("Pin failed", { description: getErrorMessage(error) });
      }
    });
  };

  const handleUnpin = async () => {
    if (!id) return;
    const previousPinned = access?.pinnedMessage || null;
    await runGuardedAction(`unpin:${id}`, async () => {
      setAccess((current) =>
        current ? { ...current, pinnedMessage: null } : current,
      );
      const socket = getChatSocket();
      try {
        if (socket?.connected) {
          await new Promise((resolve, reject) => {
            socket.emit("chat:unpin", { tournamentId: id }, (ack) => {
              if (ack?.ok) resolve(ack.data);
              else reject(new Error(ack?.message || "Unpin failed"));
            });
          });
        } else {
          await unpinChatMessage(id);
        }
      } catch (error) {
        setAccess((current) =>
          current ? { ...current, pinnedMessage: previousPinned } : current,
        );
        toast.error("Unpin failed", { description: getErrorMessage(error) });
      }
    });
  };

  const handleReport = async (message: ChatMessage) => {
    if (isOptimisticMessage(message)) return;
    const actionKey = `report:${message._id}`;
    if (!startGuardedAction(actionKey, 2500)) return;
    try {
      const reason = window.prompt("Why are you reporting this message?");
      if (!reason?.trim()) return;
      await reportChatMessage(message._id, reason.trim());
      toast.success("Message reported");
    } catch (error) {
      toast.error("Report failed", { description: getErrorMessage(error) });
    } finally {
      finishGuardedAction(actionKey);
    }
  };

  const handleModerateUser = async (
    message: ChatMessage,
    action: "mute" | "ban",
  ) => {
    if (!id || !message.sender?._id || isOptimisticMessage(message)) return;
    const actionKey = `moderate:${action}:${message.sender._id}`;
    if (!startGuardedAction(actionKey, 2500)) return;
    try {
      const duration = window.prompt(
        `${action === "mute" ? "Mute" : "Ban"} duration in minutes. Leave blank for permanent.`,
      );
      const reason = window.prompt("Reason for moderation") || "";
      await moderateChatRoom(id, {
        action,
        targetUser: message.sender._id,
        durationMinutes: duration ? Number(duration) : 0,
        reason,
      });
      toast.success(action === "mute" ? "User muted" : "User banned");
    } catch (error) {
      toast.error("Moderation failed", {
        description: getErrorMessage(error),
      });
    } finally {
      finishGuardedAction(actionKey);
    }
  };

  const handleShareRoom = () => {
    void runGuardedAction(
      `share-room:${id}`,
      async () => {
        const socket = getChatSocket();
        if (!socket?.connected || !id) {
          toast.error("Chat is reconnecting", {
            description: "Try again in a moment.",
          });
          return;
        }
        await new Promise((resolve, reject) => {
          socket.emit("chat:share-room", { tournamentId: id }, (ack) => {
            if (ack?.ok) resolve(ack.data);
            else reject(new Error(ack?.message || "Share room failed"));
          });
        }).catch((error) => {
          toast.error("Share room failed", {
            description: getErrorMessage(error),
          });
        });
      },
      2500,
    );
  };

  const handleSaveModeration = async () => {
    if (!id) return;
    await runGuardedAction(
      `save-moderation:${id}`,
      async () => {
        try {
          await moderateChatRoom(id, { action: "slow_mode", slowModeSeconds });
          if (announcement.trim()) {
            await moderateChatRoom(id, {
              action: "announcement",
              body: announcement.trim(),
            });
          }
          toast.success("Chat settings updated");
          setModerationOpen(false);
        } catch (error) {
          toast.error("Moderation update failed", {
            description: getErrorMessage(error),
          });
        }
      },
      2500,
    );
  };

  const startEdit = (message: ChatMessage) => {
    setEditing(message);
    setReplyTo(null);
    setInput(message.body || "");
  };

  return (
    <div className="arena-shell flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden bg-background">
      <style>{`
        .chat-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 2.5rem;
          height: 2.5rem;
          border-radius: var(--radius-card);
          border: 1px solid hsl(var(--border) / 0.55);
          background: hsl(var(--card) / 0.95);
          color: hsl(var(--muted-foreground));
          font-size: 0.8rem;
          touch-action: manipulation;
          transition: transform 140ms ease, border-color 140ms ease, color 140ms ease;
        }
        .chat-action:active { transform: scale(0.94); }
        .chat-action:hover { color: hsl(var(--foreground)); border-color: hsl(var(--primary) / 0.45); }
        .chat-scroll {
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
          scroll-padding-bottom: calc(6rem + env(safe-area-inset-bottom));
          contain: layout paint;
        }
        .chat-bubble {
          box-shadow: inset 0 1px 0 hsl(var(--foreground) / 0.08);
        }
        .voice-avatar,
        .voice-count {
          display: grid;
          height: 2rem;
          min-width: 2rem;
          place-items: center;
          border-radius: 999px;
          border: 1px solid hsl(var(--border) / 0.75);
          background: hsl(var(--card) / 0.92);
          color: hsl(var(--foreground));
          font-family: var(--font-heading, inherit);
          font-size: 0.7rem;
          font-weight: 800;
          box-shadow: none;
          transition: border-color 140ms ease, background-color 140ms ease, transform 140ms ease;
        }
        .voice-avatar-speaking {
          border-color: hsl(var(--accent) / 0.65);
          background: hsl(var(--accent) / 0.16);
          color: hsl(var(--accent));
          transform: translateY(-1px);
        }
        .voice-count {
          padding-inline: 0.45rem;
          color: hsl(var(--muted-foreground));
        }
        .chat-composer {
          background:
            linear-gradient(180deg, hsl(var(--card) / 0.98), hsl(var(--background) / 0.96));
          box-shadow: inset 0 1px 0 hsl(var(--foreground) / 0.08);
        }
        .chat-composer-action {
          display: grid;
          height: 2.75rem;
          width: 2.75rem;
          flex-shrink: 0;
          place-items: center;
          border-radius: var(--radius-card);
          color: hsl(var(--muted-foreground));
          touch-action: manipulation;
          transition: background-color 140ms ease, color 140ms ease, transform 140ms ease;
        }
        .chat-composer-action:hover {
          background: hsl(var(--primary) / 0.1);
          color: hsl(var(--foreground));
        }
        .chat-composer-action:active {
          transform: scale(0.94);
        }
        @media (max-width: 640px) {
          .chat-bubble {
            box-shadow: inset 0 1px 0 hsl(var(--foreground) / 0.035);
          }
          .chat-scroll {
            scroll-padding-bottom: calc(6rem + env(safe-area-inset-bottom));
          }
        }
        @media (pointer: coarse) and (max-width: 640px) {
          .chat-action,
          .chat-composer-action {
            min-width: 3rem;
            height: 3rem;
          }
          .chat-action {
            font-size: 0.84rem;
          }
        }
      `}</style>

      <header className="sticky top-0 z-20 shrink-0 border-b border-glass-border bg-background/95">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3 sm:px-5">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate(-1)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-glass-border bg-card/95"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </motion.button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 shrink-0 text-primary" />
              <h1 className="truncate font-display text-base font-extrabold uppercase tracking-tight text-primary sm:text-lg">
                {access?.tournament.title || "Room Chat"}
              </h1>
            </div>
            <p className="truncate text-[11px] text-muted-foreground">
              {presence?.onlineCount || 0} online {" | "}{" "}
              {access?.participantCount || 0} members
            </p>
          </div>
          <VoiceDock
            voice={voice}
            currentUserId={currentUserId}
            connected={connected}
            canJoin={Boolean(access && currentUserId)}
          />
          <SocketStatus connected={connected} />
          {canModerate && (
            <button
              type="button"
              onClick={() => setModerationOpen((value) => !value)}
              className="grid h-10 w-10 place-items-center rounded-md border border-primary/30 bg-primary/10 text-primary"
              aria-label="Moderation controls"
            >
              <Shield className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {moderationOpen && canModerate && (
        <div className="shrink-0 border-b border-glass-border bg-card/95 px-4 py-3">
          <div className="mx-auto grid w-full max-w-5xl gap-2 sm:grid-cols-[160px_1fr_auto_auto]">
            <select
              value={slowModeSeconds}
              onChange={(event) =>
                setSlowModeSeconds(Number(event.target.value))
              }
              className="rounded-sm border border-glass-border bg-background px-3 py-2 text-sm font-heading"
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
              className="rounded-sm border border-glass-border bg-background px-3 py-2 text-sm font-heading outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={handleShareRoom}
              className="inline-flex items-center justify-center gap-2 rounded-sm border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-heading text-primary"
            >
              <Clipboard className="h-4 w-4" />
              Share Room
            </button>
            <button
              type="button"
              onClick={handleSaveModeration}
              className="rounded-sm bg-primary px-4 py-2 text-sm font-heading font-bold text-primary-foreground"
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
            <span className="min-w-0 flex-1 truncate">
              {access.pinnedMessage.body || access.pinnedMessage.type}
            </span>
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

      <main
        ref={scrollRef}
        onScroll={handleScroll}
        className="chat-scroll arena-scrollbar mx-auto min-h-0 w-full max-w-5xl flex-1 overflow-y-auto px-4 sm:px-5"
      >
        {loading ? (
          <SkeletonMessages />
        ) : loadError ? (
          <div className="flex min-h-[50vh] items-center justify-center">
            <GlassCard className="w-full max-w-sm text-center">
              <Shield className="mx-auto mb-3 h-10 w-10 text-amber-300" />
              <h2 className="font-heading text-lg font-bold">
                Room chat locked
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
            </GlassCard>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex min-h-[50vh] items-center justify-center">
            <GlassCard className="w-full max-w-sm text-center">
              <MessageCircle className="mx-auto mb-3 h-10 w-10 text-primary" />
              <h2 className="font-heading text-lg font-bold">
                No messages yet
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Joined players will see room updates here.
              </p>
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

      {newMessageCount > 0 && (
        <button
          type="button"
          onClick={() => scrollToBottom()}
          className="arena-focus fixed bottom-[calc(4.75rem_+_env(safe-area-inset-bottom))] left-1/2 z-30 -translate-x-1/2 rounded-lg border border-cyan-400/30 bg-cyan-400/15 px-3 py-2 font-heading text-xs font-bold text-cyan-100 shadow-[0_8px_20px_rgb(0_0_0/0.2)]"
        >
          {newMessageCount} new message{newMessageCount > 1 ? "s" : ""}
        </button>
      )}

      <footer className="sticky bottom-0 z-20 shrink-0 border-t border-glass-border bg-background/98 px-2.5 py-2 sm:px-5">
        <div className="mx-auto w-full max-w-5xl pb-[env(safe-area-inset-bottom)]">
          {typingLabel && (
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] text-primary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              {typingLabel}...
            </p>
          )}
          {!loadError && !canSend && (
            <div className="mb-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
              {access?.permissions.mutedUntil
                ? "You are muted in this room."
                : "Chat is read-only for your account."}
            </div>
          )}

          {!loadError && (replyTo || editing || attachments.length > 0) && (
            <div className="mb-1.5 rounded-lg border border-glass-border bg-card/80 p-2">
              {replyTo && (
                <div className="flex items-center gap-2">
                  <Reply className="h-4 w-4 text-primary" />
                  <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    Replying to{" "}
                    <span className="font-bold text-foreground">
                      {replyTo.sender?.username || "message"}
                    </span>
                    : {replyTo.body}
                  </p>
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    className="grid h-7 w-7 place-items-center rounded-full"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              {editing && (
                <div className="flex items-center gap-2">
                  <Edit3 className="h-4 w-4 text-primary" />
                  <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    Editing message
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(null);
                      setInput("");
                    }}
                    className="grid h-7 w-7 place-items-center rounded-full"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              {attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {attachments.map((attachment) => (
                    <span
                      key={attachment.url}
                      className="inline-flex max-w-full items-center gap-2 rounded-full border border-glass-border bg-background/50 px-3 py-1 text-xs"
                    >
                      {attachment.type === "image" ? (
                        <Image className="h-3.5 w-3.5" />
                      ) : (
                        <File className="h-3.5 w-3.5" />
                      )}
                      <span className="max-w-[160px] truncate">
                        {attachment.name}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setAttachments((current) =>
                            current.filter(
                              (item) => item.url !== attachment.url,
                            ),
                          )
                        }
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {!loadError && emojiOpen && (
            <div className="mb-1.5 flex flex-wrap gap-1.5 rounded-lg border border-glass-border bg-card/90 p-2">
              {CHAT_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setInput((value) => `${value}${emoji}`)}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-glass-border bg-background/50 text-lg transition-colors hover:bg-primary/10"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          <div className="chat-composer flex min-h-12 items-end gap-1.5 rounded-lg border border-glass-border p-1.5 focus-within:border-primary/70">
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
              className="chat-composer-action disabled:opacity-50"
              aria-label="Attach file"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              disabled={Boolean(loadError) || !canSend}
              onClick={() => setEmojiOpen((value) => !value)}
              className="chat-composer-action disabled:opacity-50"
              aria-label="Emoji picker"
            >
              <Smile className="h-4 w-4" />
            </button>
            <textarea
              value={input}
              onChange={(event) => handleInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              disabled={Boolean(loadError) || !canSend}
              rows={1}
              maxLength={2000}
              placeholder={
                canSend
                  ? "Message room... use @username"
                  : "You cannot send messages"
              }
              className="max-h-24 min-h-9 min-w-0 flex-1 resize-none bg-transparent px-1.5 py-2 text-sm leading-5 outline-none placeholder:text-muted-foreground/60 disabled:opacity-60"
            />
            {slowModeSeconds > 0 && (
              <span className="mb-1 hidden shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2 py-1 font-heading text-[10px] text-primary min-[520px]:inline-flex">
                {slowModeSeconds}s
              </span>
            )}
            <button
              type="button"
              disabled={
                Boolean(loadError) ||
                !canSend ||
                uploading ||
                (!input.trim() && attachments.length === 0)
              }
              onClick={handleSend}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-[0_6px_16px_hsl(var(--primary)/0.14)] transition-colors active:scale-[0.98] hover:bg-primary/90 disabled:opacity-50"
              aria-label="Send message"
            >
              {sending && !input.trim() && attachments.length === 0 ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editing ? (
                <CheckCheck className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default TournamentCommentsScreen;
