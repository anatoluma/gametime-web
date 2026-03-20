import AdminGameEntry from "../add-game/AdminGameEntry";

export const dynamic = 'force-dynamic';

export default function AdminEditGamePage({
  searchParams,
}: {
  searchParams: { edit?: string };
}) {
  return <AdminGameEntry showEditDropdown={true} initialEditId={searchParams.edit} />;
}
