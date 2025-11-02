import { db } from "./db.js";
import { z } from "zod";

const createSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  address: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

export type SpotRow = {
  id: string;
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export async function createSpot(body: unknown): Promise<SpotRow> {
  const payload = createSchema.parse(body);
  const id = payload.id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await db.run(
    `insert into spots (id, name, address, latitude, longitude) values (?, ?, ?, ?, ?)`,
    [
      id,
      payload.name,
      payload.address ?? null,
      typeof payload.latitude === 'number' ? payload.latitude : null,
      typeof payload.longitude === 'number' ? payload.longitude : null,
    ],
  );
  const row = await db.get<SpotRow>(`select id, name, address, latitude, longitude from spots where id = ?`, [id]);
  return row!;
}

export async function listSpots(params: { search?: string | null; limit?: number; offset?: number }) {
  const limit = Number.isFinite(params.limit) ? Math.max(0, Math.min(1000, params.limit!)) : 500;
  const offset = Number.isFinite(params.offset) ? Math.max(0, params.offset!) : 0;
  const search = (params.search || "").trim();

  if (search.length > 0) {
    const like = `%${search}%`;
    const rows = await db.all<SpotRow & { cover_url?: string }>(
      `select id, name, address, latitude, longitude,
              (select media_url from spot_media sm where sm.spot_id = spots.id and sm.is_cover_photo = 1 order by sm.created_at desc limit 1) as cover_url
       from spots
       where name like ? or coalesce(address,'') like ?
       order by rowid desc limit ? offset ?`,
      [like, like, limit, offset],
    );
    const countRow = await db.get<{ count: number }>(
      `select count(*) as count from spots where name like ? or coalesce(address,'') like ?`,
      [like, like],
    );
    return { items: rows, total: countRow?.count ?? 0 };
  }

  const rows = await db.all<SpotRow & { cover_url?: string }>(
    `select id, name, address, latitude, longitude,
            (select media_url from spot_media sm where sm.spot_id = spots.id and sm.is_cover_photo = 1 order by sm.created_at desc limit 1) as cover_url
     from spots order by rowid desc limit ? offset ?`,
    [limit, offset],
  );
  const countRow = await db.get<{ count: number }>(`select count(*) as count from spots`);
  return { items: rows, total: countRow?.count ?? 0 };
}
