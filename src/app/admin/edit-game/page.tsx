"use client";

import AdminGameEntry from "../add-game/AdminGameEntry";

export default function AdminEditGamePage({ searchParams }: { searchParams: { edit?: string } }) {
  return <AdminGameEntry showEditDropdown={true} initialEditId={searchParams.edit} />;
}
