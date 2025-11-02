#!/usr/bin/env node
// Cleanup spot_media entries with blob: URLs and restore covers when possible
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadDotEnv(rootDir) {
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (!(k in process.env)) process.env[k] = v;
  }
}

loadDotEnv(process.cwd());

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase service credentials (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // 1) Demote covers that point to blob:
  await supabase.from('spot_media')
    .update({ is_cover_photo: false })
    .like('media_url', 'blob:%')
    .eq('is_cover_photo', true);

  // 2) Delete all blob: media
  const { count: toDeleteCount } = await supabase
    .from('spot_media')
    .select('id', { count: 'exact', head: true })
    .like('media_url', 'blob:%');

  const { error: delErr } = await supabase
    .from('spot_media')
    .delete()
    .like('media_url', 'blob:%');
  if (delErr) {
    console.error('Failed to delete blob media:', delErr.message);
    process.exit(1);
  }

  // 3) Restore missing covers where possible (pick latest media per spot when no cover exists)
  const { data: covers } = await supabase
    .from('spot_media')
    .select('spot_id')
    .eq('is_cover_photo', true);
  const covered = new Set((covers || []).map((r) => r.spot_id));

  const { data: allMedia } = await supabase
    .from('spot_media')
    .select('id, spot_id, created_at')
    .order('created_at', { ascending: false });

  const firstBySpot = new Map();
  for (const m of allMedia || []) {
    if (!firstBySpot.has(m.spot_id)) {
      firstBySpot.set(m.spot_id, m.id);
    }
  }

  let restored = 0;
  for (const [spotId, mediaId] of firstBySpot.entries()) {
    if (covered.has(spotId)) continue;
    const { error: upErr } = await supabase
      .from('spot_media')
      .update({ is_cover_photo: true })
      .eq('id', mediaId);
    if (!upErr) restored++;
  }

  console.log(`Cleanup complete. Removed blob media: ${toDeleteCount ?? 0}. Restored covers: ${restored}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });

