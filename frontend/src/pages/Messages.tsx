import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ImagePlus,
  Loader2,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Pencil,
  Plus,
  Reply,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import type { Conversation, Media, Message, User } from "../types";
import { useQuery, useDebounced } from "../hooks/useApi";
import { useAuth } from "../store/auth";
import { useUI } from "../store/ui";
import { api, apiError } from "../lib/api";
import { getSocket } from "../lib/socket";
import { cn, formatDate, formatDateTime, timeAgo } from "../lib/utils";
import {
  Avatar,
  Badge,
  ConfirmDialog,
  Dropdown,
  EmptyState,
  Modal,
  PageLoader,
  Spinner,
} from "../components/ui";
import { AudioPlayer, ImageGrid } from "../components/Media";
import { ImageUploader } from "../components/ImageUploader";
import { VoiceRecorder } from "../components/VoiceRecorder";

interface ConversationListResponse {
  conversations: Conversation[];
}

function preview(message: Message | null): string {
  if (!message) return "Say hello";
  if (message.deletedAt) return "Message deleted";
  if (message.body) return message.body;
  if (message.media.some((item) => item.kind === "AUDIO")) return "Voice message";
  return "Photo";
}

function NewChatModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const pushToast = useUI((state) => state.pushToast);
  const [term, setTerm] = useState("");
  const q = useDebounced(term, 300);
  const { data, loading } = useQuery<{ users: User[] }>(
    q.trim().length >= 2 ? `/api/users/search?q=${encodeURIComponent(q.trim())}` : null,
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const start = async (user: User) => {
    setBusyId(user.id);
    try {
      const response = await api.post<{ conversation: { id: string } }>("/api/conversations", {
        userId: user.id,
      });
      onClose();
      navigate(`/messages/${response.data.conversation.id}`);
    } catch (error) {
      pushToast(apiError(error), { tone: "error" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Start a conversation"
      description="Search for a member by name or username."
    >
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search members…"
          className="input pl-10"
          autoFocus
        />
      </label>

      <div className="mt-4 min-h-[120px]">
        {term.trim().length < 2 ? (
          <p className="py-8 text-center text-sm text-muted">
            Type at least two characters to search the community.
          </p>
        ) : loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : !data || data.users.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No members match that search.</p>
        ) : (
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {data.users.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => start(user)}
                disabled={busyId !== null}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-raised"
              >
                <Avatar name={user.displayName} username={user.username} src={user.avatarUrl} size="sm" online={user.online} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{user.displayName}</span>
                  <span className="block truncate text-xs text-muted">@{user.username}</span>
                </span>
                {busyId === user.id ? <Spinner className="h-4 w-4" /> : <MessageCircle className="h-4 w-4 text-muted" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function ConversationList({
  activeId,
  onNewChat,
}: {
  activeId?: string;
  onNewChat: () => void;
}) {
  const user = useAuth((state) => state.user);
  const presence = useUI((state) => state.presence);
  const { data, loading } = useQuery<ConversationListResponse>("/api/conversations");
  const [filter, setFilter] = useState("");
  const conversations = data?.conversations ?? [];

  const visible = useMemo(() => {
    if (!filter.trim()) return conversations;
    const needle = filter.toLowerCase();
    return conversations.filter(
      (conversation) =>
        conversation.otherUser.displayName.toLowerCase().includes(needle) ||
        conversation.otherUser.username.toLowerCase().includes(needle),
    );
  }, [conversations, filter]);

  return (
    <aside className="flex h-full w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface sm:w-[330px]">
      <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
        <div>
          <h1 className="font-display text-lg font-semibold text-ink">
            Messages{" "}
            <span lang="am" className="font-ethiopic text-sm font-normal text-muted">
              መልዕክቶች
            </span>
          </h1>
          <p className="text-[11px] text-muted">
            {conversations.length} {conversations.length === 1 ? "conversation" : "conversations"}
          </p>
        </div>
        <button
          type="button"
          onClick={onNewChat}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-700 text-white transition hover:bg-brand-800"
          aria-label="Start a new conversation"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-line px-3 py-2.5">
        <label className="relative block">
          <span className="sr-only">Filter conversations</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter conversations"
            className="h-9 w-full rounded-lg border border-line bg-raised/60 pl-8 pr-3 text-xs text-ink placeholder:text-muted/70 focus:border-brand-400 focus:bg-surface focus:outline-none"
          />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="skeleton h-16 w-full" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="px-4">
            <EmptyState
              icon={MessageCircle}
              title={conversations.length === 0 ? "No messages yet" : "Nothing matches"}
              description={
                conversations.length === 0
                  ? "Start a quiet conversation with someone in the community."
                  : "Try a different name."
              }
              className="py-10"
              action={
                conversations.length === 0 ? (
                  <button type="button" className="btn-primary btn-sm" onClick={onNewChat}>
                    Start a conversation
                  </button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-line/70">
            {visible.map((conversation) => {
              const other = conversation.otherUser;
              const online = presence[other.id] ?? other.online;
              const active = conversation.id === activeId;
              return (
                <li key={conversation.id}>
                  <Link
                    to={`/messages/${conversation.id}`}
                    className={cn(
                      "flex items-center gap-3 px-3.5 py-3 transition",
                      active ? "bg-brand-50 dark:bg-brand-500/10" : "hover:bg-raised/70",
                    )}
                  >
                    <Avatar
                      name={other.displayName}
                      username={other.username}
                      src={other.avatarUrl}
                      size="md"
                      online={online}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-ink">{other.displayName}</p>
                        <span className="shrink-0 text-[10px] text-muted">
                          {conversation.lastMessage ? timeAgo(conversation.lastMessageAt) : ""}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={cn(
                            "truncate text-xs",
                            conversation.unreadCount > 0 ? "font-medium text-ink" : "text-muted",
                          )}
                        >
                          {preview(conversation.lastMessage)}
                        </p>
                        {conversation.unreadCount > 0 && (
                          <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-700 px-1 text-[9px] font-bold text-white">
                            {conversation.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {user && (
        <div className="border-t border-line p-3">
          <p className="flex items-center gap-1.5 text-[10px] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Messages are private between you and the other member.
          </p>
        </div>
      )}
    </aside>
  );
}

export function MessagesPage() {
  const [newChat, setNewChat] = useState(false);

  return (
    <>
      <div className="flex h-full min-h-0 gap-4">
        <ConversationList onNewChat={() => setNewChat(true)} />
        <div className="hidden flex-1 items-center justify-center rounded-2xl border border-line bg-surface sm:flex">
          <EmptyState
            icon={MessageCircle}
            title="Your conversations live here"
            description="Pick a conversation on the left, or start a new one with someone you'd like to get to know."
            action={
              <button type="button" className="btn-primary btn-sm" onClick={() => setNewChat(true)}>
                <Plus className="h-3.5 w-3.5" /> New conversation
              </button>
            }
            className="py-16"
          />
        </div>
      </div>
      <NewChatModal open={newChat} onClose={() => setNewChat(false)} />
    </>
  );
}

export function ConversationPage() {
  const { conversationId = "" } = useParams();
  const navigate = useNavigate();
  const user = useAuth((state) => state.user);
  const presence = useUI((state) => state.presence);
  const setUnread = useAuth((state) => state.setUnread);
  const pushToast = useUI((state) => state.pushToast);

  const { data: detail, loading: detailLoading, error: detailError } = useQuery<{
    conversation: Conversation;
    otherUser: User;
  }>(`/api/conversations/${conversationId}`);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);

  const [text, setText] = useState("");
  const [media, setMedia] = useState<Media[]>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showImages, setShowImages] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [sending, setSending] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newChat, setNewChat] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<number | null>(null);
  const typingStopRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeConversationRef = useRef(conversationId);
  activeConversationRef.current = conversationId;

  const other = detail?.otherUser;
  const online = other ? presence[other.id] ?? other.online : false;

  const appendMessage = useCallback((message: Message) => {
    setMessages((current) => {
      if (current.some((item) => item.id === message.id)) {
        return current.map((item) => (item.id === message.id ? message : item));
      }
      return [...current, message];
    });
  }, []);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<{
        messages: Message[];
        hasMore: boolean;
        nextCursor: string | null;
        unreadCount: number;
      }>(`/api/conversations/${conversationId}/messages?limit=40`);
      setMessages(response.data.messages);
      setHasMore(response.data.hasMore);
      setCursor(response.data.nextCursor);
      setUnread({ messages: response.data.unreadCount });
      getSocket()?.emit("conversation:read", { conversationId });
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [conversationId, setUnread]);

  useEffect(() => {
    setMessages([]);
    setCursor(null);
    setText("");
    setMedia([]);
    setReplyTo(null);
    setSearchTerm("");
    void loadMessages();
  }, [conversationId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onMessage = (message: Message) => {
      if (message.conversationId !== activeConversationRef.current) return;
      appendMessage(message);
      if (message.senderId !== user?.id) {
        socket.emit("conversation:read", { conversationId: activeConversationRef.current });
        api
          .post<{ unreadCount: number }>(`/api/conversations/${activeConversationRef.current}/read`)
          .then((response) => setUnread({ messages: response.data.unreadCount }))
          .catch(() => undefined);
      }
    };
    const onUpdated = (message: Message) => {
      if (message.conversationId !== activeConversationRef.current) return;
      setMessages((current) => current.map((item) => (item.id === message.id ? message : item)));
    };
    const onDeleted = (payload: { id: string; conversationId: string }) => {
      if (payload.conversationId !== activeConversationRef.current) return;
      setMessages((current) =>
        current.map((item) =>
          item.id === payload.id
            ? { ...item, body: null, deletedAt: new Date().toISOString(), media: [] }
            : item,
        ),
      );
    };
    const onRead = (payload: { conversationId: string; readerId: string; readAt: string }) => {
      if (payload.conversationId !== activeConversationRef.current) return;
      if (payload.readerId === user?.id) return;
      setMessages((current) =>
        current.map((item) =>
          item.senderId === user?.id && !item.readAt ? { ...item, readAt: payload.readAt } : item,
        ),
      );
    };
    const onTyping = (payload: {
      conversationId: string;
      userId: string;
      displayName: string;
      typing: boolean;
    }) => {
      if (payload.conversationId !== activeConversationRef.current) return;
      if (payload.userId === user?.id) return;
      setTypingUser(payload.typing ? payload.displayName : null);
    };
    const onReconnect = () => {
      void loadMessages();
    };

    socket.on("message:new", onMessage);
    socket.on("message:updated", onUpdated);
    socket.on("message:deleted", onDeleted);
    socket.on("messages:read", onRead);
    socket.on("typing:update", onTyping);
    socket.on("connect", onReconnect);

    return () => {
      socket.off("message:new", onMessage);
      socket.off("message:updated", onUpdated);
      socket.off("message:deleted", onDeleted);
      socket.off("messages:read", onRead);
      socket.off("typing:update", onTyping);
      socket.off("connect", onReconnect);
    };
  }, [appendMessage, loadMessages, setUnread, user?.id]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
      if (typingStopRef.current) window.clearTimeout(typingStopRef.current);
    };
  }, []);

  const loadEarlier = async () => {
    if (!cursor || loadingEarlier) return;
    setLoadingEarlier(true);
    try {
      const response = await api.get<{ messages: Message[]; nextCursor: string | null; hasMore: boolean }>(
        `/api/conversations/${conversationId}/messages?limit=30&cursor=${encodeURIComponent(cursor)}`,
      );
      setMessages((current) => [...response.data.messages, ...current]);
      setCursor(response.data.nextCursor);
      setHasMore(response.data.hasMore);
    } catch (err) {
      pushToast(apiError(err), { tone: "error" });
    } finally {
      setLoadingEarlier(false);
    }
  };

  const notifyTyping = () => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit("typing:start", { conversationId });
    if (typingStopRef.current) window.clearTimeout(typingStopRef.current);
    typingStopRef.current = window.setTimeout(() => {
      socket.emit("typing:stop", { conversationId });
    }, 1800);
  };

  const stopTyping = () => {
    if (typingStopRef.current) window.clearTimeout(typingStopRef.current);
    getSocket()?.emit("typing:stop", { conversationId });
  };

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    const body = text.trim();
    const mediaIds = media.map((item) => item.id);
    if ((!body && mediaIds.length === 0) || sending) return;

    setSending(true);
    const payload = {
      conversationId,
      body: body || undefined,
      mediaIds,
      replyToId: replyTo?.id,
    };

    const optimisticText = body;
    setText("");
    setMedia([]);
    setReplyTo(null);
    setShowImages(false);
    setShowVoice(false);
    stopTyping();

    const socket = getSocket();
    if (socket?.connected) {
      socket.emit(
        "message:send",
        payload,
        (response: { ok: boolean; message?: Message; error?: string }) => {
          if (response.ok && response.message) {
            appendMessage(response.message);
          } else {
            setText(optimisticText);
            pushToast(response.error ?? "Message could not be sent.", { tone: "error" });
          }
          setSending(false);
        },
      );
    } else {
      try {
        const response = await api.post<{ message: Message }>(
          `/api/conversations/${conversationId}/messages`,
          payload,
        );
        appendMessage(response.data.message);
      } catch (err) {
        setText(optimisticText);
        pushToast(apiError(err), { tone: "error" });
      } finally {
        setSending(false);
      }
    }

    window.setTimeout(() => textareaRef.current?.focus(), 30);
  };

  const filteredMessages = useMemo(() => {
    if (!searchTerm.trim()) return messages;
    const needle = searchTerm.toLowerCase();
    return messages.filter((message) => message.body?.toLowerCase().includes(needle));
  }, [messages, searchTerm]);

  if (detailLoading) return <PageLoader label="Opening conversation…" />;

  if (detailError || !detail) {
    return (
      <div className="card flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="font-display text-lg font-semibold text-ink">This conversation isn't available.</p>
          <p className="mt-1 text-sm text-muted">
            {detailError ?? "It may have been removed, or you are not a participant."}
          </p>
          <Link to="/messages" className="btn-primary mt-4">
            Back to messages
          </Link>
        </div>
      </div>
    );
  }

  let lastDate = "";
  let lastSender = "";

  return (
    <>
      <div className="flex h-full min-h-0 gap-4">
        <div className="hidden md:block">
          <ConversationList activeId={conversationId} onNewChat={() => setNewChat(true)} />
        </div>

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-surface">
          <header className="flex items-center gap-3 border-b border-line px-4 py-3">
            <button
              type="button"
              onClick={() => navigate("/messages")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-raised hover:text-ink md:hidden"
              aria-label="Back to inbox"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <Link to={`/u/${other?.username}`} className="flex min-w-0 items-center gap-3">
              <Avatar
                name={other?.displayName}
                username={other?.username}
                src={other?.avatarUrl}
                size="md"
                online={online}
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">{other?.displayName}</span>
                <span className="block truncate text-[11px] text-muted">
                  {typingUser ? (
                    <span className="text-brand-700 dark:text-brand-300">{typingUser} is typing…</span>
                  ) : online ? (
                    "Online now"
                  ) : (
                    `@${other?.username}`
                  )}
                </span>
              </span>
            </Link>

            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setSearchOpen((value) => !value);
                  setSearchTerm("");
                }}
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-raised",
                  searchOpen ? "text-brand-700" : "text-muted hover:text-ink",
                )}
                aria-label="Search this conversation"
              >
                <Search className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setNewChat(true)}
                className="hidden h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-raised hover:text-ink sm:inline-flex"
                aria-label="New conversation"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </header>

          {searchOpen && (
            <div className="border-b border-line bg-raised/40 px-4 py-2">
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search in this conversation…"
                className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-xs focus:border-brand-400 focus:outline-none"
                autoFocus
              />
              {searchTerm && (
                <p className="mt-1 text-[10px] text-muted">
                  {filteredMessages.length} matching {filteredMessages.length === 1 ? "message" : "messages"}
                </p>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5">
            {loading ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : error ? (
              <div className="py-10 text-center text-sm text-rose-600">{error}</div>
            ) : filteredMessages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                  <MessageCircle className="h-6 w-6" />
                </span>
                <p className="font-display text-base font-semibold text-ink">
                  {searchTerm ? "No messages match" : "Start the conversation"}
                </p>
                <p className="mt-1 max-w-xs text-xs leading-5 text-muted">
                  {searchTerm
                    ? "Try a different word or clear the search."
                    : `Say hello to ${other?.displayName}. A good first message can be simple.`}
                </p>
              </div>
            ) : (
              <>
                {hasMore && (
                  <div className="mb-4 flex justify-center">
                    <button
                      type="button"
                      onClick={loadEarlier}
                      disabled={loadingEarlier}
                      className="btn-secondary btn-sm"
                    >
                      {loadingEarlier ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      Load earlier messages
                    </button>
                  </div>
                )}

                {filteredMessages.map((message) => {
                  const date = new Date(message.createdAt).toLocaleDateString(undefined, {
                    weekday: "long",
                    day: "numeric",
                    month: "short",
                  });
                  const displayDate =
                    useUI.getState().calendar === "ETHIOPIAN"
                      ? formatDate(message.createdAt)
                      : date;
                  const showDate = date !== lastDate;
                  lastDate = date;
                  const mine = message.senderId === user?.id;
                  const grouped = lastSender === message.senderId && !showDate;
                  lastSender = message.senderId;
                  return (
                    <div key={message.id}>
                      {showDate && (
                        <div className="my-4 flex items-center gap-3">
                          <span className="h-px flex-1 bg-line" />
                          <span className="text-[10px] font-medium uppercase tracking-wider text-muted">
                            {displayDate}
                          </span>
                          <span className="h-px flex-1 bg-line" />
                        </div>
                      )}
                      <MessageBubble
                        message={message}
                        mine={mine}
                        grouped={grouped}
                        other={other}
                        onReply={() => {
                          setReplyTo(message);
                          textareaRef.current?.focus();
                        }}
                        onUpdated={(updated) =>
                          setMessages((current) =>
                            current.map((item) => (item.id === updated.id ? updated : item)),
                          )
                        }
                        onDeleted={(id) =>
                          setMessages((current) =>
                            current.map((item) =>
                              item.id === id
                                ? { ...item, body: null, deletedAt: new Date().toISOString(), media: [] }
                                : item,
                            ),
                          )
                        }
                      />
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </>
            )}
          </div>

          <form onSubmit={send} className="border-t border-line bg-surface p-3">
            {replyTo && (
              <div className="mb-2 flex items-start gap-2 rounded-lg border-l-2 border-brand-600 bg-raised/60 px-3 py-2">
                <Reply className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-700" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold text-ink">
                    Replying to {replyTo.senderId === user?.id ? "yourself" : replyTo.sender.displayName}
                  </p>
                  <p className="truncate text-[11px] text-muted">{replyTo.body ?? "Attachment"}</p>
                </div>
                <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply">
                  <X className="h-3.5 w-3.5 text-muted" />
                </button>
              </div>
            )}

            {media.filter((item) => item.kind === "IMAGE").length > 0 && (
              <div className="mb-2">
                <div className="flex flex-wrap gap-2">
                  {media
                    .filter((item) => item.kind === "IMAGE")
                    .map((item) => (
                      <div key={item.id} className="relative">
                        <ImageGrid media={[item]} className="h-16 w-16" />
                        <button
                          type="button"
                          onClick={() => setMedia((current) => current.filter((entry) => entry.id !== item.id))}
                          className="absolute -right-1 -top-1 rounded-full bg-slate-900 p-0.5 text-white"
                          aria-label="Remove attachment"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {media.filter((item) => item.kind === "AUDIO").map((item) => (
              <div key={item.id} className="mb-2 flex items-center gap-2">
                <AudioPlayer src={item.url} durationMs={item.durationMs} compact />
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => setMedia((current) => current.filter((entry) => entry.id !== item.id))}
                >
                  Remove
                </button>
              </div>
            ))}

            {showImages && (
              <div className="mb-2">
                <ImageUploader
                  media={media.filter((item) => item.kind === "IMAGE")}
                  onChange={(images) =>
                    setMedia((current) => [...current.filter((item) => item.kind !== "IMAGE"), ...images])
                  }
                  max={4}
                />
              </div>
            )}

            {showVoice && (
              <div className="mb-2">
                <VoiceRecorder
                  onUploaded={(uploaded) => {
                    setMedia((current) => [...current, uploaded]);
                    setShowVoice(false);
                  }}
                  onCancel={() => setShowVoice(false)}
                />
              </div>
            )}

            <div className="flex items-end gap-2">
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setShowImages((value) => !value)}
                  className={cn(
                    "inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-raised hover:text-ink",
                    showImages && "text-brand-700",
                  )}
                  aria-label="Attach photos"
                >
                  <ImagePlus className="h-[18px] w-[18px]" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowVoice((value) => !value)}
                  className={cn(
                    "inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-raised hover:text-ink",
                    showVoice && "text-brand-700",
                  )}
                  aria-label="Record a voice message"
                >
                  <Mic className="h-[18px] w-[18px]" />
                </button>
              </div>

              <textarea
                ref={textareaRef}
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  notifyTyping();
                  const element = event.currentTarget;
                  element.style.height = "auto";
                  element.style.height = `${Math.min(element.scrollHeight, 132)}px`;
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                maxLength={4000}
                placeholder="Write a message…"
                className="max-h-[132px] min-h-[40px] flex-1 resize-none rounded-xl border border-line bg-raised/60 px-3.5 py-2.5 text-sm leading-6 text-ink placeholder:text-muted/70 focus:border-brand-400 focus:bg-surface focus:outline-none"
                aria-label="Message"
              />

              <button
                type="submit"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white transition hover:bg-brand-800 disabled:opacity-50"
                disabled={sending || (!text.trim() && media.length === 0)}
                aria-label="Send message"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 pl-1 text-[10px] text-muted/70">
              Enter to send · Shift + Enter for a new line
            </p>
          </form>
        </section>
      </div>

      <NewChatModal open={newChat} onClose={() => setNewChat(false)} />
    </>
  );
}

function MessageBubble({
  message,
  mine,
  grouped,
  other,
  onReply,
  onUpdated,
  onDeleted,
}: {
  message: Message;
  mine: boolean;
  grouped: boolean;
  other?: User;
  onReply: () => void;
  onUpdated: (message: Message) => void;
  onDeleted: (id: string) => void;
}) {
  const user = useAuth((state) => state.user);
  const pushToast = useUI((state) => state.pushToast);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(message.body ?? "");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const deleted = Boolean(message.deletedAt);

  const save = async () => {
    if (!editBody.trim()) return;
    setBusy(true);
    try {
      const response = await api.patch<{ message: Message }>(`/api/messages/${message.id}`, {
        body: editBody.trim(),
      });
      onUpdated(response.data.message);
      setEditing(false);
    } catch (error) {
      pushToast(apiError(error), { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/api/messages/${message.id}`);
      onDeleted(message.id);
      setConfirmOpen(false);
    } catch (error) {
      pushToast(apiError(error), { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const images = message.media.filter((item) => item.kind === "IMAGE");
  const audio = message.media.filter((item) => item.kind === "AUDIO");

  return (
    <div className={cn("group flex gap-2", mine ? "flex-row-reverse" : "flex-row", grouped ? "mt-1" : "mt-4")}>
      {!mine && (
        <div className="w-7 shrink-0">
          {!grouped && other && (
            <Link to={`/u/${other.username}`}>
              <Avatar name={other.displayName} username={other.username} src={other.avatarUrl} size="xs" />
            </Link>
          )}
        </div>
      )}

      <div className={cn("flex max-w-[82%] flex-col sm:max-w-[70%]", mine ? "items-end" : "items-start")}>
        <div className="flex items-center gap-1">
          {!deleted && (
            <div className={cn("opacity-0 transition group-hover:opacity-100", mine && "order-2")}>
              <Dropdown trigger={<MoreHorizontal className="h-4 w-4" />} align={mine ? "right" : "left"} className="p-1">
                <button type="button" className="menu-item" onClick={onReply}>
                  <Reply className="h-4 w-4 text-muted" /> Reply
                </button>
                {mine && message.body && (
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      setEditBody(message.body ?? "");
                      setEditing(true);
                    }}
                  >
                    <Pencil className="h-4 w-4 text-muted" /> Edit
                  </button>
                )}
                {mine && (
                  <button
                    type="button"
                    className="menu-item text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                    onClick={() => setConfirmOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                )}
              </Dropdown>
            </div>
          )}

          <div
            className={cn(
              "rounded-2xl px-3.5 py-2 text-sm shadow-sm",
              mine
                ? "rounded-br-md bg-brand-700 text-white"
                : "rounded-bl-md border border-line bg-raised text-ink",
              deleted && "italic opacity-70",
            )}
          >
            {message.replyTo && (
              <div
                className={cn(
                  "mb-1.5 rounded-lg border-l-2 px-2 py-1 text-[11px]",
                  mine ? "border-white/40 bg-white/10 text-white/75" : "border-brand-500 bg-surface/70 text-muted",
                )}
              >
                <p className="font-semibold">{message.replyTo.sender.displayName}</p>
                <p className="line-clamp-2">{message.replyTo.deletedAt ? "Deleted message" : message.replyTo.body ?? "Attachment"}</p>
              </div>
            )}

            {editing ? (
              <div className="min-w-[220px] space-y-2">
                <textarea
                  value={editBody}
                  onChange={(event) => setEditBody(event.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-white/20 bg-white/10 p-2 text-sm text-white placeholder:text-white/50 focus:outline-none"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={save}
                    disabled={busy || !editBody.trim()}
                    className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-brand-800"
                  >
                    {busy ? "Saving…" : "Save"}
                  </button>
                  <button type="button" onClick={() => setEditing(false)} className="text-[11px] text-white/75">
                    Cancel
                  </button>
                </div>
              </div>
            ) : deleted ? (
              <p>This message was deleted.</p>
            ) : (
              <>
                {message.body && <p className="whitespace-pre-wrap break-words leading-6">{message.body}</p>}
                {images.length > 0 && (
                  <div className={cn(message.body && "mt-2")}>
                    <ImageGrid media={images} />
                  </div>
                )}
                {audio.map((item) => (
                  <div key={item.id} className={cn("mt-2", mine && "text-ink")}>
                    <AudioPlayer src={item.url} durationMs={item.durationMs} compact />
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        <div className={cn("mt-1 flex items-center gap-1 px-1 text-[10px] text-muted", mine && "flex-row-reverse")}>
          <span>
            {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          {message.editedAt && <span>· edited</span>}
          {mine && !deleted && (
            <span title={message.readAt ? "Read" : "Sent"}>
              {message.readAt ? (
                <CheckCheck className="h-3.5 w-3.5 text-brand-600" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
            </span>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Delete this message?"
        description="It will be replaced with a deleted-message notice for both of you."
        busy={busy}
        onConfirm={remove}
      />
    </div>
  );
}
