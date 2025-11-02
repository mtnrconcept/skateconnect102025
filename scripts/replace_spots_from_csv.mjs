#!/usr/bin/env node
// Replace the Supabase `spots` table content using a CSV adapted to spots rows, and attach cover images from CSV.
// Usage: node scripts/replace_spots_from_csv.mjs <path/to/file.csv> [--table=spots]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

loadDotEnv(path.resolve(__dirname, '..'));
loadDotEnv(path.resolve(__dirname, '..', '..'));

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase service credentials (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

if (process.argv.length < 3) {
  console.error('Usage: node scripts/replace_spots_from_csv.mjs <path/to/file.csv> [--table=spots]');
  process.exit(1);
}

const CSV_PATH = path.resolve(process.cwd(), process.argv[2]);
const targetTable = (process.argv.find(a => a.startsWith('--table=')) || '--table=spots').split('=')[1];

if (!fs.existsSync(CSV_PATH)) {
  console.error('CSV not found:', CSV_PATH);
  process.exit(1);
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = false;
      } else current += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { result.push(current); current = ''; }
      else current += ch;
    }
  }
  result.push(current);
  return result.map(s => s.trim());
}

function toArrayField(value) {
  if (value == null) return [];
  const s = String(value).trim();
  if (s.length === 0) return [];
  if (s.startsWith('[')) {
    try { const arr = JSON.parse(s); return Array.isArray(arr) ? arr.map(x => String(x)) : []; } catch { return []; }
  }
  return s.split(/\s*,\s*/).filter(Boolean);
}

function toBool(value) {
  const s = String(value).toLowerCase();
  return s === 'true' || s === '1' || s === 't' || s === 'yes';
}

async function main() {
  const raw = fs.readFileSync(CSV_PATH, 'utf8').replace(/\uFEFF/g, '');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const header = parseCSVLine(lines.shift() ?? '').map(h => h.toLowerCase());

  const idx = (name) => header.indexOf(name);
  const rows = [];
  for (const line of lines) {
    const cols = parseCSVLine(line);
    const get = (name) => cols[idx(name)] ?? '';
    const lat = parseFloat(get('latitude'));
    const lon = parseFloat(get('longitude'));
    const name = get('name');
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    rows.push({
      id: get('id') || null,
      created_by: get('created_by') || null,
      name,
      description: get('description') || '',
      address: get('address') || '',
      latitude: lat,
      longitude: lon,
      spot_type: get('spot_type') || 'skatepark',
      difficulty: Number.isFinite(parseInt(get('difficulty'))) ? parseInt(get('difficulty')) : 3,
      surfaces: toArrayField(get('surfaces')),
      modules: toArrayField(get('modules')),
      is_verified: toBool(get('is_verified')),
      likes_count: Number.isFinite(parseInt(get('likes_count'))) ? parseInt(get('likes_count')) : 0,
      comments_count: Number.isFinite(parseInt(get('comments_count'))) ? parseInt(get('comments_count')) : 0,
      rating_average: null,
      rating_count: 0,
      rating_distribution: null,
      created_at: get('created_at') || null,
      updated_at: get('updated_at') || null,
      image_url: get('image_url') || '',
    });
  }

  console.log('Parsed rows:', rows.length);

  // Clear existing data
  // Pick a valid creator to satisfy possible insert triggers
  const { data: anyProfile, error: profErr } = await supabase.from('profiles').select('id').limit(1).maybeSingle();
  if (profErr) {
    console.error('Unable to fetch a profile to use as creator:', profErr.message);
    process.exit(1);
  }
  const fallbackCreator = anyProfile?.id || null;
  if (!fallbackCreator) {
    console.error('No profiles found; cannot satisfy created_by NOT NULL/trigger dependencies.');
    process.exit(1);
  }
  try {
    // Try to remove media first to avoid FK issues if cascade isn't set
    await supabase.from('spot_media').delete().neq('spot_id', '00000000-0000-0000-0000-000000000000');
  } catch (e) {
    console.warn('Could not clear spot_media first:', e.message);
  }

  const { error: delErr } = await supabase.from(targetTable).delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delErr) {
    console.error('Failed to clear table', targetTable, delErr.message);
    process.exit(1);
  }

  // Insert in batches
  const BATCH = 500;
  let insertedCount = 0;
  let coverCount = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    // Map to DB payload (omit id if empty to let DB default)
    const isUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s || ''));
    const payload = slice.map(r => {
      const { image_url, ...spot } = r;
      const out = { ...spot };
      if (!r.id || String(r.id).trim().length === 0 || !isUuid(r.id)) delete out.id;
      if (!r.created_by || String(r.created_by).trim().length === 0) out.created_by = fallbackCreator;
      // keep created_at/updated_at only if provided; otherwise let defaults
      if (!r.created_at) delete out.created_at;
      if (!r.updated_at) delete out.updated_at;
      return out;
    });

    // Restrict to known/common columns to avoid schema mismatch
    const sanitized = payload.map((row) => {
      const allowed = {
        id: row.id,
        created_by: row.created_by,
        name: row.name,
        description: row.description,
        address: row.address,
        latitude: row.latitude,
        longitude: row.longitude,
        spot_type: row.spot_type,
        difficulty: row.difficulty,
        surfaces: row.surfaces,
        modules: row.modules,
        is_verified: row.is_verified,
        likes_count: row.likes_count,
        comments_count: row.comments_count,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
      // Remove undefined keys
      Object.keys(allowed).forEach((k) => allowed[k] === undefined && delete allowed[k]);
      return allowed;
    });

    const { data: inserted, error } = await supabase
      .from(targetTable)
      .insert(sanitized)
      .select('id, name')
      ;
    if (error) {
      console.error('Insert batch failed at', i, error.message);
      process.exit(1);
    }
    insertedCount += inserted?.length || 0;

    // Build cover media rows
    const mediaRows = [];
    for (let j = 0; j < slice.length; j++) {
      const src = slice[j];
      const row = inserted[j];
      const url = src.image_url;
      if (row?.id && url && url.startsWith('http')) {
        mediaRows.push({ spot_id: row.id, media_url: url, media_type: 'photo', is_cover_photo: true, user_id: fallbackCreator });
      }
    }
    if (mediaRows.length > 0) {
      // Try extended insert; fallback to minimal if schema differs
      let mediaErr = null;
      try {
        const { error: mErr } = await supabase.from('spot_media').insert(mediaRows);
        mediaErr = mErr;
      } catch (e) {
        mediaErr = e;
      }
      if (mediaErr) {
        const minimal = mediaRows.map(m => ({ spot_id: m.spot_id, media_url: m.media_url, media_type: 'photo', user_id: fallbackCreator }));
        try {
          const { error: mErr2 } = await supabase.from('spot_media').insert(minimal);
          if (mErr2) console.warn('Cover media minimal insert warned:', mErr2.message);
          else coverCount += minimal.length;
        } catch (e2) {
          console.warn('Cover media insert failed:', e2.message);
        }
      } else {
        coverCount += mediaRows.length;
      }
    }
  }

  console.log(`Done. Inserted spots: ${insertedCount}, cover photos: ${coverCount}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
