import Link from "next/link";
import TeamRosterEditor from "@/app/components/TeamRosterEditor";

export default function AdminRosterPage() {
  return (
    <>
      <div className="mx-auto max-w-3xl px-4 pt-6">
        <Link href="/admin" className="text-sm text-[var(--accent)] hover:underline">
          Back to admin
        </Link>
      </div>
      <TeamRosterEditor adminMode />
    </>
  );
}
