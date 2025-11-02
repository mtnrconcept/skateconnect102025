import { db } from "./db.js";
import { z } from "zod";

const schema = z.object({
  spot_id: z.string().min(1),
  user_id: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional().nullable()
});

export async function upsertRating(body: any) {
  const { spot_id, user_id, rating, comment } = schema.parse(body);

  // Crée un spot placeholder si besoin
  const hasSpot = await db.get("select 1 as ok from spots where id = ?", [spot_id]);
  if (!hasSpot) await db.run("insert into spots (id, name) values (?, ?)", [spot_id, "Unknown Spot"]);

  await db.run(
    `insert into spot_ratings (spot_id, user_id, rating, comment)
     values (?, ?, ?, ?)
     on conflict(spot_id, user_id) do update set
       rating = excluded.rating,
       comment = excluded.comment,
       updated_at = datetime('now')`,
    [spot_id, user_id, rating, comment ?? null],
  );
}

export async function listRatings(spot_id: string) {
  return db.all(
    `select spot_id, user_id, rating, comment, created_at, updated_at
     from spot_ratings where spot_id = ?`,
    [spot_id],
  );
}

export async function getStats(spot_id: string) {
  const row = await db.get<{ n?: number; avg?: number }>(
    `select count(*) as n, avg(rating) as avg from spot_ratings where spot_id = ?`,
    [spot_id],
  );
  return { count: row?.n ?? 0, avg: row?.avg ? Number(row.avg).toFixed(2) : null };
}
