"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { adminFetch } from "@/lib/admin-fetch";

type Status = "checking" | "ok" | "forbidden";

export default function ManagerLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let active = true;

    const check = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      if (!session) {
        router.replace("/login");
        return;
      }

      const res = await adminFetch("/api/manager/me");
      if (!active) return;

      setStatus(res.ok ? "ok" : "forbidden");
    };

    void check();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login");
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  if (status === "checking") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-sm text-[var(--text-muted)]">Checking access...</p>
      </main>
    );
  }

  if (status === "forbidden") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-sm text-[var(--text-muted)]">
          Your account isn&apos;t assigned to manage any team yet. Contact an admin to get set up.
        </p>
      </main>
    );
  }

  return <>{children}</>;
}
