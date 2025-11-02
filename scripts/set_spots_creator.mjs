#!/usr/bin/env node
// Set the same creator profile for all spots and ensure spot_media.user_id is set accordingly
// Usage: node scripts/set_spots_creator.mjs [--profile=<uuid>]

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

function arg(name, def=null){ const a = process.argv.find(x=>x.startsWith(`--${name}=`)); return a? a.split('=')[1]: def; }

async function main(){
  let profileId = arg('profile', null);
  if (!profileId){
    const { data, error } = await supabase.from('profiles').select('id').limit(1).maybeSingle();
    if (error || !data?.id){
      console.error('Unable to find a profile to use as creator.', error?.message);
      process.exit(1);
    }
    profileId = data.id;
  }

  console.log('Using creator profile:', profileId);

  // Update all spots
  {
    const { data, error } = await supabase.from('spots').update({ created_by: profileId }).neq('created_by', profileId).select('id');
    if (error){ console.error('Failed to update spots.created_by:', error.message); process.exit(1); }
    console.log('Spots updated:', data?.length ?? 0);
  }

  // Ensure media user_id is set to creator for nulls
  {
    const { data: media, error: errSel } = await supabase.from('spot_media').select('id, user_id').is('user_id', null);
    if (errSel){ console.error('Failed to fetch spot_media with null user_id:', errSel.message); process.exit(1); }
    let updated = 0;
    const BATCH = 1000;
    for (let i=0; i< (media?.length||0); i+=BATCH){
      const slice = media.slice(i, i+BATCH).map(m => m.id);
      const { error: errUpd } = await supabase.from('spot_media').update({ user_id: profileId }).in('id', slice);
      if (errUpd){ console.error('Failed to update spot_media.user_id:', errUpd.message); process.exit(1); }
      updated += slice.length;
    }
    console.log('spot_media user_id set:', updated);
  }
}

main().catch(e=>{ console.error(e); process.exit(1); });
