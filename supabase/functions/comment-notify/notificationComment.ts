import type { SupabaseClient } from "supabase";

/** Read at delivery time: a queued notification may outlive its comment. */
export const loadNotificationComment = async (
  client: SupabaseClient,
  commentId: string,
) => {
  const { data, error } = await client
    .from("comments")
    .select("id, review_id, user_id, text, deleted_at")
    .eq("id", commentId)
    .maybeSingle();
  if (error) throw error;
  return data as {
    id: string;
    review_id: string;
    user_id: string;
    text: string;
    deleted_at: string | null;
  } | null;
};
