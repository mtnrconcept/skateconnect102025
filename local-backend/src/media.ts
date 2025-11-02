import { db } from "./db.js";
import { z } from "zod";

const mediaSchema = z.object({
  spot_id: z.string().min(1),
  media_url: z.string().url(),
  media_type: z.enum(['photo','video']).default('photo').optional(),
  is_cover_photo: z.boolean().optional(),
});

export async function addMedia(body: unknown) {
  const payload = mediaSchema.parse(body);
  const exists = await db.get("select id from spots where id = ?", [payload.spot_id]);
  if (!exists) throw new Error('Unknown spot_id');
  const id = `${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  await db.run(
    `insert into spot_media (id, spot_id, media_url, media_type, is_cover_photo)
     values (?, ?, ?, ?, ?)`,
    [id, payload.spot_id, payload.media_url, payload.media_type ?? 'photo', payload.is_cover_photo ? 1 : 0]
  );
  const row = await db.get(`select id, spot_id, media_url, media_type, is_cover_photo, created_at from spot_media where id = ?`, [id]);
  return row;
}

export async function listMedia(spot_id: string) {
  return db.all(
    `select id, spot_id, media_url, media_type, is_cover_photo, created_at
     from spot_media where spot_id = ? order by created_at desc`,
    [spot_id]
  );
}

export async function setCover(spot_id: string, media_id: string) {
  const exists = await db.get(`select id from spot_media where id = ? and spot_id = ?`, [media_id, spot_id]);
  if (!exists) throw new Error('Media not found for this spot');
  await db.run(`update spot_media set is_cover_photo = 0 where spot_id = ?`, [spot_id]);
  await db.run(`update spot_media set is_cover_photo = 1 where id = ?`, [media_id]);
}
