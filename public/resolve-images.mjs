/**
 * goSkate Image Resolver
 * ----------------------
 * Enrichit un CSV de skateparks (nom, adresse, coords, detailHref)
 * avec l'URL d'image trouvée dans les métadonnées OG/Twitter/JSON-LD.
 */

import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { JSDOM } from "jsdom";

const INPUT = "./goskate_usa_with_img_1761952932581.csv";
const OUTPUT = "./goskate_usa_with_img_resolved.csv";
const BASE = "https://goskate.com";
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const rows = parse(fs.readFileSync(INPUT, "utf8"), {
  columns: true,
  skip_empty_lines: true,
});

const reImage = /(https:\/\/goskate\.com\/sp\/wp-content\/uploads\/[^"' ]+\.(?:jpg|jpeg|png|webp))/i;

async function extractImage(url) {
  try {
    const res = await fetch(url);
    const html = await res.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // 1. meta OG
    let img = doc.querySelector('meta[property="og:image"]')?.content;
    if (img) return img;

    // 2. Twitter
    img = doc.querySelector('meta[name="twitter:image"]')?.content;
    if (img) return img;

    // 3. JSON-LD
    const scripts = [...doc.querySelectorAll("script[type='application/ld+json']")];
    for (const s of scripts) {
      try {
        const data = JSON.parse(s.textContent);
        const traverse = (obj) => {
          if (!obj || typeof obj !== "object") return null;
          if (typeof obj.url === "string" && reImage.test(obj.url)) return obj.url;
          for (const v of Object.values(obj)) {
            const found = traverse(v);
            if (found) return found;
          }
          return null;
        };
        const found = traverse(data);
        if (found) return found;
      } catch {}
    }

    // 4. regex de secours
    const m = html.match(reImage);
    if (m) return m[1];

    return null;
  } catch (e) {
    console.warn("❌", url, e.message);
    return null;
  }
}

async function main() {
  const out = [];
  let i = 0;
  for (const r of rows) {
    i++;
    const detail = r.detailHref || r.url || "";
    if (!detail || r.image_url) {
      out.push(r);
      continue;
    }
    console.log(`🔍 ${i}/${rows.length} — ${r.name}`);
    const fullUrl = detail.startsWith("http") ? detail : BASE + detail;
    const img = await extractImage(fullUrl);
    r.image_url = img || "";
    out.push(r);
    await delay(500); // politeness delay
  }

  const csv = stringify(out, { header: true });
  fs.writeFileSync(OUTPUT, csv, "utf8");
  console.log(`✅ Fini ! Fichier exporté : ${OUTPUT}`);
}

main();
