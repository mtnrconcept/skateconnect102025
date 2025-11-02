#!/usr/bin/env node
// Build a public/imported_spots.json overlay from a CSV (name,address,latitude,longitude)
import fs from 'node:fs';
import path from 'node:path';

if (process.argv.length < 3) {
  console.error('Usage: node scripts/build_csv_overlay.mjs <path/to/file.csv> [out=public/imported_spots.json]');
  process.exit(1);
}

const input = path.resolve(process.cwd(), process.argv[2]);
const out = path.resolve(process.cwd(), process.argv[3] || 'public/imported_spots.json');

if (!fs.existsSync(input)) {
  console.error('CSV not found:', input);
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
  return result.map((s) => s.trim());
}

const text = fs.readFileSync(input, 'utf8').replace(/\uFEFF/g, '');
const lines = text.split(/\r?\n/).filter(Boolean);
const header = parseCSVLine(lines.shift() ?? '').map((h) => h.toLowerCase());
const outItems = [];

for (const line of lines) {
  const cols = parseCSVLine(line);
  const get = (name) => cols[header.indexOf(name)] ?? '';
  const name = get('name');
  const address = get('address');
  const lat = parseFloat(get('latitude'));
  const lon = parseFloat(get('longitude'));
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  outItems.push({
    id: undefined,
    name,
    address,
    latitude: lat,
    longitude: lon,
    spot_type: 'skatepark',
    difficulty: 3,
    surfaces: [],
    modules: [],
  });
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(outItems));
console.log('Wrote overlay:', out, 'items:', outItems.length);

