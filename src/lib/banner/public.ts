import { supabase } from "@/lib/supabase/client";

export type PublicBanner = {
  banner_id: string;
  game_id: string;
  headline: string | null;
  image_url: string;
};

const MAX_BANNERS = 5;

/** Public (anon) read: only approved rows are visible via RLS, and only granted columns may be selected. */
export async function getPublicBanners(): Promise<PublicBanner[]> {
  const { data, error } = await supabase
    .from("homepage_banners")
    .select("banner_id, game_id, headline, published_path, sort_order, reviewed_at")
    .eq("status", "approved")
    .not("published_path", "is", null)
    .order("sort_order", { ascending: true })
    .order("reviewed_at", { ascending: false })
    .limit(MAX_BANNERS);

  if (error || !data) return [];

  return data.map((row) => ({
    banner_id: row.banner_id,
    game_id: row.game_id,
    headline: row.headline,
    // Paths are versioned (v<n>.png), so the URL changes whenever the image does.
    image_url: supabase.storage.from("banners").getPublicUrl(row.published_path as string).data.publicUrl,
  }));
}
