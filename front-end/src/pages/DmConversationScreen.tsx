import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Ban,
  Check,
  CheckCheck,
  ImagePlus,
  MoreVertical,
  Send,
  ShieldAlert,
  Smile,
  Trash2,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  acceptDmRequest,
  blockDmConversation,
  deleteDmConversation,
  getDmConversation,
  listDmMessages,
  markDmRead,
  reportDmConversation,
  sendDmMessage,
  uploadDmAttachment,
  type DmAttachment,
  type DmConversation,
  type DmMessage,
} from "@/api/dm";
import { EmptyState, SkeletonBlock, StatusPill } from "@/components/design-system";
import { UserAvatar } from "@/components/identity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { getDmSocket } from "@/lib/dm-socket";
import { cn } from "@/lib/utils";

const makeClientRequestId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `dm-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const getMessageTypeForAttachments = (attachments: DmAttachment[]): DmMessage["type"] => {
  if (!attachments.length) return "text";
  if (attachments[0].type === "image") return "image";
  if (attachments[0].type === "voice") return "voice_note";
  return "file";
};

const getSenderId = (message: DmMessage) =>
  typeof message.sender === "string" ? message.sender : message.sender?._id;

const getMessageRequestId = (message: DmMessage) =>
  message.clientRequestId ||
  (typeof message.metadata?.clientRequestId === "string" ? message.metadata.clientRequestId : "");

const sortMessages = (messages: DmMessage[]) =>
  [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

const mergeDmMessages = (messages: DmMessage[]) => {
  const byRequestId = new Map<string, DmMessage>();
  const withoutRequestId = new Map<string, DmMessage>();

  messages.forEach((message) => {
    const requestId = getMessageRequestId(message);
    if (!requestId) {
      withoutRequestId.set(message._id, message);
      return;
    }

    const existing = byRequestId.get(requestId);
    const existingIsTemp = existing?._id.startsWith("temp-");
    const nextIsReal = !message._id.startsWith("temp-");
    if (!existing || existingIsTemp || nextIsReal) {
      byRequestId.set(requestId, message);
    }
  });

  const byId = new Map<string, DmMessage>();
  [...byRequestId.values(), ...withoutRequestId.values()].forEach((message) => {
    byId.set(message._id, message);
  });

  return sortMessages([...byId.values()]);
};

const formatTime = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const StatusIcon = ({ message, isMine }: { message: DmMessage; isMine: boolean }) => {
  if (!isMine) return null;
  if (message.deliveryStatus === "read") return <CheckCheck className="h-3 w-3 text-[#0c7ea1]" />;
  if (message.deliveryStatus === "delivered") return <CheckCheck className="h-3 w-3 text-[#386778]" />;
  if (message.deliveryStatus === "failed") return <ShieldAlert className="h-3 w-3 text-destructive" />;
  return <Check className="h-3 w-3 text-[#386778]" />;
};

const AttachmentPreview = ({ attachment }: { attachment: DmAttachment }) => {
  if (attachment.type === "image") {
    return (
      <a href={attachment.url} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-md">
        <img
          src={attachment.thumbUrl || attachment.url}
          alt={attachment.name || "Image attachment"}
          loading="lazy"
          className="max-h-56 w-full max-w-[260px] object-cover"
        />
      </a>
    );
  }
  return (
    <a
      href={attachment.downloadUrl || attachment.url}
      target="_blank"
      rel="noreferrer"
      className="mt-2 block rounded-md bg-background/65 px-3 py-2 text-xs text-primary"
    >
      {attachment.name || "Attachment"}
    </a>
  );
};

const DmConversationScreen = () => {
  const { conversationId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useCurrentProfile();
  const [body, setBody] = useState("");
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const typingStopTimer = useRef<number | null>(null);
  const sendingRef = useRef(false);

  const conversationKey = useMemo(() => ["dm", "conversation", conversationId] as const, [conversationId]);
  const messagesKey = useMemo(() => ["dm", "messages", conversationId] as const, [conversationId]);

  const { data: conversation, isLoading: conversationLoading } = useQuery({
    queryKey: conversationKey,
    queryFn: () => getDmConversation(conversationId),
    enabled: Boolean(conversationId),
    staleTime: 30_000,
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: messagesKey,
    queryFn: () => listDmMessages(conversationId, { limit: 50 }),
    enabled: Boolean(conversationId),
    staleTime: 15_000,
  });

  const isRecipientRequest = Boolean(
    conversation?.request.status === "pending" &&
    conversation.request.requestedBy &&
    conversation.request.requestedBy !== profile?._id,
  );
  const isSenderRequest = Boolean(
    conversation?.request.status === "pending" &&
    conversation.request.requestedBy === profile?._id,
  );
  const composerDisabled = !conversation || conversation.isBlocked || isRecipientRequest;

  const acceptMutation = useMutation({
    mutationFn: () => acceptDmRequest(conversationId),
    onSuccess: (next) => {
      queryClient.setQueryData(conversationKey, next);
      toast.success("Message request accepted");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not accept request"),
  });

  const blockMutation = useMutation({
    mutationFn: () => blockDmConversation(conversationId),
    onSuccess: (next) => {
      queryClient.setQueryData(conversationKey, next);
      toast.success("User blocked");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not block user"),
  });

  useEffect(() => {
    const socket = getDmSocket();
    if (!socket || !conversationId) return;

    socket.emit("conversation:join", { conversationId });
    socket.emit("message:delivered", { conversationId });

    const handleMessage = (payload: { conversationId: string; message: DmMessage }) => {
      if (payload.conversationId !== conversationId) return;
      queryClient.setQueryData<DmMessage[]>(messagesKey, (old = []) => {
        return mergeDmMessages([...old, payload.message]);
      });
      void markDmRead(conversationId).catch(() => undefined);
    };

    const handleConversation = (payload: { conversationId: string; conversation: DmConversation }) => {
      if (payload.conversationId !== conversationId) return;
      queryClient.setQueryData(conversationKey, payload.conversation);
    };

    const handleTypingStart = (payload: { conversationId: string; userId: string; username?: string }) => {
      if (payload.conversationId !== conversationId || payload.userId === profile?._id) return;
      setTypingUser(payload.username || "Typing");
    };

    const handleTypingStop = (payload: { conversationId: string }) => {
      if (payload.conversationId === conversationId) setTypingUser(null);
    };

    const handleDelete = (payload: { conversationId: string }) => {
      if (payload.conversationId === conversationId) navigate("/messages", { replace: true });
    };

    socket.on("message:receive", handleMessage);
    socket.on("conversation:update", handleConversation);
    socket.on("conversation:accepted", handleConversation);
    socket.on("conversation:block", handleConversation);
    socket.on("typing:start", handleTypingStart);
    socket.on("typing:stop", handleTypingStop);
    socket.on("conversation:delete", handleDelete);

    return () => {
      socket.emit("conversation:leave", { conversationId });
      socket.off("message:receive", handleMessage);
      socket.off("conversation:update", handleConversation);
      socket.off("conversation:accepted", handleConversation);
      socket.off("conversation:block", handleConversation);
      socket.off("typing:start", handleTypingStart);
      socket.off("typing:stop", handleTypingStop);
      socket.off("conversation:delete", handleDelete);
      if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);
    };
  }, [conversationId, conversationKey, messagesKey, navigate, profile?._id, queryClient]);

  useEffect(() => {
    if (!conversationId || messages.length === 0) return;
    void markDmRead(conversationId).catch(() => undefined);
  }, [conversationId, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, typingUser]);

  const emitTyping = () => {
    const socket = getDmSocket();
    if (!socket || !conversationId || composerDisabled) return;
    socket.emit("typing:start", { conversationId });
    if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);
    typingStopTimer.current = window.setTimeout(() => {
      socket.emit("typing:stop", { conversationId });
    }, 1300);
  };

  const addOptimisticMessage = (message: DmMessage) => {
    queryClient.setQueryData<DmMessage[]>(messagesKey, (old = []) => mergeDmMessages([...old, message]));
  };

  const replaceOptimisticMessage = (tempId: string, next: DmMessage) => {
    queryClient.setQueryData<DmMessage[]>(messagesKey, (old = []) =>
      mergeDmMessages(old.map((message) => (message._id === tempId ? next : message))),
    );
  };

  const sendViaSocket = (payload: Parameters<typeof sendDmMessage>[1], timeoutMs = 6500) =>
    new Promise<DmMessage>((resolve, reject) => {
      const socket = getDmSocket();
      if (!socket?.connected) {
        reject(new Error("Socket not connected"));
        return;
      }
      const timer = window.setTimeout(() => reject(new Error("Message timed out")), timeoutMs);
      socket.emit("message:send", { conversationId, ...payload }, (ack) => {
        window.clearTimeout(timer);
        if (!ack.ok || !ack.data) reject(new Error(ack.message || "Message failed"));
        else resolve(ack.data);
      });
    });

  const handleSend = async (attachments: DmAttachment[] = []) => {
    const text = body.trim();
    if ((!text && attachments.length === 0) || sending || sendingRef.current || composerDisabled) return;
    sendingRef.current = true;
    const clientRequestId = makeClientRequestId();
    const tempId = `temp-${clientRequestId}`;
    const optimistic: DmMessage = {
      _id: tempId,
      conversation: conversationId,
      sender: profile
        ? { _id: profile._id, username: profile.username, avatar: profile.avatar, role: profile.role }
        : "",
      type: getMessageTypeForAttachments(attachments),
      body: text || (attachments[0]?.name ?? "Attachment"),
      attachments,
      status: "active",
      deliveryStatus: "sent",
      readBy: [],
      deliveredTo: [],
      clientRequestId,
      metadata: { clientRequestId },
      createdAt: new Date().toISOString(),
    };

    setSending(true);
    setBody("");
    addOptimisticMessage(optimistic);

    try {
      const payload = { body: text, attachments, clientRequestId };
      const sent = await sendViaSocket(payload).catch(() => sendDmMessage(conversationId, payload));
      replaceOptimisticMessage(tempId, sent);
      void queryClient.invalidateQueries({ queryKey: ["dm", "conversations"] });
    } catch (error) {
      replaceOptimisticMessage(tempId, { ...optimistic, deliveryStatus: "failed" });
      toast.error(error instanceof Error ? error.message : "Message failed");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const handleAttach = async (file?: File) => {
    if (!file || uploading || composerDisabled) return;
    setUploading(true);
    try {
      const attachment = await uploadDmAttachment(conversationId, file);
      await handleSend([attachment]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleReport = async () => {
    const reason = window.prompt("Report reason: spam, harassment, scam, abuse, fake account", "spam");
    if (!reason) return;
    try {
      await reportDmConversation(conversationId, { reason });
      toast.success("Report submitted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Report failed");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this conversation from your inbox?")) return;
    try {
      await deleteDmConversation(conversationId);
      navigate("/messages", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete conversation");
    }
  };

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] flex-col bg-background text-foreground">
      <header className="flex shrink-0 items-center gap-3 border-b border-glass-border bg-background/98 px-3 py-2.5">
        <button type="button" onClick={() => navigate("/messages")} className="arena-icon-button" aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </button>
        {conversationLoading ? (
          <>
            <SkeletonBlock className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <SkeletonBlock className="h-3 w-32" />
              <SkeletonBlock className="h-3 w-20" />
            </div>
          </>
        ) : conversation ? (
          <>
            <UserAvatar user={conversation.otherUser} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-extrabold">{conversation.otherUser.username}</p>
              <div className="mt-0.5 flex items-center gap-2">
                {typingUser ? (
                  <span className="text-xs text-primary">{typingUser}...</span>
                ) : conversation.isBlocked ? (
                  <StatusPill tone="danger">Blocked</StatusPill>
                ) : isSenderRequest ? (
                  <span className="text-xs text-muted-foreground">Request pending</span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {conversation.otherUser.lastSeenAt ? `Last seen ${formatTime(conversation.otherUser.lastSeenAt)}` : "Direct message"}
                  </span>
                )}
              </div>
            </div>
            <div className="relative shrink-0">
              <button
                type="button"
                className="arena-icon-button"
                aria-label="Conversation actions"
                onClick={() => setShowActions((value) => !value)}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              {showActions && (
                <div className="absolute right-0 top-11 z-20 w-44 rounded-md border border-glass-border bg-card p-1 shadow-xl">
                  <button
                    type="button"
                    onClick={handleReport}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-xs text-destructive hover:bg-destructive/10"
                  >
                    <ShieldAlert className="h-4 w-4" /> Report
                  </button>
                  <button
                    type="button"
                    onClick={() => blockMutation.mutate()}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-xs text-destructive hover:bg-destructive/10"
                  >
                    <Ban className="h-4 w-4" /> Block
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-xs text-muted-foreground hover:bg-muted/60"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                </div>
              )}
            </div>
          </>
        ) : null}
      </header>

      {isRecipientRequest && (
        <div className="shrink-0 border-b border-secondary/25 bg-secondary/10 px-3 py-2">
          <p className="text-xs text-secondary-foreground">This user sent a message request. Accept to reply.</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => acceptMutation.mutate()} disabled={acceptMutation.isPending}>
              Accept
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate("/messages")}
            >
              Later
            </Button>
          </div>
        </div>
      )}

      <main
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_20%_20%,rgba(0,191,255,0.045),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.015),transparent)] px-2.5 py-3 sm:px-4"
      >
        {messagesLoading ? (
          <div className="space-y-4">
            <SkeletonBlock className="h-12 w-4/5 rounded-lg" />
            <SkeletonBlock className="ml-auto h-12 w-2/3 rounded-lg" />
            <SkeletonBlock className="h-16 w-3/4 rounded-lg" />
          </div>
        ) : messages.length === 0 ? (
          <EmptyState
            icon={Smile}
            title="Start the conversation"
            description="Keep match coordination clean, private, and focused."
          />
        ) : (
          <div className="space-y-1.5">
            {messages.map((message, index) => {
              const isMine = getSenderId(message) === profile?._id;
              const previous = messages[index - 1];
              const previousIsMine = previous ? getSenderId(previous) === profile?._id : false;
              const grouped = Boolean(previous && previousIsMine === isMine);
              return (
                <div
                  key={message._id}
                  className={cn("flex", isMine ? "justify-end" : "justify-start", grouped ? "mt-1" : "mt-2.5")}
                >
                  <div
                    className={cn(
                      "relative max-w-[78%] rounded-2xl px-3 py-2 text-[0.92rem] leading-snug shadow-[0_1px_1px_rgba(0,0,0,0.18)] sm:max-w-[70%]",
                      isMine
                        ? "rounded-br-[5px] bg-[#12bff3] text-[#06131b]"
                        : "rounded-bl-[5px] bg-[#171d27] text-foreground",
                      message.deliveryStatus === "failed" && "bg-destructive/15 text-destructive ring-1 ring-destructive/30",
                    )}
                  >
                    {message.body && <p className="whitespace-pre-wrap break-words pr-1">{message.body}</p>}
                    {message.attachments?.map((attachment, index) => (
                      <AttachmentPreview key={`${attachment.url}-${index}`} attachment={attachment} />
                    ))}
                    <div
                      className={cn(
                        "mt-1 flex min-w-[4.25rem] items-center justify-end gap-1 text-[0.66rem] leading-none",
                        isMine ? "text-[#0d3b4d]/75" : "text-muted-foreground/80",
                      )}
                    >
                      <span>{formatTime(message.createdAt)}</span>
                      <StatusIcon message={message} isMine={isMine} />
                    </div>
                  </div>
                </div>
              );
            })}
            {typingUser && (
              <p className="px-1 text-xs text-primary">{typingUser} is typing...</p>
            )}
          </div>
        )}
      </main>

      <footer className="shrink-0 border-t border-glass-border bg-background/98 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2">
        {conversation?.isBlocked ? (
          <p className="text-center text-xs text-muted-foreground">This conversation is blocked.</p>
        ) : isRecipientRequest ? (
          <p className="text-center text-xs text-muted-foreground">Accept the request to send a reply.</p>
        ) : (
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSend();
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.txt,.zip"
              className="hidden"
              onChange={(event) => void handleAttach(event.target.files?.[0])}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={uploading || composerDisabled}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach file"
              className="h-11 w-11 shrink-0 rounded-md border border-glass-border/45 bg-card/70 text-muted-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
            >
              <ImagePlus className="h-4 w-4" />
            </Button>
            <Input
              value={body}
              disabled={composerDisabled}
              onChange={(event) => {
                setBody(event.target.value);
                emitTyping();
              }}
              placeholder={isSenderRequest ? "Waiting for request acceptance..." : "Message..."}
              autoComplete="off"
              inputMode="text"
              className="h-11 min-h-11 flex-1 rounded-md border-glass-border/55 bg-card/95 px-3 text-[0.95rem] shadow-none placeholder:text-muted-foreground/60 focus-visible:border-primary/60 focus-visible:ring-1 focus-visible:ring-primary/35"
            />
            <Button
              type="submit"
              size="icon"
              disabled={sending || uploading || composerDisabled || !body.trim()}
              aria-label="Send message"
              className="h-11 w-11 shrink-0 rounded-md bg-primary text-primary-foreground shadow-none hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        )}
      </footer>
    </div>
  );
};

export default DmConversationScreen;
