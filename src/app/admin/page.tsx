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
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Admin</h1>
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm text-gray-600 hover:text-gray-800 underline"
        >
          Logout
        </button>
      </div>

      <div className="space-y-4">
        <Link
          href="/admin/add-game"
          className="block rounded-lg border border-gray-300 bg-white px-6 py-4 text-lg font-medium hover:bg-gray-50"
        >
          Add new game
        </Link>

        <Link
          href="/admin/edit-game"
          className="block rounded-lg border border-gray-300 bg-white px-6 py-4 text-lg font-medium hover:bg-gray-50"
        >
          Edit existing game
        </Link>
      </div>
    </main>
  );
}
