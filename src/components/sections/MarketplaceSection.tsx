import { useEffect, useMemo, useState } from 'react';
import { Plus, MapPin, Euro, Image as ImageIcon, Heart, SlidersHorizontal, User as UserIcon } from 'lucide-react';
import type { Profile } from '../../types';
import {
  createMarketplaceListing,
  fetchMarketplaceListings,
  type MarketplaceListing,
  MARKETPLACE_CATEGORIES,
  toggleFavorite,
  getFavorites,
  type MarketplaceCategory,
} from '../../lib/marketplace';
import { useRouter } from '../../lib/router';
import { MARKETPLACE_SUBCATEGORIES } from '../../data/marketplaceSubcategories';
import { MARKETPLACE_BRANDS } from '../../data/marketplaceBrands';


interface MarketplaceSectionProps {
  profile: Profile | null;
}

export default function MarketplaceSection({ profile }: MarketplaceSectionProps) {
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [category, setCategory] = useState<'all' | MarketplaceCategory>('all');
  const [brand, setBrand] = useState<string | null>(null);
  const [subCategory, setSubCategory] = useState<string | null>(null);
  const [openCat, setOpenCat] = useState<MarketplaceCategory | null>(null);
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [condition, setCondition] = useState<'all' | 'new' | 'like-new' | 'used' | 'for-parts'>('all');
  const [shipping, setShipping] = useState<'all' | 'yes' | 'no'>('all');
  const [sort, setSort] = useState<'date' | 'price-asc' | 'price-desc'>('date');
  const [view, setView] = useState<'all' | 'mine' | 'fav'>('all');
  const { navigate } = useRouter();
  const [isPosting, setIsPosting] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', price: '', city: '', country: '', imageUrl: '' });

  useEffect(() => {
    void loadListings();
    try { setFavorites(getFavorites()); } catch {}
    // read URL params (q, category, loc)
    try {
      const url = new URL(window.location.href);
      const q = url.searchParams.get('q') ?? url.searchParams.get('query');
      const cat = url.searchParams.get('category');
      if (q) setSearch(q);
      if (cat && (['all', ...MARKETPLACE_CATEGORIES.map((c)=>c.id)] as any).includes(cat)) setCategory(cat as any);
    } catch {}
  }, []);

  const loadListings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchMarketplaceListings();
      setListings(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de charger les annonces';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let items = listings;
    if (view === 'mine' && profile?.id) items = items.filter((l) => l.user_id === profile.id);
    if (view === 'fav') items = items.filter((l) => favorites.includes(l.id));
    if (category !== 'all') items = items.filter((l) => l.category === category);
    if (country.trim()) items = items.filter((l) => (l.country ?? '').toLowerCase().includes(country.trim().toLowerCase()));
    if (subCategory) items = items.filter((l) => String((l as any).attributes?.subcategory ?? '').toLowerCase() === subCategory.toLowerCase());
    if (brand) items = items.filter((l) => String((l as any).attributes?.brand ?? '').toLowerCase() === brand.toLowerCase());
    if (city.trim()) items = items.filter((l) => (l.city ?? '').toLowerCase().includes(city.trim().toLowerCase()));
    const min = Number.parseFloat(priceMin.replace(',', '.'));
    const max = Number.parseFloat(priceMax.replace(',', '.'));
    items = items.filter((l) => {
      const price = l.price_cents / 100;
      const okMin = Number.isFinite(min) ? price >= min : true;
      const okMax = Number.isFinite(max) ? price <= max : true;
      return okMin && okMax;
    });
    if (condition !== 'all') items = items.filter((l) => l.condition === condition);
    if (shipping !== 'all') items = items.filter((l) => l.shipping_available === (shipping === 'yes'));
    if (q) items = items.filter((l) => [l.title, l.description, l.city ?? '', l.country ?? ''].join(' ').toLowerCase().includes(q));
    switch (sort) {
      case 'price-asc':
        items = [...items].sort((a, b) => a.price_cents - b.price_cents);
        break;
      case 'price-desc':
        items = [...items].sort((a, b) => b.price_cents - a.price_cents);
        break;
      default:
        items = [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return items;
  }, [listings, search, view, favorites, category, subCategory, brand, country, city, priceMin, priceMax, condition, shipping, sort, profile?.id]);

  const handlePost = async () => {
    if (!profile) {
      alert('Connecte-toi pour poster une annonce.');
      return;
    }
    const title = form.title.trim();
    const price = Number.parseFloat(form.price.replace(',', '.'));
    if (!title || !Number.isFinite(price) || price <= 0) {
      alert('Titre et prix valides requis.');
      return;
    }
    setIsPosting(true);
    try {
      const listing = await createMarketplaceListing({
        user_id: profile.id,
        title,
        description: form.description.trim(),
        price_cents: Math.round(price * 100),
        currency: 'EUR',
        category: category === 'all' ? 'other' : category,
        condition: condition === 'all' ? 'used' : condition,
        shipping_available: shipping === 'all' ? false : shipping === 'yes',
        city: form.city.trim() || null,
        country: form.country.trim() || null,
        image_url: form.imageUrl.trim() || null,
      });
      setListings((prev) => [listing, ...prev]);
      setForm({ title: '', description: '', price: '', city: '', country: '', imageUrl: '' });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Impossible de publier l'annonce";
      alert(message);
    } finally {
      setIsPosting(false);
    }
  };

  const toggleFav = (id: string) => {
    const next = toggleFavorite(id);
    setFavorites(next);
  };

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-8">
      <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-6">Marketplace</h1>
      <div className="mb-8 flex items-center justify-between text-sm text-slate-300">
        <div className="flex items-center gap-6">
          <button type="button" onClick={() => setCategory('all')} className="hover:text-white">Catégories</button>
          <button type="button" onClick={() => navigate('/marketplace/new')} className="hover:text-white">Déposer une annonce</button>
          <button type="button" onClick={() => (document.getElementById('marketplace-search') as HTMLInputElement | null)?.focus()} className="hover:text-white">Recherche</button>
        </div>
        <div className="flex items-center justify-center">
      
        </div>
        <div className="flex items-center gap-6">
          <button type="button" onClick={() => navigate(`/marketplace/account`)} className="hover:text-white">Mon compte</button>
        </div>
      </div>

      {(category !== 'all' || subCategory || brand) && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          {category !== 'all' && (
            <button
              type="button"
              onClick={() => { setCategory('all'); setOpenCat(null); setSubCategory(null); setBrand(null); }}
              className="inline-flex items-center gap-1 rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-1 text-orange-200 hover:border-orange-500"
            >Catégorie: {MARKETPLACE_CATEGORIES.find(c=>c.id===category)?.label ?? category} ×</button>
          )}
          {subCategory && (
            <button
              type="button"
              onClick={() => setSubCategory(null)}
              className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-slate-200 hover:border-orange-500"
            >Sous-catégorie: {subCategory} ×</button>
          )}
          {brand && (
            <button
              type="button"
              onClick={() => setBrand(null)}
              className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-slate-200 hover:border-orange-500"
            >Marque: {brand} ×</button>
          )}
        </div>
      )}

      <div className="mx-auto mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <input
            id="marketplace-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Que recherchez-vous?"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
        <button type="button" onClick={() => setFiltersOpen((v)=>!v)} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-200 hover:border-orange-500"><SlidersHorizontal size={16}/> Filtres</button>
      </div>

      {filtersOpen && (
        <div className="mb-4 grid gap-3 rounded-2xl border border-slate-700 bg-slate-900/70 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm text-slate-300">
            Catégorie
            <select value={category} onChange={(e) => setCategory(e.target.value as any)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500">
              <option value="all">Toutes</option>
              {MARKETPLACE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-300">
            Pays
            <input value={country} onChange={(e) => setCountry(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500" />
          </label>
          <label className="text-sm text-slate-300">
            Ville
            <input value={city} onChange={(e) => setCity(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm text-slate-300">
              Prix min
              <input value={priceMin} onChange={(e) => setPriceMin(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500" />
            </label>
            <label className="text-sm text-slate-300">
              Prix max
              <input value={priceMax} onChange={(e) => setPriceMax(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500" />
            </label>
          </div>
          <label className="text-sm text-slate-300">
            État
            <select value={condition} onChange={(e) => setCondition(e.target.value as any)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500">
              <option value="all">Tous</option>
              <option value="new">Neuf</option>
              <option value="like-new">Comme neuf</option>
              <option value="used">Bon état</option>
              <option value="for-parts">Pour pièces</option>
            </select>
          </label>
          <label className="text-sm text-slate-300">
            Livraison
            <select value={shipping} onChange={(e) => setShipping(e.target.value as any)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500">
              <option value="all">Peu importe</option>
              <option value="yes">Possible</option>
              <option value="no">Retrait uniquement</option>
            </select>
          </label>
          <label className="text-sm text-slate-300">
            Tri
            <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500">
              <option value="date">Plus récentes</option>
              <option value="price-asc">Prix croissant</option>
              <option value="price-desc">Prix décroissant</option>
            </select>
          </label>
          <div className="flex items-end">
            <button type="button" onClick={() => { setCategory('all'); setCountry(''); setCity(''); setPriceMin(''); setPriceMax(''); setCondition('all'); setShipping('all'); setSort('date'); }} className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 hover:border-orange-500">Réinitialiser</button>
          </div>
        </div>
      )}

      {/* Posting form removed from main marketplace page as per request */}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <aside className="relative rounded-2xl border border-slate-800 bg-[#171819] p-5 lg:col-span-3 xl:col-span-3" onMouseLeave={() => setOpenCat(null)}>
          <h3 className="text-lg font-semibold text-white">Catégories</h3>
          <nav className="mt-3 grid gap-2 text-sm">
            {MARKETPLACE_CATEGORIES.map((c)=> (
              <div key={c.id} className="relative">
                <button
                  type="button"
                  onClick={()=>{ setCategory(c.id); setOpenCat(c.id); setSubCategory(null); }}
                  onMouseEnter={() => { setOpenCat(c.id); }}
                  className={`w-full rounded-lg px-3 py-2 text-left ${category===c.id? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800/60"}`}
                >{c.label}</button>
                {openCat===c.id && ((MARKETPLACE_SUBCATEGORIES[c.id] ?? []).length > 0 || (MARKETPLACE_BRANDS[c.id] ?? []).length > 0) && (
                  <div className="pointer-events-auto absolute left-full top-2 ml-3 w-80 origin-top-left rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl backdrop-blur transition-all duration-200 ease-out z-20">
                    {(MARKETPLACE_SUBCATEGORIES[c.id] ?? []).length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Sous-catégories</p>
                        <div className="grid grid-cols-2 gap-2">
                          {(MARKETPLACE_SUBCATEGORIES[c.id] ?? []).map((s)=> (
                            <button
                              key={s}
                              type="button"
                              onClick={()=> { setSubCategory(s); setOpenCat(null); }}
                              className={`rounded-md px-2 py-1 text-left text-xs ${subCategory===s? 'bg-slate-800 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'}`}
                            >{s}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {(MARKETPLACE_BRANDS[c.id] ?? []).length > 0 && (
                      <div className="mt-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Marques</p>
                        <div className="flex flex-wrap gap-2">
                          {(MARKETPLACE_BRANDS[c.id] ?? []).map((b)=> (
                            <button
                              key={b}
                              type="button"
                              onClick={()=> { setBrand(b); setOpenCat(null); }}
                              className={`rounded-full border px-2.5 py-0.5 text-[11px] ${brand===b? 'border-orange-500 bg-orange-500/10 text-orange-200' : 'border-slate-700 bg-slate-800 text-slate-200 hover:border-orange-500'}`}
                            >{b}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <button type="button" onClick={()=>setCategory("all")} className={`w-full rounded-lg px-3 py-2 text-left ${category==="all"? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800/60"}`}>Toutes</button>
          </nav>
        </aside>
        <section className="lg:col-span-7 xl:col-span-7">
          {loading ? (
            <div className="text-sm text-slate-400">Chargement...</div>
          ) : error ? (
            <div className="text-sm text-orange-300">{error}</div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filtered.map((l) => (
                <div
                  key={l.id}
                  onClick={() => navigate(`/marketplace/listing/${l.id}`)}
                  className="group overflow-hidden rounded-xl bg-white text-slate-900 shadow-md ring-1 ring-black/5 cursor-pointer hover:shadow-lg"
                >
                  <div className="relative aspect-[4/3] bg-black/20">
                    {l.image_url ? (
                      <img src={l.image_url} alt={l.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-600">
                        <ImageIcon size={36} />
                      </div>
                    )}
                    <div className="absolute left-2 top-2 rounded-md bg-white/95 px-2 py-0.5 text-xs font-semibold text-slate-900 shadow">
                      {(l.price_cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: l.currency })}
                    </div>
                    <button type="button" onClick={() => toggleFav(l.id)} className="absolute right-2 top-2 rounded-full bg-black/40 p-1.5 text-white hover:bg-black/60">
                      <Heart size={16} className={favorites.includes(l.id) ? "fill-orange-500 text-orange-500" : ""} />
                    </button>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold line-clamp-1 group-hover:text-slate-800">{l.title}</h3>
                    <div className="mt-1">
                      <span className="text-base font-semibold">{(l.price_cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: l.currency })}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{[l.city, l.country].filter(Boolean).join(', ') || 'Localisation'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <aside className="hidden lg:block lg:col-span-2 xl:col-span-2">
          <div className="rounded-2xl border border-slate-800 bg-[#171819]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">Événements à venir</h3>
              <span className="text-[10px] rounded-full border border-orange-500/40 bg-orange-500/10 px-1.5 py-0.5 text-orange-200">Info</span>
            </div>
            <div className="p-3 grid gap-3">
              {[1,2,3].map((i)=> (
                <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-200">
                  <p className="font-semibold text-white">Bails à Lyon</p>
                  <p className="text-xs text-slate-400">Mercredi 03 avril • 19:00</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                    <span>🗺️ Terreaux</span>
                    <span>👥 128</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}




















