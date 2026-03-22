import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Admin</h1>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="text-sm text-gray-600 hover:text-gray-800 underline"
          >
            Logout
          </button>
        </form>
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
