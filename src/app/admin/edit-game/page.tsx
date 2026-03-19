"use client";

import AdminGameEntry from "../add-game/page";

export default function AdminEditGamePage({ searchParams }: { searchParams: { edit?: string } }) {
  return <AdminGameEntry showEditDropdown={true} initialEditId={searchParams.edit} />;
}
