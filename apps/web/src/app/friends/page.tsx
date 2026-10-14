"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ClientResponseError } from "pocketbase";
import { ArrowLeft, Check, LoaderCircle, Search, UserPlus, X } from "lucide-react";
import { pb } from "@/lib/pocketbase";

interface TalkVibeProfile {
  id: string;
  user: string;
  display_name: string;
  username: string;
  talkvibe_id: string;
  bio: string;
}

interface FriendRequestRecord {
  id: string;
  sender: string;
  receiver: string;
  status: "pending" | "accepted" | "rejected";
  expand?: {
    sender?: { id: string; email: string };
    receiver?: { id: string; email: string };
  };
}

function profileSearchFilter(search: string) {
  const escaped = search.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  if (/^TV-[A-Z0-9]{6}$/i.test(search)) {
    return `talkvibe_id = "${escaped.toUpperCase()}"`;
  }
  if (/^[a-z0-9_]{3,32}$/i.test(search)) {
    return `username = "${escaped.toLowerCase()}"`;
  }
  throw new Error("TalkVibe ID (TV-XXXXXX) ya username search karein.");
}

export default function FriendsPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [busyRequestId, setBusyRequestId] = useState("");
  const [result, setResult] = useState<TalkVibeProfile | null>(null);
  const [requests, setRequests] = useState<FriendRequestRecord[]>([]);
  const [profiles, setProfiles] = useState<TalkVibeProfile[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const loadFriendsAndRequests = useCallback(async () => {
    const user = pb.authStore.model;
    if (!pb.authStore.isValid || !user) {
      router.replace("/login");
      return { requests: [] as FriendRequestRecord[], profiles: [] as TalkVibeProfile[] };
    }

    const friendFilter =
      `sender = "${user.id}" && status = "accepted" || ` +
      `receiver = "${user.id}" && status = "accepted"`;
    const requestFilter =
      `sender = "${user.id}" || receiver = "${user.id}"`;

    const [accepted, visibleRequests] = await Promise.all([
      pb.collection("friend_requests").getFullList<FriendRequestRecord>({
        filter: friendFilter,
        sort: "-updated",
        expand: "sender,receiver",
        requestKey: null,
      }),
      pb.collection("friend_requests").getFullList<FriendRequestRecord>({
        filter: requestFilter,
        sort: "-created",
        expand: "sender,receiver",
        requestKey: null,
      }),
    ]);
    const friendIds = [...new Set(
      accepted.map((request) =>
        request.sender === user.id ? request.receiver : request.sender,
      ),
    )];
    if (friendIds.length === 0) {
      return { requests: visibleRequests, profiles: [] as TalkVibeProfile[] };
    }

    const friendProfileFilter = friendIds
      .map((friendId) => `user = "${friendId}"`)
      .join(" || ");
    const friendProfiles = await pb.collection("profiles").getFullList<TalkVibeProfile>({
      filter: friendProfileFilter,
      sort: "display_name",
      requestKey: null,
    });
    return { requests: visibleRequests, profiles: friendProfiles };
  }, [router]);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.replace("/login");
      return;
    }

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    void loadFriendsAndRequests()
      .then(({ requests: loadedRequests, profiles: loadedProfiles }) => {
        if (cancelled) return;
        setRequests(loadedRequests);
        setProfiles(loadedProfiles);
      })
      .catch((cause: unknown) => {
        console.error(cause);
        if (!cancelled) setError("Friends aur requests load nahi ho sake. Connection check karein.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    void pb.collection("friend_requests")
      .subscribe("*", () => {
        if (!cancelled) {
          void loadFriendsAndRequests()
            .then(({ requests: loadedRequests, profiles: loadedProfiles }) => {
              if (cancelled) return;
              setRequests(loadedRequests);
              setProfiles(loadedProfiles);
            })
            .catch((cause: unknown) => {
              console.error(cause);
              if (!cancelled) setError("Friend request update sync nahi ho paya.");
            });
        }
      })
      .then((stop) => {
        if (cancelled) stop();
        else unsubscribe = stop;
      })
      .catch((cause: unknown) => {
        console.error(cause);
        if (!cancelled) setError("Live friend updates connect nahi hue. Refresh karke dobara try karein.");
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [loadFriendsAndRequests, router]);

  async function refreshFriendState() {
    const { requests: loadedRequests, profiles: loadedProfiles } = await loadFriendsAndRequests();
    setRequests(loadedRequests);
    setProfiles(loadedProfiles);
  }

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setResult(null);
    setSearching(true);

    try {
      const filter = profileSearchFilter(query.trim());
      const match = await pb.collection("profiles").getFirstListItem<TalkVibeProfile>(filter, {
        requestKey: null,
      });
      if (match.user === pb.authStore.model?.id) {
        setNotice("Yeh aapka hi profile hai.");
      } else {
        setResult(match);
      }
    } catch (cause) {
      console.error(cause);
      setError(
        cause instanceof Error && cause.message.startsWith("TalkVibe ID")
          ? cause.message
          : "Is ID ya username se profile nahi mili. ID/username dobara check karein.",
      );
    } finally {
      setSearching(false);
    }
  }

  async function sendRequest(target: TalkVibeProfile) {
    const user = pb.authStore.model;
    if (!user) {
      router.replace("/login");
      return;
    }

    setError("");
    setNotice("");
    setBusyRequestId(target.id);
    try {
      const existing = await pb.collection("friend_requests").getFullList<FriendRequestRecord>({
        filter:
          `(sender = "${user.id}" && receiver = "${target.user}") || ` +
          `(sender = "${target.user}" && receiver = "${user.id}")`,
        requestKey: null,
      });

      if (existing.some((request) => request.status === "accepted")) {
        setNotice("Aap pehle se friends hain.");
      } else if (existing.some((request) => request.status === "pending")) {
        setNotice("Aap dono ke beech friend request pehle se pending hai.");
      } else {
        await pb.collection("friend_requests").create({
          sender: user.id,
          receiver: target.user,
          status: "pending",
        });
        setNotice(`Friend request ${target.display_name} ko bhej di.`);
      }

      await refreshFriendState();
    } catch (cause) {
      console.error(cause);
      setError("Friend request send nahi ho payi. Dobara try karein.");
    } finally {
      setBusyRequestId("");
    }
  }

  async function respondToRequest(request: FriendRequestRecord, accepted: boolean) {
    const user = pb.authStore.model;
    if (!user || request.receiver !== user.id || request.status !== "pending") return;

    setError("");
    setNotice("");
    setBusyRequestId(request.id);
    try {
      await pb.collection("friend_requests").update(request.id, {
        sender: request.sender,
        receiver: request.receiver,
        status: accepted ? "accepted" : "rejected",
      });

      if (accepted) {
        try {
          await pb.collection("friendships").create({
            user_a: request.sender,
            user_b: request.receiver,
          });
        } catch (cause) {
          console.error(cause);
          setError("Request accept ho gayi, lekin friendship record create nahi hua. Admin se rules check karwayein.");
          return;
        }
        setNotice("Friend request accept ho gayi.");
      } else {
        setNotice("Friend request reject kar di.");
      }
      await refreshFriendState();
    } catch (cause) {
      if (cause instanceof ClientResponseError && cause.status === 404) {
        try {
          await refreshFriendState();
          setError("Request update nahi hui. Request list refresh kar di hai; pending request ho to dobara try karein.");
        } catch (refreshCause) {
          console.error(refreshCause);
          setError("Request update nahi hui aur request list refresh bhi nahi ho saki.");
        }
      } else {
        console.error(cause);
        setError("Request update nahi ho payi. Dobara try karein.");
      }
    } finally {
      setBusyRequestId("");
    }
  }

  async function cancelRequest(request: FriendRequestRecord) {
    setError("");
    setNotice("");
    setBusyRequestId(request.id);
    try {
      await pb.collection("friend_requests").delete(request.id);
      setNotice("Outgoing friend request cancel kar di.");
      await refreshFriendState();
    } catch (cause) {
      console.error(cause);
      setError("Friend request cancel nahi ho payi. Dobara try karein.");
    } finally {
      setBusyRequestId("");
    }
  }

  const userId = pb.authStore.model?.id;
  const incomingRequests = requests.filter(
    (request) => request.receiver === userId && request.status === "pending",
  );
  const outgoingRequests = requests.filter(
    (request) => request.sender === userId && request.status === "pending",
  );

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link href="/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>

        <header className="mb-6">
          <p className="text-xs uppercase tracking-[0.3em] text-indigo-400">TalkVibe</p>
          <h1 className="mt-2 text-3xl font-semibold">Friends</h1>
          <p className="mt-2 text-sm text-slate-400">TalkVibe ID ya exact username se kisi ko dhoondhein.</p>
        </header>

        {error ? <p role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p> : null}
        {notice ? <p role="status" className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{notice}</p> : null}

        <form onSubmit={handleSearch} className="flex gap-2 rounded-2xl border border-slate-800 bg-slate-900 p-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent px-3 py-2 outline-none"
            placeholder="TV-8K4M2P or username"
            aria-label="Search by TalkVibe ID or username"
          />
          <button disabled={searching || !query.trim()} className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 font-medium text-white disabled:opacity-50">
            {searching ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </button>
        </form>

        {result ? (
          <section className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4">
            <div>
              <h2 className="font-semibold">{result.display_name}</h2>
              <p className="text-sm text-slate-300">@{result.username} · {result.talkvibe_id}</p>
              {result.bio ? <p className="mt-2 text-sm text-slate-400">{result.bio}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => void sendRequest(result)}
              disabled={busyRequestId === result.id}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-indigo-500 px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              {busyRequestId === result.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Add friend
            </button>
          </section>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <h2 className="text-lg font-semibold">Incoming requests <span className="text-sm text-slate-400">({incomingRequests.length})</span></h2>
            {loading ? <p className="mt-4 text-sm text-slate-400">Loading...</p> : null}
            {!loading && incomingRequests.length === 0 ? <p className="mt-4 text-sm text-slate-400">Koi pending request nahi hai.</p> : null}
            <div className="mt-3 space-y-2">
              {incomingRequests.map((request) => (
                <div key={request.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-800 p-3">
                  <span className="min-w-0 truncate text-sm">{request.expand?.sender?.email ?? "TalkVibe user"}</span>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" aria-label="Accept request" disabled={busyRequestId === request.id} onClick={() => void respondToRequest(request, true)} className="rounded-lg bg-emerald-600 p-2 disabled:opacity-50"><Check className="h-4 w-4" /></button>
                    <button type="button" aria-label="Reject request" disabled={busyRequestId === request.id} onClick={() => void respondToRequest(request, false)} className="rounded-lg bg-slate-700 p-2 disabled:opacity-50"><X className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <h2 className="text-lg font-semibold">Outgoing requests <span className="text-sm text-slate-400">({outgoingRequests.length})</span></h2>
            {loading ? <p className="mt-4 text-sm text-slate-400">Loading...</p> : null}
            {!loading && outgoingRequests.length === 0 ? <p className="mt-4 text-sm text-slate-400">Aapne koi request nahi bheji.</p> : null}
            <div className="mt-3 space-y-2">
              {outgoingRequests.map((request) => (
                <div key={request.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-800 p-3">
                  <span className="min-w-0 truncate text-sm">{request.expand?.receiver?.email ?? "TalkVibe user"}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-amber-300">Pending</span>
                    <button type="button" disabled={busyRequestId === request.id} onClick={() => void cancelRequest(request)} className="rounded-lg bg-slate-700 px-2 py-1 text-xs text-slate-200 disabled:opacity-50">
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <h2 className="text-lg font-semibold">Your friends <span className="text-sm text-slate-400">({profiles.length})</span></h2>
          {loading ? <p className="mt-4 text-sm text-slate-400">Loading...</p> : null}
          {!loading && profiles.length === 0 ? <p className="mt-4 text-sm text-slate-400">Abhi friends nahi hain. Upar ID se search karke request bhejein.</p> : null}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {profiles.map((friend) => (
              <div key={friend.id} className="rounded-xl bg-slate-800 p-3">
                <p className="font-medium">{friend.display_name}</p>
                <p className="text-sm text-slate-400">@{friend.username} · {friend.talkvibe_id}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
