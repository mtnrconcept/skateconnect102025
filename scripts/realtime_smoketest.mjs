// scripts/realtime_smoketest.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.error("❌ Set SUPABASE_URL and SUPABASE_ANON_KEY (or VITE_*) in env.");
  process.exit(1);
}

const supabase = createClient(url, anon);

const matchId = process.argv[2]; // passe un matchId en argument
if (!matchId) {
  console.error("Usage: node scripts/realtime_smoketest.mjs <matchId>");
  process.exit(1);
}

console.log("🔌 Connecting Realtime…", url, "match:", matchId);

// 1) subscribe
const chan = supabase
  .channel(`gos:${matchId}`)
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "gos_chat_message", filter: `match_id=eq.${matchId}` },
    (payload) => console.log("🟢 CHAT INSERT:", payload.new)
  )
  .on("postgres_changes", { event: "UPDATE", schema: "public", table: "gos_match", filter: `id=eq.${matchId}` },
    (payload) => console.log("🟠 MATCH UPDATE:", payload.new)
  )
  .subscribe((status) => console.log("📡 Status:", status));

// 2) push events after short delay
setTimeout(async () => {
  console.log("✉️  Insert chat message…");
  await supabase.from("gos_chat_message").insert({
    match_id: matchId,
    sender: null,
    kind: "system",
    text: "Realtime smoke (Node)",
    payload: { from: "node" },
  });

  console.log("🔁 Toggle turn…");
  const { data: m } = await supabase.from("gos_match").select("*").eq("id", matchId).single();
  const next = m.turn === "A" ? "B" : "A";
  await supabase.from("gos_match").update({ turn: next }).eq("id", matchId);

  console.log("✅ Done. Watch the console for events. Press Ctrl+C to exit.");
}, 1500);
