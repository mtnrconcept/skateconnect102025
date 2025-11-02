import express from "express";
import cors from "cors";
import { upsertRating, listRatings, getStats } from "./ratings.js";
import { createSpot, listSpots } from "./spots.js";
import { addMedia, listMedia, setCover } from "./media.js";

const app = express();
app.use(cors());
app.use(express.json());

// Santé
app.get("/health", (_, res) => res.json({ ok: true }));

// Upsert d'une note
app.post("/api/spot_ratings/upsert", async (req, res) => {
  try {
    await upsertRating(req.body);
    res.status(200).json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Récup notes
app.get("/api/spot_ratings", async (req, res) => {
  const spot_id = String(req.query.spot_id || "");
  if (!spot_id) return res.status(400).json({ error: "spot_id required" });
  try {
    const items = await listRatings(spot_id);
    const stats = await getStats(spot_id);
    res.json({ items, stats });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Créer un spot
app.post("/api/spots", async (req, res) => {
  try {
    const row = await createSpot(req.body);
    res.status(201).json(row);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Lister les spots (search/limit/offset facultatifs)
app.get("/api/spots", async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const offset = req.query.offset ? Number(req.query.offset) : undefined;
  try {
    const { items, total } = await listSpots({ search, limit, offset });
    res.json({ items, total });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Ajouter un média à un spot
app.post("/api/spot_media", async (req, res) => {
  try {
    const row = await addMedia(req.body);
    res.status(201).json(row);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Lister médias d'un spot
app.get("/api/spot_media", async (req, res) => {
  const spot_id = String(req.query.spot_id || "");
  if (!spot_id) return res.status(400).json({ error: 'spot_id required' });
  try {
    const items = await listMedia(spot_id);
    res.json({ items });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Définir la cover d'un spot
app.post("/api/spots/:id/cover", async (req, res) => {
  const spot_id = req.params.id;
  const media_id = String((req.body && req.body.media_id) || "");
  if (!media_id) return res.status(400).json({ error: 'media_id required' });
  try {
    await setCover(spot_id, media_id);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.listen(8787, () => console.log("✅ Local API http://localhost:8787"));
