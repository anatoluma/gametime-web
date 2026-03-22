import Link from "next/link";

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">Admin</h1>

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
