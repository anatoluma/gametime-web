import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

export default async function TeamsPage() {
  const { data: teams, error } = await supabase
    .from("teams")
    .select("team_id, team_name, city, coach")
    .eq("is_active", true)
    .order("team_name");

  if (error) {
    return <pre className="p-6">{JSON.stringify(error, null, 2)}</pre>;
  }

  const list = teams ?? [];

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-6">Teams</h1>

      <ul className="space-y-3">
        {list.map((t) => (
          <li key={t.team_id} className="border rounded-lg p-4 hover:bg-gray-50">
            <Link href={`/teams/${t.team_id}`} className="font-semibold text-lg">
              {t.team_name}
            </Link>

            <div className="text-sm text-gray-600 mt-1">
              {t.city ? `City: ${t.city}` : null}
              {t.city && t.coach ? " • " : null}
              {t.coach ? `Coach: ${t.coach}` : null}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
