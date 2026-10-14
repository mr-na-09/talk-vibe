"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { pb } from "@/lib/pocketbase";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace(pb.authStore.isValid ? "/dashboard" : "/login");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
      Taking you to TalkVibe...
    </main>
  );
}
