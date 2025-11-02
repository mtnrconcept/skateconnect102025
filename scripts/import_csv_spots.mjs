#!/usr/bin/env node
// Import spots from a CSV file into Supabase `spots` table
// Usage: node scripts/import_csv_spots.mjs <path/to/file.csv> [--dry-run] [--spot-type=skatepark] [--difficulty=3]

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
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
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN || null;
const NOMINATIM_BASE_URL = process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org';
const OSM_USER_AGENT = process.env.OSM_USER_AGENT || process.env.NOMINATIM_USER_AGENT || 'SkateConnectImporter/1.0 (+https://skateconnect.local; contact: dev@skateconnect.local)';

if (!SUPABASE_URL || !(SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY)) {
  console.error('Missing Supabase credentials. Provide SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (preferred) or VITE_* equivalents.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);

const args = process.argv.slice(2);
if (args.length === 0 || args[0].startsWith('--')) {
  console.error('Usage: node scripts/import_csv_spots.mjs <path/to/file.csv> [--dry-run] [--spot-type=skatepark] [--difficulty=3]');
  process.exit(1);
}

const CSV_PATH = path.resolve(process.cwd(), args[0]);
const DRY_RUN = args.includes('--dry-run');
const spotTypeArg = (args.find((a) => a.startsWith('--spot-type=')) || '--spot-type=skatepark').split('=')[1];
const difficultyArg = parseInt((args.find((a) => a.startsWith('--difficulty=')) || '--difficulty=3').split('=')[1] || '3', 10);
const targetTable = (args.find((a) => a.startsWith('--table=')) || '--table=spots_imported').split('=')[1];

// Geo providers
async function geocodeWithMapbox(address, countryCode) {
  if (!MAPBOX_TOKEN) throw new Error('Mapbox token missing');
  const url = new URL('https://api.mapbox.com/geocoding/v5/mapbox.places/' + encodeURIComponent(address) + '.json');
  url.searchParams.set('access_token', MAPBOX_TOKEN);
  url.searchParams.set('limit', '1');
  if (countryCode) url.searchParams.set('country', countryCode.toLowerCase());
  url.searchParams.set('language', 'en');
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Mapbox geocoding failed: ' + res.status);
  const data = await res.json();
  const feat = Array.isArray(data.features) ? data.features[0] : null;
  if (!feat?.center) throw new Error('No geocoding result');
  const [lon, lat] = feat.center;
  return { lat, lon, place_name: feat.place_name || address };
}

async function geocodeWithNominatim(address, countryCode) {
  const url = new URL(NOMINATIM_BASE_URL.replace(/\/$/, '') + '/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('q', address);
  if (countryCode) url.searchParams.set('countrycodes', countryCode.toLowerCase());
  url.searchParams.set('limit', '1');
  const res = await fetch(url.toString(), { headers: { 'User-Agent': OSM_USER_AGENT, 'Accept-Language': 'en' } });
  if (!res.ok) throw new Error('Nominatim geocoding failed: ' + res.status);
  const data = await res.json();
  const item = Array.isArray(data) ? data[0] : null;
  if (!item?.lat || !item?.lon) throw new Error('No geocoding result');
  return { lat: parseFloat(item.lat), lon: parseFloat(item.lon), place_name: item.display_name || address };
}

async function geocodeAddress(address, countryCode = 'US') {
  if (!address || !address.trim()) throw new Error('Empty address');
  // Prefer Mapbox if available, else OSM
  try {
    if (MAPBOX_TOKEN) return await geocodeWithMapbox(address, countryCode);
  } catch (e) {
    console.warn('Mapbox geocoding failed, falling back to OSM:', e.message);
  }
  // Respect Nominatim usage policy: throttle at ~1 req/s by caller
  return await geocodeWithNominatim(address, countryCode);
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
  return result.map((s) => s.trim());
}

async function importCsv(filePath) {
  if (!fs.existsSync(filePath)) throw new Error('CSV file not found: ' + filePath);
  const rl = readline.createInterface({ input: fs.createReadStream(filePath, 'utf8'), crlfDelay: Infinity });

  let header = null;
  let lineIndex = 0;
  const countryCode = 'US';
  const batch = [];
  let added = 0, skipped = 0, failed = 0;

  for await (const rawLine of rl) {
    const line = rawLine.replace(/\uFEFF/g, '').trimEnd();
    if (!line) continue;
    if (lineIndex === 0) { header = parseCSVLine(line).map((h) => h.toLowerCase()); lineIndex++; continue; }
    const cols = parseCSVLine(line);
    const get = (name) => cols[header.indexOf(name)] ?? '';
    const name = get('name');
    const address = get('address');
    const imageUrl = get('image_url') || get('image') || '';
    let lat = parseFloat(get('latitude'));
    let lon = parseFloat(get('longitude'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      try {
        const geo = await geocodeAddress(address, countryCode);
        lat = geo.lat; lon = geo.lon;
        // throttle if using OSM (best effort):
        if (!MAPBOX_TOKEN) await new Promise((r) => setTimeout(r, 1200));
      } catch (e) {
        failed++; console.error('GEOCODE FAIL:', name, '—', e.message); continue;
      }
    }
    if (!name || !address || !Number.isFinite(lat) || !Number.isFinite(lon)) { failed++; continue; }

    const payload = {
      created_by: null,
      name,
      description: 'Imported from CSV',
      address,
      latitude: lat,
      longitude: lon,
      spot_type: spotTypeArg || 'skatepark',
      difficulty: Number.isFinite(difficultyArg) ? difficultyArg : 3,
      surfaces: [],
      modules: [],
    };

    if (DRY_RUN) {
      added++; // simulate
    } else {
      try {
        const { data: inserted, error } = await supabase
          .from(targetTable)
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;

        // Insert cover photo if provided
        if (imageUrl && inserted?.id) {
          try {
            const { error: mediaErr } = await supabase.from('spot_media').insert({
              spot_id: inserted.id,
              media_url: imageUrl,
              media_type: 'photo',
              user_id: null,
              is_cover_photo: true,
            });
            if (mediaErr) {
              // Fallback without is_cover_photo or user_id if schema differs
              try {
                const { error: mediaErr2 } = await supabase.from('spot_media').insert({
                  spot_id: inserted.id,
                  media_url: imageUrl,
                  media_type: 'photo',
                });
                if (mediaErr2) {
                  // Log but don't fail the whole spot insert
                  console.warn('MEDIA INSERT WARN:', name, '-', mediaErr2.message);
                }
              } catch (e2) {
                console.warn('MEDIA INSERT WARN:', name, '-', e2.message);
              }
            }
          } catch (e) {
            console.warn('MEDIA INSERT WARN:', name, '-', e.message);
          }
        }

        added++;
      } catch (e) {
        // try to skip duplicates by name+address
        try {
          const { data } = await supabase.from('spots').select('id').ilike('name', name).ilike('address', `%${address.split(',')[0]}%`).limit(1).maybeSingle();
          if (data?.id) { skipped++; continue; }
        } catch {}
        failed++; console.error('INSERT FAIL:', name, '—', e.message);
      }
    }
  }

  console.log(`\nDone. Added: ${added}, Skipped: ${skipped}, Failed: ${failed}${DRY_RUN ? ' (dry-run)' : ''}`);
}

importCsv(CSV_PATH).catch((e) => { console.error(e); process.exit(1); });
