import { useEffect, useMemo, useState } from 'react';
import type { Profile } from '../../types';
import {
  fetchMarketplaceListings,
  getFavorites,
  toggleFavorite,
  updateListingStatus,
  deleteListing,
  type MarketplaceListing,
  fetchSavedSearches,
  createSavedSearch,
  deleteSavedSearch,
  updateSavedSearch,
  type SavedSearch,
} from '../../lib/marketplace';
import { fetchBuyerOrders, fetchSellerOrders, requestShippingLabel, type MarketplaceOrder } from '../../lib/marketplaceOrders';
import { Heart, Trash2, Archive, CheckCircle2, RefreshCcw, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase.js';

interface MarketplaceAccountSectionProps { profile: Profile | null }

export default function MarketplaceAccountSection({ profile }: MarketplaceAccountSectionProps) {
  const [tab, setTab] = useState<'overview' | 'sales' | 'purchases' | 'favorites' | 'searches' | 'payments'>('overview');
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [sellerOrders, setSellerOrders] = useState<MarketplaceOrder[]>([]);
  const [buyerOrders, setBuyerOrders] = useState<MarketplaceOrder[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newSearch, setNewSearch] = useState({ name: '', query: '' });

  useEffect(() => {
    void reload();
    try { setFavorites(getFavorites()); } catch {}
  }, []);

  const reload = async () => {
    try {
      setLoading(true); setError(null);
      setListings(await fetchMarketplaceListings());
      if (profile?.id) {
        setSellerOrders(await fetchSellerOrders(profile.id));
        setBuyerOrders(await fetchBuyerOrders(profile.id));
        setSearches(await fetchSavedSearches(profile.id));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Impossible de charger vos annonces';
      setError(msg);
    } finally { setLoading(false); }
  };

  const myListings = useMemo(() => listings.filter((l) => l.user_id === (profile?.id ?? '')), [listings, profile?.id]);
  const favListings = useMemo(() => listings.filter((l) => favorites.includes(l.id)), [listings, favorites]);

  const handleFav = (id: string) => setFavorites(toggleFavorite(id));

  const handleStatus = async (id: string, status: 'active' | 'sold' | 'archived') => {
    await updateListingStatus(id, status);
    void reload();
  };
  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette annonce ?')) return;
    await deleteListing(id);
    void reload();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Mon compte Marketplace</h1>
        <p className="text-sm text-slate-400">GÃ¨re tes ventes, favoris et recherches sauvegardées.</p>
        {!profile?.stripe_account_ready && (
          <div className="mt-3 rounded-xl border border-amber-600 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>Active les paiements pour vendre en toute sécurité(Stripe Connect).</span>
              <button
                type="button"
                onClick={async ()=>{
                  try {
                    const { data, error } = await supabase.functions.invoke('marketplace-connect', { body: {} });
                    if (error) throw error;
                    if (data?.url) window.location.href = data.url as string;
                  } catch (err) { alert("Onboarding Stripe indisponible."); }
                }}
                className="rounded-full border border-orange-500/60 bg-orange-500/10 px-3 py-1.5 text-orange-100 hover:bg-orange-500/20"
              >Activer les paiements</button>
            </div>
          </div>
        )}
        <nav className="mt-3 flex flex-wrap gap-2 text-sm">
          <button onClick={() => setTab('sales')} className={`rounded-full px-4 py-2 ${tab==='sales'?'bg-orange-500 text-white':'border border-slate-700 text-slate-200 hover:border-orange-500'}`}>Ventes</button>
          <button onClick={() => setTab('purchases')} className={`rounded-full px-4 py-2 ${tab==='purchases'?'bg-orange-500 text-white':'border border-slate-700 text-slate-200 hover:border-orange-500'}`}>Achats</button>
          <button onClick={() => setTab('favorites')} className={`rounded-full px-4 py-2 ${tab==='favorites'?'bg-orange-500 text-white':'border border-slate-700 text-slate-200 hover:border-orange-500'}`}>Favoris</button>
          <button onClick={() => setTab('searches')} className={`rounded-full px-4 py-2 ${tab==='searches'?'bg-orange-500 text-white':'border border-slate-700 text-slate-200 hover:border-orange-500'}`}>Recherches</button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('shredloc:navigate', { detail: { section: 'marketplace' } }))} className="rounded-full border border-slate-700 px-4 py-2 text-slate-200 hover:border-orange-500">Retour</button>
        </nav>
      </header>

      {loading ? (
        <div className="text-sm text-slate-400">Chargementâ€¦</div>
      ) : error ? (
        <div className="text-sm text-orange-300">{error}</div>
      ) : tab === 'sales' ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Mes annonces</h2>
            <button onClick={() => void reload()} className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:border-orange-500"><RefreshCcw size={14}/> RafraÃ®chir</button>
          </div>
          {myListings.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune annonce publiée.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myListings.map((l) => (
                <div key={l.id} className="rounded-2xl border border-slate-700 bg-slate-900/70 overflow-hidden">
                  <div className="aspect-square bg-slate-950/60">{l.image_url ? <img src={l.image_url} alt={l.title} className="h-full w-full object-cover"/> : null}</div>
                  <div className="p-4 space-y-2">
                    <h3 className="text-white font-semibold line-clamp-1">{l.title}</h3>
                    <p className="text-sm text-slate-400">{(l.price_cents/100).toLocaleString('fr-FR',{style:'currency',currency:l.currency})}</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <button onClick={() => handleStatus(l.id,'active')} className={`rounded-full px-3 py-1 border ${l.status==='active'?'border-orange-500 text-orange-200':'border-slate-700 text-slate-300 hover:border-orange-500'}`}>Activer</button>
                      <button onClick={() => handleStatus(l.id,'sold')} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 border ${l.status==='sold'?'border-orange-500 text-orange-200':'border-slate-700 text-slate-300 hover:border-orange-500'}`}><CheckCircle2 size={14}/> Vendu</button>
                      <button onClick={() => handleStatus(l.id,'archived')} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 border ${l.status==='archived'?'border-orange-500 text-orange-200':'border-slate-700 text-slate-300 hover:border-orange-500'}`}><Archive size={14}/> Archiver</button>
                      <button onClick={() => handleDelete(l.id)} className="inline-flex items-center gap-1 rounded-full px-3 py-1 border border-rose-600 text-rose-300 hover:bg-rose-600/10"><Trash2 size={14}/> Supprimer</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : tab === 'favorites' ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Mes favoris</h2>
          {favListings.length === 0 ? (
            <p className="text-sm text-slate-400">Aucun favori.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {favListings.map((l) => (
                <div key={l.id} className="group rounded-2xl border border-slate-700 bg-slate-900/70 overflow-hidden">
                  <div className="relative aspect-square bg-slate-950/60">
                    {l.image_url ? <img src={l.image_url} alt={l.title} className="h-full w-full object-cover" /> : null}
                    <button type="button" onClick={() => setFavorites(toggleFavorite(l.id))} className="absolute right-2 top-2 rounded-full bg-black/40 p-1.5 text-white hover:bg-black/60">
                      <Heart size={16} className={'fill-orange-500 text-orange-500'} />
                    </button>
                  </div>
                  <div className="p-4 space-y-1">
                    <h3 className="text-white font-semibold line-clamp-1 group-hover:text-orange-200">{l.title}</h3>
                    <p className="text-sm text-slate-400">{(l.price_cents/100).toLocaleString('fr-FR',{style:'currency',currency:l.currency})}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : tab === 'searches' ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Recherches sauvegarées</h2>
            <div className="flex gap-2">
              <input value={newSearch.name} onChange={(e)=>setNewSearch((s)=>({...s,name:e.target.value}))} placeholder="Nom" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"/>
              <input value={newSearch.query} onChange={(e)=>setNewSearch((s)=>({...s,query:e.target.value}))} placeholder="RequÃªte (ex: roues 52mm)" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"/>
              <button onClick={async ()=>{ if(!newSearch.name.trim() || !profile?.id) return; await createSavedSearch(profile.id, newSearch.name.trim(), newSearch.query.trim()); setNewSearch({name:'',query:''}); setSearches(await fetchSavedSearches(profile.id)); }} className="inline-flex items-center gap-2 rounded-full border border-orange-500/60 bg-orange-500/10 px-3 py-2 text-sm font-medium text-orange-100 hover:bg-orange-500/20"><Plus size={14}/> Ajouter</button>
            </div>
          </div>
          {searches.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune recherche enregistré.</p>
          ) : (
            <div className="grid gap-3">
              {searches.map((s)=>(
                <div key={s.id} className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm">
                  <div>
                    <p className="text-white font-medium">{s.name}</p>
                    <p className="text-slate-400">{s.query || 'â€”'} â€¢ {new Date(s.created_at).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-xs text-slate-300">
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={Boolean(s.alert_email)} onChange={async (e)=>{ if(!profile?.id) return; await updateSavedSearch(profile.id, s.id, { alert_email: e.target.checked }); setSearches(await fetchSavedSearches(profile.id)); }} /> Alerte Email
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={Boolean(s.alert_push)} onChange={async (e)=>{ if(!profile?.id) return; await updateSavedSearch(profile.id, s.id, { alert_push: e.target.checked }); setSearches(await fetchSavedSearches(profile.id)); }} /> Alerte Push
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={()=>window.dispatchEvent(new CustomEvent('shredloc:navigate', { detail: { section: 'marketplace' } }))} className="rounded-full border border-slate-700 px-3 py-1 text-slate-200 hover:border-orange-500">Rechercher</button>
                    <button onClick={async ()=>{ if(!profile?.id) return; await deleteSavedSearch(profile.id, s.id); setSearches(await fetchSavedSearches(profile.id)); }} className="rounded-full border border-rose-600 px-3 py-1 text-rose-300 hover:bg-rose-600/10">Supprimer</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Mes achats</h2>
          {buyerOrders.length === 0 ? (
            <p className="text-sm text-slate-400">Aucun achat.</p>
          ) : (
            <div className="grid gap-3">
              {buyerOrders.map((o)=> (
                <div key={o.id} className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-200 flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">Commande {o.id.slice(0,8)}â€¦</p>
                    <p className="text-slate-400">Statut: {o.status} â€¢ {(o.total_cents??0/100).toLocaleString('fr-FR',{style:'currency',currency:o.currency})} â€¢ {new Date(o.created_at).toLocaleDateString('fr-FR')}</p>
                    {o.shipping_tracking && <p className="text-slate-400">Tracking: {o.shipping_tracking}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {sellerOrders.length > 0 && (
            <div className="mt-6">
              <h3 className="text-md font-semibold text-white mb-2">Commandes Ã  expédier</h3>
              <div className="grid gap-3">
                {sellerOrders.filter((o)=>o.status==='paid').map((o)=> (
                  <div key={o.id} className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-200 flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">Commande {o.id.slice(0,8)}â€¦</p>
                      <p className="text-slate-400">{(o.total_cents??0/100).toLocaleString('fr-FR',{style:'currency',currency:o.currency})} â€¢ {new Date(o.created_at).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={o.shipping_label_url ?? '#'} target="_blank" className={`rounded-full px-3 py-1 ${o.shipping_label_url?'border border-slate-700 text-slate-200 hover:border-orange-500':'pointer-events-none opacity-50 border border-slate-800 text-slate-500'}`}>Ã‰tiquette</a>
                      <button onClick={async()=>{ const res=await requestShippingLabel(o.id); if(res){ await reload(); } }} className="rounded-full border border-orange-500/60 px-3 py-1 text-orange-200 hover:bg-orange-500/10">Créer étiquette</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

