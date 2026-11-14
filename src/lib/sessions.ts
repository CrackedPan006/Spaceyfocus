import { supabase } from "./Supabase";

export type LocalSession = { date: string; completedAt: string; minutes: number };

const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

function toRow(s: LocalSession, userId: string) {
  const completed = new Date(s.completedAt);
  const seconds = s.minutes * 60;

  return {
    user_id: userId,
    started_at: new Date(completed.getTime() - seconds * 1000).toISOString(),
    completed_at: completed.toISOString(),
    duration_seconds: seconds,
    timezone
  };
}

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

// Called after every completed focus session
export async function pushSession(s: LocalSession): Promise<void> {
  const userId = await getUserId();
  if (!userId) {
    console.warn("[sessions] Not logged in, so the session was not saved to the cloud.");
    return;
  }

  const { error } = await supabase
    .from("focus_sessions")
    .upsert(toRow(s, userId), { onConflict: "user_id,completed_at", ignoreDuplicates: true });

  if (error) console.error("[sessions] Save failed:", error.message);
  else console.log("[sessions] Session saved to the cloud.");
}

// Uploads the guest history from this browser (safe to run repeatedly)
export async function syncLocalHistory(): Promise<void> {
  const userId = await getUserId();
  if (!userId) {
    console.warn("[sessions] Not logged in, so the local history was not uploaded.");
    return;
  }

  let local: LocalSession[] = [];
  try {
    local = JSON.parse(localStorage.getItem("spaceyfocus-session-history") ?? "[]");
  } catch {
    return;
  }
  if (!Array.isArray(local) || local.length === 0) return;

  const { error } = await supabase
    .from("focus_sessions")
    .upsert(
      local.map((s) => toRow(s, userId)),
      { onConflict: "user_id,completed_at", ignoreDuplicates: true }
    );

  if (error) console.error("[sessions] Upload failed:", error.message);
  else console.log("[sessions] Local history uploaded.");
}