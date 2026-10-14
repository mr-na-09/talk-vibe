"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Bell,
  Check,
  Compass,
  FileText,
  FolderOpen,
  LoaderCircle,
  LogOut,
  MessageCircle,
  Paperclip,
  Pencil,
  Search,
  Send,
  Settings2,
  Users,
  X,
} from "lucide-react";
import { getProtectedFileURL, pb } from "@/lib/pocketbase";

interface FriendProfile {
  id: string;
  user: string;
  display_name: string;
  username: string;
  avatar: string;
  status: string;
  last_seen: string;
}

interface FriendRequestRecord {
  id: string;
  sender: string;
  receiver: string;
  status: string;
}

interface ConversationRecord {
  id: string;
  participants: string[];
  created_by: string;
  direct_friend?: string;
  title: string;
  is_group: boolean;
}

interface MessageRecord {
  id: string;
  conversation: string;
  sender: string;
  text: string;
  attachments: string[];
  created: string;
  deleted: boolean;
}

const maxAttachmentSize = 50 * 1024 * 1024;
const onlineWindowMs = 75_000;

function nicknameStorageKey(userId: string) {
  return `talkvibe:nicknames:${userId}`;
}

function friendIsOnline(friend: FriendProfile) {
  const lastSeen = Date.parse(friend.last_seen);
  return friend.status === "online" && Number.isFinite(lastSeen) && Date.now() - lastSeen < onlineWindowMs;
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMessageTime(timestamp: string) {
  const date = new Date(timestamp);
  const time = date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
  const dateOptions: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  };
  const sentDate = date.toLocaleDateString("en-CA", { ...dateOptions, year: "numeric", month: "2-digit", day: "2-digit" });
  const todayDate = new Date().toLocaleDateString("en-CA", { ...dateOptions, year: "numeric", month: "2-digit", day: "2-digit" });

  return sentDate === todayDate
    ? time
    : `${date.toLocaleDateString("en-IN", dateOptions)}, ${time}`;
}

function MessageAttachment({ message, fileName, token }: { message: MessageRecord; fileName: string; token: string }) {
  if (!token) {
    return <p className="text-xs text-slate-400">Loading attachment access...</p>;
  }

  const url = getProtectedFileURL(message, fileName, token, "messages");
  const downloadUrl = getProtectedFileURL(message, fileName, token, "messages", true);
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const isImage = ["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(extension);
  const isVideo = ["mp4", "webm", "mov", "m4v", "ogv"].includes(extension);

  if (isImage) {
    return (
      <div className="space-y-1.5">
        <a href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl">
          <Image unoptimized src={url} width={360} height={280} alt={fileName} className="max-h-72 w-full rounded-xl object-cover" />
        </a>
        <a href={downloadUrl} download={fileName} className="text-xs text-violet-200 underline underline-offset-2">Download image</a>
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className="space-y-1.5">
        <video src={url} controls preload="metadata" className="max-h-72 w-full rounded-xl" />
        <a href={downloadUrl} download={fileName} className="block text-xs text-violet-200 underline underline-offset-2">Download video</a>
      </div>
    );
  }

  return (
    <a href={downloadUrl} download={fileName} className="flex max-w-full items-center gap-3 rounded-xl border border-white/10 bg-black/15 p-3 hover:bg-black/25">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/[0.08]">
        <FileText className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium">{fileName}</span>
        <span className="mt-1 block text-[10px] opacity-65">Download file</span>
      </span>
    </a>
  );
}

function ChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedFriendId = searchParams.get("friend");
  const requestedGroupId = searchParams.get("group");
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [groups, setGroups] = useState<ConversationRecord[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<FriendProfile | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<ConversationRecord | null>(null);
  const [conversation, setConversation] = useState<ConversationRecord | null>(null);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [draft, setDraft] = useState("");
  const [friendQuery, setFriendQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"chats" | "friends" | "groups">("chats");
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [fileToken, setFileToken] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const filePickerRef = useRef<HTMLInputElement>(null);
  const folderPickerRef = useRef<HTMLInputElement>(null);

  const loadFriends = useCallback(async (userId: string) => {
    if (!pb.authStore.isValid) {
      router.replace("/login");
      return [];
    }

    const accepted = await pb.collection("friend_requests").getFullList<FriendRequestRecord>({
      filter: `(sender = "${userId}" || receiver = "${userId}") && status = "accepted"`,
      sort: "-updated",
      requestKey: null,
    });
    const friendUserIds = [...new Set(
      accepted.map((request) => request.sender === userId ? request.receiver : request.sender),
    )];

    if (!friendUserIds.length) {
      return [];
    }

    const filter = friendUserIds.map((id) => `user = "${id}"`).join(" || ");
    const records = await pb.collection("profiles").getFullList<FriendProfile>({
      filter,
      sort: "display_name",
      fields: "id,user,display_name,username,avatar,status,last_seen",
      requestKey: null,
    });
    return records;
  }, [router]);

  const loadGroups = useCallback(async (userId: string) => {
    return pb.collection("conversations").getFullList<ConversationRecord>({
      filter: `participants.id ?= "${userId}" && is_group = true`,
      sort: "-updated",
      fields: "id,participants,created_by,title,is_group",
      requestKey: null,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const userId = pb.authStore.model?.id;
    if (!userId) {
      router.replace("/login");
      return;
    }

    void Promise.all([loadFriends(userId), loadGroups(userId)])
      .then(([records, loadedGroups]) => {
        if (!cancelled) {
          setFriends(records);
          setGroups(loadedGroups);
          try {
            const storedNicknames = localStorage.getItem(nicknameStorageKey(userId));
            if (storedNicknames) {
              const parsed: unknown = JSON.parse(storedNicknames);
              if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
                setNicknames(
                  Object.fromEntries(
                    Object.entries(parsed).filter(
                      (entry): entry is [string, string] => typeof entry[1] === "string",
                    ),
                  ),
                );
              }
            }
          } catch (cause) {
            console.error(cause);
            setError("Saved friend nicknames could not be loaded.");
          }
          if (records.length) {
            const selected = records.find((friend) => friend.id === requestedFriendId) ?? records[0];
            const selectedGroupRecord = loadedGroups.find((group) => group.id === requestedGroupId);
            if (selectedGroupRecord) {
              setSelectedFriend(null);
              setSelectedGroup(selectedGroupRecord);
              setActiveTab("groups");
            } else {
              setSelectedFriend(selected);
              setSelectedGroup(null);
            }
          } else if (loadedGroups.length) {
            const selectedGroupRecord = loadedGroups.find((group) => group.id === requestedGroupId) ?? loadedGroups[0];
            setSelectedFriend(null);
            setSelectedGroup(selectedGroupRecord);
            setActiveTab("groups");
          }
          setNicknameDraft("");
          setEditingNickname(false);
        }
      })
      .catch((cause: unknown) => {
        console.error(cause);
        if (!cancelled) setError("Friends could not be loaded. Check your connection and try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadFriends, loadGroups, requestedFriendId, requestedGroupId, router]);

  useEffect(() => {
    let cancelled = false;
    if (!pb.authStore.isValid) return;

    void pb.files.getToken({ requestKey: null })
      .then((token) => {
        if (!cancelled) setFileToken(token);
      })
      .catch((cause: unknown) => {
        console.error("Protected profile photos and attachments could not be loaded.", cause);
        if (!cancelled) setError("Protected photos and attachments could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const userId = pb.authStore.model?.id;
    if (!userId) return;
    const intervalId = setInterval(() => {
      void Promise.all([loadFriends(userId), loadGroups(userId)])
        .then(([records, loadedGroups]) => {
          setFriends(records);
          setGroups(loadedGroups);
          setSelectedFriend((current) =>
            current ? records.find((friend) => friend.user === current.user) ?? current : null,
          );
          setSelectedGroup((current) =>
            current ? loadedGroups.find((group) => group.id === current.id) ?? current : null,
          );
        })
        .catch((cause: unknown) => {
          console.error(cause);
          setError("Online status could not be refreshed. Check your connection.");
        });
    }, 30_000);
    return () => clearInterval(intervalId);
  }, [loadFriends, loadGroups]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    const user = pb.authStore.model;
    if (!user || (!selectedFriend && !selectedGroup)) return;
    const authUser = user;
    const friend = selectedFriend;
    const group = selectedGroup;

    async function openConversation() {
      try {
        let record: ConversationRecord;
        if (group) {
          record = group;
        } else if (friend) {
          const filter =
            `((created_by = "${authUser.id}" && direct_friend = "${friend.user}") || ` +
            `(created_by = "${friend.user}" && direct_friend = "${authUser.id}")) && ` +
            "is_group = false";
          try {
            record = await pb.collection("conversations").getFirstListItem<ConversationRecord>(filter, {
              requestKey: null,
            });
          } catch (cause) {
            if (!isNotFound(cause)) throw cause;
            record = await pb.collection("conversations").create<ConversationRecord>({
              participants: [authUser.id, friend.user],
              created_by: authUser.id,
              direct_friend: friend.user,
              is_group: false,
              title: "",
            });
          }
        } else {
          return;
        }
        if (cancelled) return;
        setConversation(record);

        const stop = await pb.collection("messages").subscribe<MessageRecord>("*", (event) => {
          if (event.record.conversation !== record.id) return;
          setMessages((current) => {
            if (event.action === "delete") {
              return current.filter((message) => message.id !== event.record.id);
            }
            const updated = event.record;
            const existingIndex = current.findIndex((message) => message.id === updated.id);
            if (existingIndex < 0) return [...current, updated].sort((a, b) => a.created.localeCompare(b.created));
            return current.map((message) => message.id === updated.id ? updated : message);
          });
        });
        if (cancelled) stop();
        else unsubscribe = stop;

        const initialMessages = await pb.collection("messages").getFullList<MessageRecord>({
          filter: `conversation = "${record.id}"`,
          sort: "created",
          requestKey: null,
        });
        if (cancelled) return;
        setMessages((current) => {
          const byId = new Map(current.map((message) => [message.id, message]));
          for (const message of initialMessages) {
            if (!byId.has(message.id)) byId.set(message.id, message);
          }
          return [...byId.values()].sort((a, b) => a.created.localeCompare(b.created));
        });
      } catch (cause) {
        console.error(cause);
        if (!cancelled) setError("This conversation could not be opened. Please try again.");
      }
    }

    void openConversation();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [selectedFriend, selectedGroup]);

  async function createGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const userId = pb.authStore.model?.id;
    const title = groupTitle.trim();
    if (!userId || !title || groupMemberIds.length < 2 || creatingGroup) return;

    setCreatingGroup(true);
    setError("");
    try {
      const group = await pb.collection("conversations").create<ConversationRecord>({
        participants: [userId, ...groupMemberIds],
        created_by: userId,
        title,
        is_group: true,
      });
      setGroups((current) => [group, ...current]);
      setSelectedFriend(null);
      setSelectedGroup(group);
      setActiveTab("groups");
      setCreateGroupOpen(false);
      setGroupTitle("");
      setGroupMemberIds([]);
      setMessages([]);
      setConversation(null);
      router.replace(`/chat?group=${encodeURIComponent(group.id)}`);
    } catch (cause) {
      console.error(cause);
      setError("The group could not be created. Check that every selected person is your accepted friend.");
    } finally {
      setCreatingGroup(false);
    }
  }

  function queueFiles(fileList: FileList | null) {
    if (!fileList) return;
    const selectedFiles = Array.from(fileList);
    const tooLarge = selectedFiles.filter((file) => file.size > maxAttachmentSize);
    const validFiles = selectedFiles.filter((file) => file.size <= maxAttachmentSize);

    if (tooLarge.length) {
      setError(`Each file must be 50 MB or smaller. ${tooLarge.map((file) => file.name).join(", ")} was not added.`);
    } else {
      setError("");
    }
    if (validFiles.length) setPendingFiles((current) => [...current, ...validFiles]);
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const user = pb.authStore.model;
    const content = draft.trim();
    const filesToSend = [...pendingFiles];
    if (!user || !conversation || (!content && !filesToSend.length) || sending) return;

    setSending(true);
    setError("");
    try {
      if (content) {
        await pb.collection("messages").create({
          conversation: conversation.id,
          sender: user.id,
          text: content,
          deleted: false,
        });
        setDraft("");
      }

      for (let index = 0; index < filesToSend.length; index += 1) {
        const formData = new FormData();
        formData.set("conversation", conversation.id);
        formData.set("sender", user.id);
        formData.set("text", "");
        formData.set("deleted", "false");
        formData.set("attachments", filesToSend[index]);
        await pb.collection("messages").create(formData);
        setPendingFiles(filesToSend.slice(index + 1));
      }
      setPendingFiles([]);
    } catch (cause) {
      console.error(cause);
      setError("A message or file could not be sent. Sent files have been removed; unsent files remain ready to retry.");
    } finally {
      setSending(false);
    }
  }

  function saveNickname(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const userId = pb.authStore.model?.id;
    if (!userId || !selectedFriend) return;

    const nickname = nicknameDraft.trim().slice(0, 40);
    const updatedNicknames = { ...nicknames };
    if (nickname) updatedNicknames[selectedFriend.user] = nickname;
    else delete updatedNicknames[selectedFriend.user];

    try {
      localStorage.setItem(nicknameStorageKey(userId), JSON.stringify(updatedNicknames));
      setNicknames(updatedNicknames);
      setNicknameDraft("");
      setEditingNickname(false);
      setError("");
    } catch (cause) {
      console.error(cause);
      setError("Nickname could not be saved in this browser. Check your browser storage settings.");
    }
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100"><LoaderCircle className="mr-2 h-5 w-5 animate-spin" />Loading messages...</main>;
  }

  const filteredFriends = friends.filter((friend) =>
    `${friend.display_name} ${friend.username}`.toLowerCase().includes(friendQuery.trim().toLowerCase()),
  );
  const currentUser = pb.authStore.model;
  const selectedFriendAvatarURL = selectedFriend?.avatar && fileToken
    ? getProtectedFileURL(selectedFriend, selectedFriend.avatar, fileToken, "profiles")
    : null;

  return (
  <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-slate-950 text-slate-50">
    <div className="flex min-h-0 flex-1 flex-col px-3 py-3 sm:px-6 sm:py-4">
      <header className="mb-3 flex shrink-0 items-center justify-between sm:mb-4">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-500 text-white shadow-lg shadow-violet-950/40 xl:hidden">
              <MessageCircle className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-300">TalkVibe</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Messages</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/friends" className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-200 hover:bg-white/[0.08]">
              Find people
            </Link>
            <button
              type="button"
              aria-label="Sign out"
              title="Sign out"
              onClick={() => {
                pb.authStore.clear();
                router.replace("/login");
              }}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-white xl:hidden"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {error ? <p role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p> : null}

        <div className="grid min-h-0 flex-1 grid-rows-[minmax(150px,32%)_minmax(0,1fr)] overflow-hidden rounded-[28px] border border-white/10 bg-[#11121b]/90 shadow-[0_28px_100px_rgba(0,0,0,0.42)] backdrop-blur-2xl md:grid-rows-1 md:grid-cols-[300px_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)_230px] xl:grid-cols-[176px_280px_minmax(0,1fr)_240px]">
          <aside className="hidden min-h-0 flex-col border-r border-white/[0.08] p-4 xl:flex">
            <Link href="/chat" aria-label="TalkVibe home" className="mb-8 flex items-center gap-2 px-2 py-2 text-lg font-bold tracking-tight">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 text-white shadow-lg shadow-violet-950/40">
                <MessageCircle className="h-5 w-5" />
              </span>
              <span className="bg-gradient-to-r from-cyan-300 to-violet-300 bg-clip-text text-transparent">TalkVibe</span>
            </Link>
            <nav className="flex flex-col gap-1.5" aria-label="Main navigation">
              <button type="button" onClick={() => setActiveTab("chats")} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm ${activeTab === "chats" ? "bg-blue-500/20 text-cyan-200" : "text-slate-400 hover:bg-white/[0.05] hover:text-white"}`}>
                <MessageCircle className="h-4 w-4" />Chats
                <span className="ml-auto rounded-full bg-indigo-500/60 px-1.5 py-0.5 text-[10px]">{friends.length + groups.length}</span>
              </button>
              <button type="button" onClick={() => setActiveTab("friends")} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm ${activeTab === "friends" ? "bg-blue-500/20 text-cyan-200" : "text-slate-400 hover:bg-white/[0.05] hover:text-white"}`}>
                <Users className="h-4 w-4" />Friends
              </button>
              <Link href="/friends" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-400 hover:bg-white/[0.05] hover:text-white">
                <Bell className="h-4 w-4" />Requests
              </Link>
              <Link href="/friends" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-400 hover:bg-white/[0.05] hover:text-white">
                <Compass className="h-4 w-4" />Discover
              </Link>
              <button type="button" onClick={() => setActiveTab("groups")} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm ${activeTab === "groups" ? "bg-blue-500/20 text-cyan-200" : "text-slate-400 hover:bg-white/[0.05] hover:text-white"}`}>
                <FolderOpen className="h-4 w-4" />Groups
              </button>
              <Link href="/profile" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-400 hover:bg-white/[0.05] hover:text-white">
                <Settings2 className="h-4 w-4" />Settings
              </Link>
            </nav>
            <div className="flex items-center gap-2 border-t border-white/[0.08] px-1 py-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cyan-400/80 to-violet-500/80 text-xs font-bold text-slate-950">
                {(currentUser?.name || currentUser?.email || "TV").slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-slate-200">{currentUser?.name || currentUser?.email || "TalkVibe user"}</span>
                <span className="mt-1 flex items-center gap-1 text-[10px] text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Online</span>
              </span>
              <button type="button" aria-label="Sign out" title="Sign out" onClick={() => {
                pb.authStore.clear();
                router.replace("/login");
              }} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-white/[0.08] hover:text-white">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-auto rounded-2xl border border-violet-400/10 bg-gradient-to-br from-blue-950/80 to-violet-950/80 p-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/30 text-violet-200"><MessageCircle className="h-5 w-5" /></span>
              <p className="mt-3 text-sm font-semibold text-white">Good Vibes<br />Bigger Dreams</p>
              <p className="mt-1 text-[10px] leading-4 text-slate-400">Stay connected. Stay real.</p>
            </div>
          </aside>
          <aside className="flex min-h-0 flex-col overflow-hidden border-b border-white/[0.08] md:border-b-0 md:border-r">
            <div className="border-b border-white/[0.08] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{activeTab === "groups" ? "Groups" : activeTab === "friends" ? "Friends" : "Your inbox"}</h2>
                  <p className="mt-1 text-xs text-slate-500">Messages and conversations</p>
                </div>
                {activeTab === "groups" ? (
                  <button type="button" aria-label="Create group" title="Create group" onClick={() => setCreateGroupOpen(true)} className="grid h-9 w-9 place-items-center rounded-xl bg-violet-500/15 text-violet-200 hover:bg-violet-500/25">
                    <Users className="h-4 w-4" />
                  </button>
                ) : <MessageCircle className="h-5 w-5 text-violet-300" />}
              </div>
              <div className="mb-3 grid grid-cols-3 rounded-xl bg-black/20 p-1 text-[11px]">
                {(["chats", "friends", "groups"] as const).map((tab) => (
                  <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`rounded-lg px-2 py-2 capitalize ${activeTab === tab ? "bg-white/[0.09] font-semibold text-white" : "text-slate-500 hover:text-slate-200"}`}>
                    {tab}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5 text-slate-400 focus-within:border-violet-400/50">
                <Search className="h-4 w-4 shrink-0" />
                <input
                  value={friendQuery}
                  onChange={(event) => setFriendQuery(event.target.value)}
                  aria-label="Search conversations"
                  className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                  placeholder="Search"
                />
              </label>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {activeTab === "groups" && groups.length === 0 ? (
                <div className="m-2 rounded-2xl border border-dashed border-white/10 p-5 text-center">
                  <Users className="mx-auto h-6 w-6 text-violet-300" />
                  <p className="mt-3 text-sm font-medium text-slate-300">No groups yet</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Start a group with your friends.</p>
                  {friends.length >= 2 ? <button type="button" onClick={() => setCreateGroupOpen(true)} className="mt-3 text-xs font-semibold text-violet-300 hover:text-violet-200">Create a group</button> : null}
                </div>
              ) : null}
              {activeTab === "groups" && groups.length > 0 && groups.filter((group) => group.title.toLowerCase().includes(friendQuery.trim().toLowerCase())).length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-slate-500">No groups match your search.</p>
              ) : null}
              {activeTab === "groups" ? groups.filter((group) => group.title.toLowerCase().includes(friendQuery.trim().toLowerCase())).map((group) => (
                <button key={group.id} type="button" onClick={() => {
                  setSelectedFriend(null);
                  setSelectedGroup(group);
                  setConversation(null);
                  setMessages([]);
                  setFileToken("");
                  setError("");
                  router.replace(`/chat?group=${encodeURIComponent(group.id)}`);
                }} className={`mb-1 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${selectedGroup?.id === group.id ? "bg-violet-500/[0.13] ring-1 ring-violet-400/20" : "text-slate-300 hover:bg-white/[0.045]"}`}>
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 text-violet-200"><Users className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-200">{group.title}</span>
                    <span className="mt-1 block text-xs text-slate-500">{group.participants.length} members</span>
                  </span>
                </button>
              )) : null}
              {activeTab !== "groups" && friends.length === 0 ? (
                <div className="m-2 rounded-2xl border border-dashed border-white/10 p-5 text-center">
                  <p className="text-sm font-medium text-slate-300">No conversations yet</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Accept a friend request to start chatting.</p>
                  <Link href="/friends" className="mt-3 inline-flex text-xs font-semibold text-violet-300 hover:text-violet-200">Find friends</Link>
                </div>
              ) : null}
              {activeTab !== "groups" && friends.length > 0 && filteredFriends.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-slate-500">No friends match your search.</p>
              ) : null}
              {activeTab !== "groups" ? filteredFriends.map((friend) => {
                const initials = friend.display_name
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase() ?? "")
                  .join("");
                const displayName = nicknames[friend.user] || friend.display_name;
                const isSelected = selectedFriend?.id === friend.id;
                const avatarUrl = friend.avatar && fileToken
                  ? getProtectedFileURL(friend, friend.avatar, fileToken, "profiles")
                  : null;
                return (
                  <button
                    key={friend.id}
                    type="button"
                    onClick={() => {
                      setConversation(null);
                      setMessages([]);
                      setError("");
                      setSelectedGroup(null);
                      setSelectedFriend(friend);
                      router.replace(`/chat?friend=${encodeURIComponent(friend.id)}`);
                    }}
                    className={`mb-1 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${isSelected ? "bg-violet-500/[0.13] ring-1 ring-violet-400/20" : "text-slate-300 hover:bg-white/[0.045]"}`}
                  >
                    <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-400 via-fuchsia-500 to-orange-400 p-[1.5px]">
                      <span className="relative grid h-full w-full place-items-center overflow-hidden rounded-full bg-[#171722] text-sm font-semibold text-white">
                        {avatarUrl ? <Image unoptimized src={avatarUrl} alt="" fill sizes="48px" className="object-cover" /> : initials}
                      </span>
                      <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#11121b] ${friendIsOnline(friend) ? "bg-emerald-400" : "bg-slate-600"}`} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm font-semibold ${isSelected ? "text-white" : "text-slate-200"}`}>{displayName}</span>
                      <span className="mt-1 block truncate text-xs text-slate-500">@{friend.username}</span>
                      <span className={`mt-1 block text-[10px] ${friendIsOnline(friend) ? "text-emerald-300" : "text-slate-600"}`}>{friendIsOnline(friend) ? "Online" : "Offline"}</span>
                    </span>
                  </button>
                );
              }) : null}
            </div>
          </aside>

          <section className="chat-wallpaper relative flex min-h-0 flex-col">
            {selectedFriend || selectedGroup ? (
              <>
                <header className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3.5 sm:px-6">
                  <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-400 via-fuchsia-500 to-orange-400 p-[1.5px]">
                    <span className="relative grid h-full w-full place-items-center overflow-hidden rounded-full bg-[#171722] text-sm font-semibold">
                      {selectedGroup ? (
                        <Users className="h-4 w-4" />
                      ) : selectedFriendAvatarURL ? (
                        <Image
                          unoptimized
                          src={selectedFriendAvatarURL}
                          alt=""
                          fill
                          sizes="44px"
                          className="object-cover"
                        />
                      ) : selectedFriend?.display_name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("")}
                    </span>
                    {!selectedGroup && selectedFriend ? <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#11121b] ${friendIsOnline(selectedFriend) ? "bg-emerald-400" : "bg-slate-600"}`} /> : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    {selectedGroup ? (
                      <>
                        <h2 className="truncate text-sm font-semibold">{selectedGroup.title}</h2>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{selectedGroup.participants.length} members</p>
                      </>
                    ) : editingNickname && selectedFriend ? (
                      <form onSubmit={saveNickname} className="flex max-w-sm items-center gap-1.5">
                        <input
                          autoFocus
                          value={nicknameDraft}
                          onChange={(event) => setNicknameDraft(event.target.value)}
                          maxLength={40}
                          aria-label="Friend nickname"
                          placeholder={selectedFriend.display_name}
                          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-sm outline-none focus:border-violet-400/50"
                        />
                        <button type="submit" aria-label="Save nickname" className="grid h-8 w-8 place-items-center rounded-full bg-violet-500/20 text-violet-200 hover:bg-violet-500/30">
                          <Check className="h-4 w-4" />
                        </button>
                        <button type="button" aria-label="Cancel nickname edit" onClick={() => { setEditingNickname(false); setNicknameDraft(""); }} className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-white/[0.08] hover:text-white">
                          <X className="h-4 w-4" />
                        </button>
                      </form>
                    ) : selectedFriend ? (
                      <>
                        <div className="flex items-center gap-2">
                          <h2 className="truncate text-sm font-semibold">{nicknames[selectedFriend.user] || selectedFriend.display_name}</h2>
                          <button
                            type="button"
                            aria-label="Edit friend nickname"
                            title="Edit nickname"
                            onClick={() => {
                              setNicknameDraft(nicknames[selectedFriend.user] || "");
                              setEditingNickname(true);
                            }}
                            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-white/[0.08] hover:text-violet-200"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className={`mt-0.5 truncate text-xs ${friendIsOnline(selectedFriend) ? "text-emerald-300" : "text-slate-500"}`}>
                          {friendIsOnline(selectedFriend) ? "Online now" : `@${selectedFriend.username} · Offline`}
                        </p>
                      </>
                    ) : null}
                  </div>
                  <span className="hidden rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] text-slate-400 sm:inline-flex">
                    {selectedGroup ? "Group chat" : "Messages"}
                  </span>
                </header>

                <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-5 sm:px-7">
                  {messages.filter((message) => !message.deleted).map((message) => {
                    const ownMessage = message.sender === pb.authStore.model?.id;
                    const senderProfile = friends.find((friend) => friend.user === message.sender);
                    return (
                      <div key={message.id} className={`flex ${ownMessage ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[84%] rounded-[22px] px-4 py-3 text-sm leading-6 shadow-lg sm:max-w-[70%] ${ownMessage ? "rounded-br-md bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-violet-950/20" : "rounded-bl-md border border-white/[0.06] bg-[#242430] text-slate-100 shadow-black/10"}`}>
                          {selectedGroup && !ownMessage ? <p className="mb-1 text-[10px] font-semibold text-violet-300">{senderProfile?.display_name ?? "Group member"}</p> : null}
                          {message.text ? <p className="whitespace-pre-wrap break-words">{message.text}</p> : null}
                          {message.attachments?.length ? (
                            <div className={`space-y-2 ${message.text ? "mt-2" : ""}`}>
                              {message.attachments.map((fileName) => (
                                <MessageAttachment key={fileName} message={message} fileName={fileName} token={fileToken} />
                              ))}
                            </div>
                          ) : null}
                          <time className="mt-1.5 block text-right text-[10px] leading-4 opacity-65">
                            {formatMessageTime(message.created)}
                          </time>
                        </div>
                      </div>
                    );
                  })}
                  {conversation && messages.filter((message) => !message.deleted).length === 0 ? (
                    <div className="m-auto max-w-xs py-10 text-center">
                      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-white/10 bg-white/[0.04]">
                        <MessageCircle className="h-7 w-7 text-violet-300" />
                      </span>
                      <p className="mt-4 font-medium">{selectedGroup ? `Say hello in ${selectedGroup.title}` : `Say hello to ${(nicknames[selectedFriend?.user ?? ""] || selectedFriend?.display_name || "your friend").split(" ")[0]}`}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">Your conversation starts with a message.</p>
                    </div>
                  ) : null}
                </div>

                <form onSubmit={sendMessage} className="border-t border-white/[0.08] p-3 sm:px-5 sm:py-4">
                  {pendingFiles.length ? (
                    <ul className="mb-3 flex flex-wrap gap-2">
                      {pendingFiles.map((file, index) => (
                        <li key={`${file.name}:${file.size}:${file.lastModified}:${index}`} className="flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-3 pr-1 text-xs text-slate-300">
                          <span className="max-w-48 truncate">{file.name}</span>
                          <span className="shrink-0 text-slate-500">{formatFileSize(file.size)}</span>
                          <button
                            type="button"
                            disabled={sending}
                            aria-label={`Remove ${file.name}`}
                            onClick={() => setPendingFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                            className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <input
                    ref={filePickerRef}
                    type="file"
                    multiple
                    className="hidden"
                    aria-label="Choose files to attach"
                    onChange={(event) => {
                      queueFiles(event.target.files);
                      event.target.value = "";
                    }}
                  />
                  <input
                    ref={(element) => {
                      folderPickerRef.current = element;
                      if (element && !element.hasAttribute("webkitdirectory")) {
                        element.setAttribute("webkitdirectory", "");
                        element.setAttribute("directory", "");
                      }
                    }}
                    type="file"
                    multiple
                    className="hidden"
                    aria-label="Choose a folder to upload"
                    onChange={(event) => {
                      queueFiles(event.target.files);
                      event.target.value = "";
                    }}
                  />
                  <div className="flex items-center gap-2 rounded-full border border-white/[0.1] bg-black/20 p-1.5 pl-4 focus-within:border-violet-400/50">
                    <button
                      type="button"
                      disabled={!conversation || sending}
                      aria-label="Attach files"
                      title="Attach files"
                      onClick={() => filePickerRef.current?.click()}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-white/[0.08] hover:text-violet-200 disabled:opacity-40"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={!conversation || sending}
                      aria-label="Choose a folder"
                      title="Send a folder's files separately"
                      onClick={() => folderPickerRef.current?.click()}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-white/[0.08] hover:text-violet-200 disabled:opacity-40"
                    >
                      <FolderOpen className="h-4 w-4" />
                    </button>
                    <input
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      disabled={!conversation || sending}
                      maxLength={10000}
                      className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-slate-500 disabled:opacity-50"
                      placeholder={conversation ? "Message..." : "Connecting to conversation..."}
                    />
                    <button type="submit" disabled={!conversation || (!draft.trim() && pendingFiles.length === 0) || sending} aria-label="Send message" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-950/30 disabled:opacity-40">
                      {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="px-2 pt-2 text-[10px] text-slate-600">Files up to 50 MB each. Folder contents are sent as individual files.</p>
                </form>
              </>
            ) : (
              <div className="m-auto max-w-sm px-6 py-14 text-center">
                <span className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-white/10 bg-gradient-to-br from-violet-500/15 to-fuchsia-500/10">
                  <MessageCircle className="h-8 w-8 text-violet-300" />
                </span>
                <h2 className="mt-5 text-xl font-semibold">Your messages</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">Choose a friend to open your conversation, or find someone new to connect with.</p>
                <Link href="/friends" className="mt-5 inline-flex rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-950/30">
                  Find friends
                </Link>
              </div>
            )}
          </section>
          <aside className="hidden min-h-0 flex-col overflow-y-auto border-l border-white/[0.08] p-5 lg:flex">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Details</h2>
            {selectedFriend ? (
              <div className="mt-8 text-center">
                <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-violet-400 via-fuchsia-500 to-orange-400 p-[2px]">
                  <span className="grid h-full w-full place-items-center rounded-full bg-[#171722] text-lg font-semibold">
                    {selectedFriend.display_name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("")}
                  </span>
                </span>
                <h3 className="mt-4 font-semibold">{nicknames[selectedFriend.user] || selectedFriend.display_name}</h3>
                <p className="mt-1 text-xs text-slate-500">@{selectedFriend.username}</p>
                <p className={`mt-3 text-xs ${friendIsOnline(selectedFriend) ? "text-emerald-300" : "text-slate-500"}`}>{friendIsOnline(selectedFriend) ? "Online now" : "Offline"}</p>
                <button type="button" onClick={() => {
                  setNicknameDraft(nicknames[selectedFriend.user] || "");
                  setEditingNickname(true);
                }} className="mt-5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.08]">Edit nickname</button>
              </div>
            ) : selectedGroup ? (
              <div className="mt-8">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 text-violet-200"><Users className="h-7 w-7" /></span>
                <h3 className="mt-4 text-center font-semibold">{selectedGroup.title}</h3>
                <p className="mt-1 text-center text-xs text-slate-500">{selectedGroup.participants.length} members</p>
                <div className="mt-6 space-y-3">
                  {selectedGroup.participants.map((participantId) => {
                    const participant = friends.find((friend) => friend.user === participantId);
                    const isCurrentUser = participantId === pb.authStore.model?.id;
                    return (
                      <div key={participantId} className="flex items-center gap-2">
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.07] text-[10px] font-semibold">
                          {isCurrentUser ? "You" : participant?.display_name.slice(0, 1).toUpperCase() ?? "?"}
                        </span>
                        <span className="truncate text-xs text-slate-300">{isCurrentUser ? "You" : participant?.display_name ?? "Member"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : <p className="mt-8 text-sm leading-6 text-slate-500">Select a conversation to see profile details.</p>}
            <section className="mt-auto border-t border-white/[0.08] pt-5">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">About</h2>
              <div className="mt-4 space-y-3 text-xs">
                <a href="https://www.instagram.com/mr_na_09/" target="_blank" rel="noreferrer" className="block truncate text-violet-300 hover:text-violet-200">
                  Instagram · @mr_na_09
                </a>
                <a href="mailto:awasthinitiksh009@gmail.com" className="block break-all text-slate-400 hover:text-white">
                  awasthinitiksh009@gmail.com
                </a>
                <a href="tel:+919404111123" className="block text-slate-400 hover:text-white">
                  +91 94041 11123
                </a>
              </div>
              <p className="mt-6 text-right text-[11px] text-slate-600">Made by Nitiksh Awasthi</p>
            </section>
          </aside>
        </div>
      </div>
      {createGroupOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setCreateGroupOpen(false);
        }}>
          <form onSubmit={createGroup} className="w-full max-w-md rounded-3xl border border-white/10 bg-[#151521] p-5 shadow-2xl shadow-black/50 sm:p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">New conversation</p>
                <h2 className="mt-2 text-xl font-semibold">Create a group</h2>
                <p className="mt-1 text-sm text-slate-500">Choose a name and at least two friends.</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setCreateGroupOpen(false)} className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-white/[0.08] hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <label className="mt-5 block">
              <span className="mb-2 block text-xs font-medium text-slate-400">Group name</span>
              <input required maxLength={60} value={groupTitle} onChange={(event) => setGroupTitle(event.target.value)} placeholder="Weekend plans" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-violet-400/50" />
            </label>
            <p className="mb-2 mt-5 text-xs font-medium text-slate-400">Add friends ({groupMemberIds.length} selected)</p>
            <div className="max-h-60 space-y-1 overflow-y-auto rounded-xl border border-white/[0.08] bg-black/10 p-2">
              {friends.map((friend) => {
                const checked = groupMemberIds.includes(friend.user);
                return (
                  <label key={friend.user} className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/[0.05]">
                    <input type="checkbox" checked={checked} onChange={() => setGroupMemberIds((current) => {
                      if (checked) return current.filter((id) => id !== friend.user);
                      if (current.length >= 19) {
                        setError("A group can have up to 20 members, including you.");
                        return current;
                      }
                      return [...current, friend.user];
                    })} className="accent-violet-500" />
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 text-xs font-semibold">{friend.display_name.slice(0, 1).toUpperCase()}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-slate-200">{friend.display_name}</span>
                      <span className="block truncate text-xs text-slate-500">@{friend.username}</span>
                    </span>
                    {friendIsOnline(friend) ? <span className="text-[10px] text-emerald-300">Online</span> : null}
                  </label>
                );
              })}
              {friends.length === 0 ? <p className="p-4 text-center text-sm text-slate-500">Add friends before creating a group.</p> : null}
            </div>
            <button type="submit" disabled={creatingGroup || !groupTitle.trim() || groupMemberIds.length < 2} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
              {creatingGroup ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
              {creatingGroup ? "Creating group..." : "Create group"}
            </button>
          </form>
        </div>
      ) : null}
    </main>
  );
}

function isNotFound(cause: unknown) {
  return typeof cause === "object" && cause !== null && "status" in cause && cause.status === 404;
}

export default function ChatPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">Loading messages...</main>}>
      <ChatContent />
    </Suspense>
  );
}
