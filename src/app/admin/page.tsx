"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function AdminPage() {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-[var(--foreground)] bg-[var(--surface)] min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm text-[var(--text-muted)] hover:text-[var(--accent)] underline"
        >
          Logout
        </button>
      </div>

      <div className="space-y-4">
        <Link
          href="/admin/add-game"
          className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] px-6 py-4 text-lg font-medium hover:bg-[var(--surface-muted)]"
        >
          Add new game
        </Link>

        <Link
          href="/admin/edit-game"
          className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] px-6 py-4 text-lg font-medium hover:bg-[var(--surface-muted)]"
        >
          Edit existing game
        </Link>
      </div>
    </main>
  );
}
