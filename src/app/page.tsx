import { supabase } from "@/lib/supabase/client";

export default async function Home() {
  const { data, error } = await supabase
    .from("teams")
    .select("team_id, team_name")
    .limit(5);

  if (error) {
    return (
      <main className="p-8">
        <h1 className="text-xl font-bold">Error</h1>
        <pre className="mt-4 text-sm">
          {JSON.stringify(error, null, 2)}
        </pre>
      </main>
    );
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Teams</h1>
      <ul className="space-y-2">
        {data?.map((t) => (
          <li key={t.team_id}>{t.team_name}</li>
        ))}
      </ul>
    </main>
  );
}
