import AdminGameEntry from "./AdminGameEntry";

export const dynamic = 'force-dynamic';

export default function Page({
  searchParams,
}: {
  searchParams: { edit?: string };
}) {
  return <AdminGameEntry showEditDropdown={false} initialEditId={searchParams.edit} />;
}
