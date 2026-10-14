"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/chat");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center text-slate-300">
      <p>Opening your messages...</p>
    </main>
  );
}
