#!/usr/bin/env node
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
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const NOMINATIM_BASE_URL = process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org';
const OSM_USER_AGENT = process.env.OSM_USER_AGENT || process.env.NOMINATIM_USER_AGENT || 'SkateConnectImporter/1.0 (+https://skateconnect.local; contact: dev@skateconnect.local)';

if (!SUPABASE_URL || !(SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY)) {
  console.error('Missing Supabase credentials.');
  process.exit(1);
}
// OSM/Nominatim: require a meaningful User-Agent per usage policy
if (!OSM_USER_AGENT || OSM_USER_AGENT.includes('skateconnect.local')) {
  console.warn('Warning: Using a generic OSM User-Agent. Set OSM_USER_AGENT to comply with Nominatim usage policy.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);
const DRY_RUN = process.argv.includes('--dry-run');

const normalize = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function mapSurfaces(s) {
  const raw = s.split(/[,/]| et /i).map(x => x.trim()).filter(Boolean);
  const out = new Set();
  for (const token of raw) {
    const n = normalize(token);
    if (n.includes('béton') || n.includes('beton')) out.add('concrete');
    else if (n.includes('asphalte') || n.includes('asphalt')) out.add('asphalt');
    else if (n.includes('bois')) out.add('wood');
    else if (n.includes('métal') || n.includes('metal')) out.add('metal');
  }
  return Array.from(out);
}
function mapModules(s) {
  const raw = s.split(/[,/]/).map(x => x.trim()).filter(Boolean);
  const out = new Set();
  for (const token of raw) {
    const n = normalize(token);
    if (n.includes('bowl')) out.add('bowl');
    else if (n.includes('funbox')) out.add('funbox');
    else if (n === 'rail' || n.includes('rails')) out.add('rails');
    else if (n.includes('stairs')) out.add('stairs');
    else if (n.includes('ledge')) out.add('ledges');
    else if (n.includes('hubba')) out.add('ledges');
    else if (n.includes('bank')) out.add('bank');
    else if (n.includes('quarter')) out.add('quarter');
    else if (n.includes('manual pad')) out.add('manual pad');
    else if (n.includes('spine')) out.add('spine');
    else if (n.includes('curb')) out.add('curbs');
    else if (n.includes('pumptrack')) out.add('pumptrack');
    else if (n.includes('gap')) out.add('gaps');
    else if (n.includes('wallride')) out.add('transitions');
    else if (n.includes('halfpipe')) out.add('halfpipe');
    else if (n.includes('mini-rampe') || n.includes('minirampe')) out.add('mini-rampe');
    else if (n.includes('plaza')) out.add('plaza');
    else if (n.includes('diy')) out.add('diy');
    else if (n) out.add(token.trim());
  }
  return Array.from(out);
}
function inferSpotType(name, modules) {
  const n = normalize(name);
  const hasDiy = n.includes('diy') || modules.includes('diy');
  if (hasDiy) return 'diy';
  return 'skatepark';
}
async function geocode(address) {
  const url = new URL(NOMINATIM_BASE_URL.replace(/\/$/, '') + '/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('q', address + ', Suisse');
  url.searchParams.set('countrycodes', 'ch');
  url.searchParams.set('limit', '1');
  const res = await fetch(url.toString(), { headers: { 'User-Agent': OSM_USER_AGENT, 'Accept-Language': 'fr' } });
  if (!res.ok) throw new Error('Nominatim geocoding failed: ' + res.status);
  const data = await res.json();
  const item = Array.isArray(data) ? data[0] : null;
  if (!item || !item.lat || !item.lon) throw new Error('No geocoding result');
  const lat = parseFloat(item.lat);
  const lon = parseFloat(item.lon);
  return { lat, lon, place_name: item.display_name || address };
}
async function findExistingByNameAddress(name, address) {
  const { data, error } = await supabase.from('spots').select('id, name, address').ilike('name', name).ilike('address', '%' + address.split(',')[0] + '%').limit(1).maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}
async function upsertSpot(payload) {
  const existing = await findExistingByNameAddress(payload.name, payload.address);
  if (existing) return { updated: false, skipped: true, id: existing.id };
  if (DRY_RUN) return { updated: false, skipped: false, id: null };
  const { data, error } = await supabase.from('spots').insert(payload).select('id').single();
  if (error) throw error;
  return { updated: true, skipped: false, id: data.id };
}
const DATA = `
Genève|Skatepark de Plainpalais|Extérieur|Béton|Bowl, funbox, rails, stairs, ledges|Avenue du Mail 1, 1205 Genève
Genève|Skatepark de la Praille|Extérieur (sous pont)|Béton / Bois|Mini-rampe, hubba, manual pad, rail|Route des Jeunes 8, 1227 Carouge
Genève|Skatepark de Lancy|Extérieur|Béton|Banks, rails, quarterpipe, funbox|Chemin des Pontets 21, 1212 Lancy
Genève|Pumptrack du Parc des Franchises|Extérieur|Asphalte|Pumptrack, mini-rampe|Parc des Franchises, Avenue de Châtelaine, 1203 Genève
Genève|Skatepark de Cherpines|Extérieur|Béton|Bowl, rail, quarter|Route de Colovrex 20, 1218 Le Grand-Saconnex

Vaud|Skatepark de Vidy (Lausanne)|Extérieur|Béton|Bowl, ledges, rails|Chemin du Parc 3, 1007 Lausanne
Vaud|Spot d’Ouchy|Extérieur|Béton / Métal|Modules DIY street|Quai d’Ouchy 1, 1006 Lausanne
Vaud|Skatepark de Pully|Extérieur|Béton|Bowl, banks, rails|Chemin du Pré-de-la-Tour 10, 1009 Pully
Vaud|Skatepark de Morges “Purple Park”|Extérieur|Béton|Bowl, funbox, quarter|Route de Lausanne 16, 1110 Morges
Vaud|Skatepark d’Yverdon-les-Bains|Extérieur|Béton|Street park, rails, banks|Rue des Casernes 2, 1400 Yverdon-les-Bains
Vaud|La Fièvre Indoor (Prilly)|Intérieur|Bois|Mini-rampe, spine, module street|Chemin du Viaduc 12, 1008 Prilly

Valais|Skatepark de Sion|Extérieur|Béton|Bowl, rail, stairs|Rue des Champs-de-tabac 1, 1950 Sion
Valais|Skatepark de Monthey|Extérieur|Béton|Bowl, banks, rail|Route des Ilettes 53, 1870 Monthey
Valais|Skatepark de Fully|Extérieur|Béton|Banks, ledges, rail|Route de Saillon 2, 1926 Fully
Valais|Skatepark de Vernayaz|Extérieur|Béton|Bowl, quarter, gap|Route du Simplon 18, 1904 Vernayaz
Valais|Pumptrack Crans-Montana|Extérieur|Asphalte|Pumptrack|Centre de la Moubra, 3963 Crans-Montana
Valais|Pumptrack Nendaz|Extérieur|Asphalte|Pumptrack|Route de la Télécabine 83, 1997 Haute-Nendaz
Valais|Skatepark du Châble (Bagnes)|Extérieur|Béton|Bowl, spine, ledges|Rte de Mauvoisin, 1934 Le Châble

Zurich|Freestyle Park Allmend Zürich|Extérieur|Béton|Bowl, rails, banks|Allmendstrasse 20, 8041 Zürich
Zurich|Ghetto Park Zürich|Extérieur (urbain)|Béton|Ledges, rails, DIY modules|Geroldstrasse 3, 8005 Zürich
Zurich|Kornhausbrücke “Korny” DIY|Extérieur|Béton|Bowl, quarters, wallrides|Unter der Kornhausbrücke, 8005 Zürich
Zurich|Heerenschürli Skatepark|Extérieur|Béton|Bowl, rails, funbox|Helen-Keller-Strasse 20, 8051 Zürich
Zurich|Skills Park Winterthur|Intérieur|Bois / Béton|Bowl, mini-rampe, street course|Katharina-Sulzer-Platz 6, 8400 Winterthur
Zurich|Wädenswil Skatepark|Extérieur|Béton|Bowl, rails, curbs|Seestrasse 90, 8820 Wädenswil

Berne|Weyerli Skatepark (Bern)|Extérieur|Métal / Béton|Quarterpipe, rail, manual pad|Weyermannshaus, 3027 Bern
Berne|Pumptrack Kleine Allmend (Bern)|Extérieur|Asphalte|Pumptrack|Papiermühlestrasse 91, 3014 Bern
Berne|Skatepark de Thun|Extérieur|Béton|Bowl, stairs, funbox|Allmendstrasse 2, 3600 Thun
Berne|Skatepark de Bienne “Loud Minority”|Intérieur|Bois|Halfpipe, rails, modules street|Rue de la Poste 85, 2504 Bienne
Berne|Reitschule DIY (Bern)|Extérieur|Béton|Modules DIY, bowl|Neubrückstrasse 8, 3012 Bern

Bâle|O-Pumpwerk Basel|Intérieur / Extérieur|Bois (intérieur), Béton (extérieur)|Spine, bowl, handrails|Uferstrasse 80, 4057 Basel
Bâle|Port Land DIY|Extérieur|Béton|Ledges, quarterpipes|Uferstrasse 40, 4057 Basel
Bâle|Kannenfeldpark Skatepark|Extérieur|Béton|Bowl, rails, pyramid|Kannenfeldpark, 4055 Basel
Bâle|Allschwil Skatepark|Extérieur|Métal / Bois|Halfpipe, funbox, ledge|Hegenheimermattweg 76, 4123 Allschwil

Tessin|Lugano Cornaredo Skatepark|Extérieur|Béton|Plaza, bowl, handrail, spine|Via Trevano 103, 6900 Lugano
Tessin|Biasca Skatepark|Extérieur|Béton|Bowl, ledges, quarter|Via Ginnasio 5, 6710 Biasca
Tessin|Locarno Skatepark|Extérieur|Métal|Quarter, rail, funbox|Via alla Morettina 2, 6600 Locarno
Tessin|Capriasca Pumptrack|Extérieur|Asphalte|Pumptrack|Centro Sportivo, 6950 Tesserete
Tessin|Caslano Pumptrack|Extérieur|Asphalte|Pumptrack|Via Pradon, 6987 Caslano

Fribourg|Skatepark de Fribourg “Sumo”|Extérieur|Béton|Bowl, street|Chemin de la Piscine 4, 1700 Fribourg
Fribourg|Pumptrack de Bulle|Extérieur|Asphalte|Pumptrack|Chemin des Crêts 20, 1630 Bulle
Fribourg|Skatepark de Châtel-St-Denis|Extérieur|Béton|Bowl, rails|Rte de l’Ancienne Gare 15, 1618 Châtel-St-Denis
Fribourg|Skatepark de Morat|Extérieur|Béton|Modules mobiles|Viehmarktplatz, 3280 Morat

Neuchâtel & Jura|Park’N’Sun (La Chaux-de-Fonds)|Intérieur|Bois|Bowl, rails, funbox|Rue des Crêtets 148, 2300 La Chaux-de-Fonds
Neuchâtel & Jura|Skatepark de Neuchâtel|Extérieur|Béton|Bowl, rails, pyramid|Quai Ostervald 2, 2000 Neuchâtel
Neuchâtel & Jura|Mini-rampe de Porrentruy|Extérieur|Bois|Mini-rampe|Rue des Malvoisins 3, 2900 Porrentruy

Luzerne / Schwyz / Zug|Skatepark de Luzern “Wartegg”|Extérieur|Béton|Bowl, rails|Warteggstrasse 37, 6005 Luzern
Luzerne / Schwyz / Zug|Freestyle Halle Lucerne|Intérieur|Bois|Modules street, mini-rampe|Allmendstrasse 10, 6048 Horw
Luzerne / Schwyz / Zug|Skatepark de Küssnacht am Rigi|Extérieur|Béton|Bowl, banks|Kaltbachstrasse, 6403 Küssnacht am Rigi
Luzerne / Schwyz / Zug|Skatepark de Zoug|Extérieur|Béton|Bowl, rails, banks|Allmendstrasse 14, 6300 Zug
Luzerne / Schwyz / Zug|Skatepark d’Emmetschloo|Extérieur|Béton|Bowl, banks, funbox|Galgenried 1, 6060 Sarnen

Saint-Gall & Thurgovie|St. Gallen Skatepark (Rollpark)|Extérieur / Intérieur|Béton / Bois|Bowl, street course|Breitfeldstrasse 21, 9015 St. Gallen
Saint-Gall & Thurgovie|Weinfelden Skatepark|Extérieur|Béton|Bowl, rails|Ladhuebstrasse 10, 8570 Weinfelden
Saint-Gall & Thurgovie|Frauenfeld Skatepark|Extérieur|Béton|Bowl, stairs, rails|Industriestrasse 15, 8500 Frauenfeld
Saint-Gall & Thurgovie|Steckborn Skatepark|Extérieur|Béton|Bowl, curbs|Seestrasse 189, 8266 Steckborn
Saint-Gall & Thurgovie|Wattwil Skatepark|Extérieur|Béton|Bowl, rail, funbox|Industriestrasse 8, 9630 Wattwil
`;
function parseData(text) { const rows = []; for (const line of text.split(/\r?\n/)) { const trimmed = line.trim(); if (!trimmed) continue; const parts = trimmed.split('|'); if (parts.length < 6) continue; const canton = parts[0], name = parts[1], indoor = parts[2], surfaces = parts[3], modules = parts[4], address = parts[5]; rows.push({ canton, name, indoor, surfaces, modules, address }); } return rows; }
async function main() { const rows = parseData(DATA); let ok = 0, skip = 0, fail = 0; for (const row of rows) { try { const modules = mapModules(row.modules); const surfaces = mapSurfaces(row.surfaces); const spot_type = inferSpotType(row.name, modules); const geo = await geocode(row.address); const description = 'Canton: ' + row.canton + '. ' + (row.indoor ? ('Type: ' + row.indoor + '. ') : '') + 'Modules: ' + row.modules + '. Surfaces: ' + row.surfaces + '.'; const payload = { created_by: null, name: row.name, description: description, address: geo.place_name || row.address, latitude: geo.lat, longitude: geo.lon, spot_type: spot_type, difficulty: 3, surfaces: surfaces, modules: modules }; const res = await upsertSpot(payload); if (res.skipped) { skip++; console.log('SKIP: ' + row.name); } else if (res.updated) { ok++; console.log('ADDED: ' + row.name); } else { ok++; console.log('OK (dry): ' + row.name); } await new Promise(r => setTimeout(r, 1200)); } catch (e) { fail++; console.error('FAIL: ' + row.name + ' — ' + e.message); } } console.log('\nDone. Added: ' + ok + ', Skipped: ' + skip + ', Failed: ' + fail + (DRY_RUN ? ' (dry-run)' : '')); }
main().catch((e) => { console.error(e); process.exit(1); });

