"use client";

import { useEffect } from "react";
import { pb } from "@/lib/pocketbase";

interface PresenceProfile {
  id: string;
  user: string;
  talkvibe_id: string;
}

let presenceSyncInFlight = false;

export function PresenceTracker() {
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;
    let currentUserId: string | undefined;

    async function heartbeat() {
      const user = pb.authStore.model;
      if (!pb.authStore.isValid || !user || presenceSyncInFlight) return;
      presenceSyncInFlight = true;

      try {
        const profile = await pb.collection("profiles").getFirstListItem<PresenceProfile>(
          `user = "${user.id}"`,
          { requestKey: null },
        );
        if (pb.authStore.model?.id !== user.id) return;

        await pb.collection("profiles").update(profile.id, {
          user: profile.user,
          talkvibe_id: profile.talkvibe_id,
          status: "online",
          last_seen: new Date().toISOString(),
        }, { requestKey: null });
      } catch (cause) {
        console.error("Could not update online presence.", cause);
      } finally {
        presenceSyncInFlight = false;
      }
    }

    function startPresence() {
      const userId = pb.authStore.model?.id;
      if (!pb.authStore.isValid || !userId) {
        if (intervalId) clearInterval(intervalId);
        intervalId = undefined;
        currentUserId = undefined;
        return;
      }
      if (currentUserId === userId && intervalId) return;

      if (intervalId) clearInterval(intervalId);
      currentUserId = userId;
      void heartbeat();
      intervalId = setInterval(() => void heartbeat(), 30_000);
    }

    const unsubscribe = pb.authStore.onChange(startPresence, true);
    return () => {
      unsubscribe();
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return null;
}
