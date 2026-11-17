"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { adminFetch } from "@/lib/admin-fetch";

type Status = "checking" | "ok" | "forbidden";

export default function ManagerLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [isAdmin, setIsAdmin] = useState(false);

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

      if (res.ok) {
        setStatus("ok");
      } else {
        // Check if user is an admin
        const adminRes = await adminFetch("/api/admin/teams");
        if (!active) return;
        
        if (adminRes.ok) {
          setIsAdmin(true);
          setStatus("ok");
        } else {
          setStatus("forbidden");
        }
      }
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

  return (
    <>
      {isAdmin && (
        <div className="bg-[var(--surface)] border-b border-[var(--border)]">
          <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-sm text-[var(--text-muted)]">Admin roster access</p>
            <Link href="/admin" className="text-sm text-[var(--accent)] hover:underline">
              Back to admin
            </Link>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
