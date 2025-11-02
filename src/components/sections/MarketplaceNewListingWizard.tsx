import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Profile } from '../../types';
import { MARKETPLACE_CATEGORIES, type MarketplaceCategory, createMarketplaceListing, saveListingImages } from '../../lib/marketplace';
import { uploadFile } from '../../lib/storage';
import { Euro, CheckCircle2, ChevronLeft, ChevronRight, Image as ImageIcon, MapPin } from 'lucide-react';
import { CATEGORY_ATTRIBUTES } from '../../data/marketplaceAttributes';
import { MARKETPLACE_SUBCATEGORIES } from '../../data/marketplaceSubcategories';
import { MARKETPLACE_BRANDS } from '../../data/marketplaceBrands';

interface MarketplaceNewListingWizardProps {
  profile: Profile | null;
}

type Step = 0 | 1 | 2 | 3 | 4;

type WizardDraft = {
  category: MarketplaceCategory | 'other';
  subcategory: string | null;
  title: string;
  description: string;
  condition: 'new' | 'like-new' | 'used' | 'for-parts';
  price: string;
  negotiable: boolean;
  shipping_available: boolean;
  city: string;
  country: string;
  postalCode: string;
  images: string[]; // URLs uploaded (first = cover)
  attributes: Record<string, string>;
};

const EMPTY_DRAFT: WizardDraft = {
  category: 'other',
  subcategory: null,
  title: '',
  description: '',
  condition: 'used',
  price: '',
  negotiable: true,
  shipping_available: false,
  city: '',
  country: '',
  postalCode: '',
  images: [],
  attributes: {},
};

const DRAFT_KEY = 'shredloc:marketplace:new-draft';

export default function MarketplaceNewListingWizard({ profile }: MarketplaceNewListingWizardProps) {
  const [step, setStep] = useState<Step>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<WizardDraft>(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) return { ...EMPTY_DRAFT, ...(JSON.parse(raw) as WizardDraft) };
    } catch {}
    return { ...EMPTY_DRAFT };
  });

  useEffect(() => {
    try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {}
  }, [draft]);

  const canNext = useMemo(() => {
    switch (step) {
      case 0:
        return Boolean(draft.category);
      case 1:
        return draft.title.trim().length >= 5 && draft.description.trim().length >= 20 && Number.parseFloat(draft.price.replace(',', '.')) > 0;
      case 2:
        return draft.images.length > 0;
      case 3:
        return draft.city.trim().length > 1 && draft.country.trim().length > 1;
      default:
        return true;
    }
  }, [step, draft]);

  const resetDraft = () => {
    setDraft({ ...EMPTY_DRAFT });
    try { window.localStorage.removeItem(DRAFT_KEY); } catch {}
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !profile?.id) return;
    setSaving(true);
    setError(null);
    try {
      const uploaded: string[] = [];
      for (const f of Array.from(files).slice(0, 8)) {
        const { url } = await uploadFile('marketplace', f, profile.id).catch(() => ({ url: null as unknown as string }));
        if (url) uploaded.push(url);
      }
      if (uploaded.length === 0) {
        setError("Impossible de téléverser les images (bucket 'marketplace' manquant ?)." );
      } else {
        setDraft((d) => ({ ...d, images: [...d.images, ...uploaded].slice(0, 8) }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur upload';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = useCallback(async () => {
    if (!profile) { setError('Connecte-toi pour publier.'); return; }
    const amount = Number.parseFloat(draft.price.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) { setError('Prix invalide.'); return; }
    setSaving(true);
    setError(null);
    try {
      const created = await createMarketplaceListing({
        user_id: profile.id,
        title: draft.title.trim(),
        description: draft.description.trim(),
        price_cents: Math.round(amount * 100),
        currency: 'EUR',
        category: draft.category,
        condition: draft.condition,
        shipping_available: draft.shipping_available,
        city: draft.city.trim() || null,
        country: draft.country.trim() || null,
        image_url: draft.images[0] ?? null,
        attributes: { ...draft.attributes, ...(draft.subcategory ? { subcategory: draft.subcategory } : {}) },
        status: 'active',
      });
      if (draft.images.length > 0) {
        await saveListingImages(created.id, draft.images);
      }
      resetDraft();
      setStep(4);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Impossible de publier l'annonce";
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [draft, profile]);

  const next = () => canNext && setStep((s) => (Math.min(s + 1, 4) as Step));
  const prev = () => setStep((s) => (Math.max(s - 1, 0) as Step));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Déposer une annonce</h1>
        <p className="text-sm text-slate-400">Suis les étapes, comme sur Leboncoin/eBay/Ricardo.</p>
        <ol className="mt-4 grid grid-cols-5 gap-2 text-xs">
          {['Catégorie','Détails','Photos','Localisation & livraison','Aperçu'].map((label, idx)=> (
            <li key={label} className={`rounded-full px-3 py-2 text-center border ${idx<=step? 'border-orange-500 text-orange-200':'border-slate-700 text-slate-400'}`}>{label}</li>
          ))}
        </ol>
      </header>

      {error && (<div className="mb-4 rounded-xl border border-rose-600 bg-rose-600/10 px-4 py-3 text-sm text-rose-200">{error}</div>)}

      {step === 0 && (
        <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
          <h2 className="text-lg font-semibold text-white">Catégorie</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {MARKETPLACE_CATEGORIES.map((c) => (
              <button key={c.id} type="button" onClick={()=> setDraft((d)=>({...d, category: c.id, subcategory: null, attributes: { ...d.attributes, brand: '' } }))} className={`rounded-xl px-4 py-3 text-left text-sm ${draft.category===c.id? 'border border-orange-500 bg-orange-500/10 text-orange-200' : 'border border-slate-700 bg-slate-900 text-slate-200 hover:border-orange-500'}`}>{c.label}</button>
            ))}
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
          <h2 className="text-lg font-semibold text-white">Détails de l’annonce</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-slate-300 md:col-span-2">Titre
              <input value={draft.title} onChange={(e)=>setDraft((d)=>({...d,title:e.target.value}))} placeholder="Ex: Deck 8.25'' neuf" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"/>
            </label>
            <label className="text-sm text-slate-300 md:col-span-2">Description
              <textarea value={draft.description} onChange={(e)=>setDraft((d)=>({...d,description:e.target.value}))} rows={5} placeholder="Décris précisément l’article, l’état, la marque, le modèle…" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"/>
            </label>
            <label className="text-sm text-slate-300">État
              <select value={draft.condition} onChange={(e)=>setDraft((d)=>({...d,condition:e.target.value as any}))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500">
                <option value="new">Neuf</option>
                <option value="like-new">Comme neuf</option>
                <option value="used">Bon état</option>
                <option value="for-parts">Pour pièces</option>
              </select>
            </label>
            <label className="text-sm text-slate-300">Prix (€)
              <div className="relative mt-1">
                <Euro className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input value={draft.price} onChange={(e)=>setDraft((d)=>({...d,price:e.target.value}))} placeholder="ex: 49,90" className="w-full rounded-lg border border-slate-700 bg-slate-900 pl-8 pr-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"/>
              </div>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={draft.negotiable} onChange={(e)=>setDraft((d)=>({...d,negotiable:e.target.checked}))}/>
              Prix négociable
            </label>
            {(MARKETPLACE_SUBCATEGORIES[draft.category] ?? []).length > 0 && (
              <label className="text-sm text-slate-300">
                Sous-catégorie
                <select
                  value={draft.subcategory ?? ''}
                  onChange={(e)=> setDraft((d)=> ({...d, subcategory: e.target.value || null, attributes: { ...d.attributes, ...(e.target.value ? { subcategory: e.target.value } : {}) }}))}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  <option value="">Toutes</option>
                  {(MARKETPLACE_SUBCATEGORIES[draft.category] ?? []).map((s)=> (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
            )}
            {(MARKETPLACE_BRANDS[draft.category] ?? []).length > 0 && (
              <label className="text-sm text-slate-300">
                Marque
                <select
                  value={draft.attributes.brand ?? ''}
                  onChange={(e)=> setDraft((d)=> ({...d, attributes: { ...d.attributes, brand: e.target.value }}))}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  <option value="">Toutes</option>
                  {(MARKETPLACE_BRANDS[draft.category] ?? []).map((b)=> (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </label>
            )}
            {CATEGORY_ATTRIBUTES[draft.category]?.length ? (
              <div className="md:col-span-2 grid gap-3 sm:grid-cols-2">
                {CATEGORY_ATTRIBUTES[draft.category].map((attr) => (
                  <label key={attr.id} className="text-sm text-slate-300">
                    {attr.label}
                    {attr.type === 'select' ? (
                      <select
                        value={draft.attributes[attr.id] ?? ''}
                        onChange={(e)=> setDraft((d)=> ({...d, attributes: { ...d.attributes, [attr.id]: e.target.value }}))}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                      >
                        <option value="">—</option>
                        {(attr.options ?? []).map((opt)=> (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={attr.type === 'number' ? 'number' : 'text'}
                        value={draft.attributes[attr.id] ?? ''}
                        onChange={(e)=> setDraft((d)=> ({...d, attributes: { ...d.attributes, [attr.id]: e.target.value }}))}
                        placeholder={attr.placeholder}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                    )}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
          <h2 className="text-lg font-semibold text-white">Photos</h2>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {draft.images.map((url, idx)=> (
              <div key={url} className="relative aspect-square overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
                <img src={url} alt={`photo-${idx+1}`} className="h-full w-full object-cover"/>
                {idx===0 && (<span className="absolute left-2 top-2 rounded-full border border-orange-500/60 bg-orange-500/10 px-2 py-0.5 text-[11px] text-orange-200">Couverture</span>)}
                <button type="button" onClick={()=> setDraft((d)=> ({...d, images: d.images.filter((x)=> x!==url)}))} className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white">Suppr.</button>
              </div>
            ))}
            <label className="flex aspect-square cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-700 text-slate-400">
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e)=> void handleUpload(e.target.files)} disabled={saving}/>
              <div className="flex flex-col items-center gap-2"><ImageIcon size={24}/><span>Ajouter</span></div>
            </label>
          </div>
          <p className="text-xs text-slate-400">Jusqu’à 8 photos. Formats recommandés: JPG/PNG. La première photo sera utilisée comme couverture.</p>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
          <h2 className="text-lg font-semibold text-white">Localisation & livraison</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-slate-300">Ville
              <div className="relative mt-1">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input value={draft.city} onChange={(e)=>setDraft((d)=>({...d,city:e.target.value}))} className="w-full rounded-lg border border-slate-700 bg-slate-900 pl-8 pr-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"/>
              </div>
            </label>
            <label className="text-sm text-slate-300">Code Postal
              <input value={draft.postalCode} onChange={(e)=>setDraft((d)=>({...d,postalCode:e.target.value}))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"/>
            </label>
            <label className="text-sm text-slate-300">Pays
              <input value={draft.country} onChange={(e)=>setDraft((d)=>({...d,country:e.target.value}))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"/>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={draft.shipping_available} onChange={(e)=>setDraft((d)=>({...d,shipping_available:e.target.checked}))}/>
              Livraison possible
            </label>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
          <h2 className="text-lg font-semibold text-white">Aperçu</h2>
          <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 overflow-hidden">
              <div className="aspect-[4/3] bg-black/20">
                {draft.images[0] ? <img src={draft.images[0]} alt="cover" className="h-full w-full object-cover"/> : <div className="flex h-full items-center justify-center text-slate-600">Aperçu</div>}
              </div>
              <div className="p-4 space-y-1">
                <h3 className="text-white font-semibold">{draft.title || 'Titre de ton annonce'}</h3>
                <p className="text-sm text-slate-400">{draft.category} • {draft.condition}{draft.shipping_available?' • Livraison possible':''}</p>
                <p className="text-sm text-slate-300 line-clamp-3">{draft.description || 'Description…'}</p>
              </div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
              <p className="text-sm text-slate-400">Prix</p>
              <p className="text-3xl font-semibold text-white">{draft.price ? Number.parseFloat(draft.price.replace(',', '.')).toLocaleString('fr-FR', { style:'currency', currency: 'EUR' }) : '—'}</p>
              <p className="mt-2 text-sm text-slate-400">Localisation: {[draft.city, draft.country].filter(Boolean).join(', ') || '—'}</p>
              <div className="mt-3">
                <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                  <input type="checkbox" className="" defaultChecked/>
                  J’accepte les Conditions Générales et la Politique Marketplace
                </label>
              </div>
              <div className="mt-4 flex gap-2">
                <button type="button" disabled={saving} onClick={handlePublish} className="inline-flex items-center gap-2 rounded-full border border-orange-500/60 bg-orange-500/10 px-4 py-2 text-sm font-medium text-orange-100 hover:bg-orange-500/20 disabled:opacity-60"><CheckCircle2 size={16}/> Publier</button>
              </div>
            </div>
          </div>
        </section>
      )}

      <footer className="mt-6 flex items-center justify-between">
        <button type="button" onClick={prev} disabled={step===0} className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-orange-500 disabled:opacity-50"><ChevronLeft size={16}/> Précédent</button>
        <button type="button" onClick={next} disabled={!canNext || step===4} className="inline-flex items-center gap-2 rounded-full border border-orange-500/60 bg-orange-500/10 px-4 py-2 text-sm font-medium text-orange-100 hover:bg-orange-500/20 disabled:opacity-50">Suivant <ChevronRight size={16}/></button>
      </footer>
    </div>
  );
}
