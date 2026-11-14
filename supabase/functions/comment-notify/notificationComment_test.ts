import { createClient } from "supabase";
import { loadNotificationComment } from "./notificationComment.ts";

Deno.test(
  "queued notifications read current deletion status and fail closed on query errors",
  async () => {
    let fail = false;
    const client = createClient("https://example.supabase.co", "test-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: async (input) => {
          const url = new URL(String(input));
          if (!url.searchParams.get("select")?.includes("deleted_at")) {
            throw new Error("Notification query must include deletion status");
          }
          return new Response(
            JSON.stringify(
              fail
                ? { message: "offline" }
                : {
                    id: "comment",
                    review_id: "review",
                    user_id: "owner",
                    text: "Comment deleted",
                    deleted_at: "2026-11-14T00:00:00Z",
                  },
            ),
            {
              status: fail ? 500 : 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        },
      },
    });
    const comment = await loadNotificationComment(client, "comment");
    if (!comment?.deleted_at || comment.text !== "Comment deleted") {
      throw new Error("Queued delivery did not see the deleted comment");
    }
    fail = true;
    let rejected = false;
    try {
      await loadNotificationComment(client, "comment");
    } catch {
      rejected = true;
    }
    if (!rejected)
      throw new Error("Failed comment reads must not send notifications");
  },
);
