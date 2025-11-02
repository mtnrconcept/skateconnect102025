import type { Section } from '../../types';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from '../../lib/router';
import { fetchMarketplaceListings, MARKETPLACE_CATEGORIES, type MarketplaceListing } from '../../lib/marketplace';

interface MarketplaceLandingProps {
  onNavigateToContent: (section: Section) => void;
}

export default function MarketplaceLanding({ onNavigateToContent }: MarketplaceLandingProps) {
  const { navigate } = useRouter();
  const [featured, setFeatured] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const items = await fetchMarketplaceListings();
        setFeatured(items.slice(0, 6));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-[url('/login-background.svg')] bg-cover bg-center">
        <div className="backdrop-brightness-[.65]">
          <div className="px-6 py-12 md:px-10 md:py-16">
            <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">Shredloc Marketplace</h1>
            <p className="mt-3 max-w-2xl text-slate-200">Achète, vends et découvre le meilleur du skate, entre riders.</p>
            <div className="mt-6 grid gap-3 md:grid-cols-[1fr_260px_auto]">
              <input id="mp-quick-q" placeholder="Planche, trucks, hoodie…" className="w-full rounded-xl border border-slate-700 bg-[#11131a]/90 px-4 py-3 text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500" />
              <input id="mp-quick-city" placeholder="Ville / Pays" className="w-full rounded-xl border border-slate-700 bg-[#11131a]/90 px-4 py-3 text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500" />
              <button type="button" onClick={() => {
                const q = (document.getElementById('mp-quick-q') as HTMLInputElement | null)?.value ?? '';
                const loc = (document.getElementById('mp-quick-city') as HTMLInputElement | null)?.value ?? '';
                const params = new URLSearchParams();
                if (q.trim()) params.set('q', q.trim());
                if (loc.trim()) params.set('loc', loc.trim());
                navigate(params.toString() ? `/marketplace/browse?${params}` : '/marketplace/browse');
              }} className="rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white hover:bg-orange-600">Explorer</button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {MARKETPLACE_CATEGORIES.slice(0,6).map((c)=> (
                <button key={c.id} type="button" onClick={()=> navigate(`/marketplace/browse?category=${c.id}`)} className="rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-1 text-xs text-orange-200 hover:bg-orange-500/20">{c.label}</button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Quick access cards */}
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <button
          type="button"
          onClick={() => navigate('/marketplace/browse')}
          className="group overflow-hidden rounded-2xl border border-slate-800 bg-[#14151a] text-left transition hover:border-orange-500/50 hover:shadow-[0_0_0_3px_rgba(249,115,22,0.15)]"
        >
          <div className="aspect-[4/3] bg-[url('/login-background.svg')] bg-cover bg-center opacity-80 group-hover:opacity-100 transition"></div>
          <div className="p-5">
            <h2 className="text-xl font-semibold text-white">Marketplace</h2>
            <p className="mt-1 text-sm text-slate-400">Achète et vends du matos de skate entre riders.</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateToContent('shop')}
          className="group overflow-hidden rounded-2xl border border-slate-800 bg-[#14151a] text-left transition hover:border-orange-500/50 hover:shadow-[0_0_0_3px_rgba(249,115,22,0.15)]"
        >
          <div className="aspect-[4/3] bg-black/40"></div>
          <div className="p-5">
            <h2 className="text-xl font-semibold text-white">Boutique</h2>
            <p className="mt-1 text-sm text-slate-400">Découvre les boutiques partenaires et leurs produits.</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateToContent('rewards')}
          className="group overflow-hidden rounded-2xl border border-slate-800 bg-[#14151a] text-left transition hover:border-orange-500/50 hover:shadow-[0_0_0_3px_rgba(249,115,22,0.15)]"
        >
          <div className="aspect-[4/3] bg-black/30"></div>
          <div className="p-5">
            <h2 className="text-xl font-semibold text-white">Shredstore</h2>
            <p className="mt-1 text-sm text-slate-400">Accède à la boutique Shredloc et aux récompenses.</p>
          </div>
        </button>
      </div>

      {/* Featured listings */}
      <section className="mt-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold text-white">Annonces vedettes</h2>
          <button type="button" onClick={() => navigate('/marketplace/browse')} className="text-sm text-orange-300 hover:text-orange-200">Tout voir</button>
        </div>
        {loading ? (
          <div className="text-sm text-slate-400">Chargement…</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((l) => (
              <button key={l.id} type="button" onClick={() => navigate(`/marketplace/listing/${l.id}`)} className="overflow-hidden rounded-xl bg-white text-slate-900 shadow-md ring-1 ring-black/5 text-left">
                <div className="relative aspect-[4/3] bg-black/20">
                  {l.image_url ? <img src={l.image_url} alt={l.title} className="h-full w-full object-cover"/> : null}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold line-clamp-1">{l.title}</h3>
                  <div className="mt-1 text-base font-semibold">{(l.price_cents/100).toLocaleString('fr-FR', { style:'currency', currency: l.currency })}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Verified shops */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-white mb-3">Shops vérifiés</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map((i)=> (
            <button key={i} type="button" onClick={() => onNavigateToContent('shop')} className="rounded-xl border border-slate-800 bg-[#14151a] p-5 text-left hover:border-orange-500/50">
              <div className="h-28 rounded-lg bg-black/30 mb-3"></div>
              <div className="text-white font-medium">Boutique partenaire #{i}</div>
              <div className="text-sm text-slate-400">Sélection approuvée par Shredloc</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}


