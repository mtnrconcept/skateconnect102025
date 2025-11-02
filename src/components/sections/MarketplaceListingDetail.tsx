import { useEffect, useState } from 'react';
import { MapPin, MessageSquare, Tag } from 'lucide-react';
import type { Profile } from '../../types';
import { fetchListingById, type MarketplaceListing, getListingImages } from '../../lib/marketplace';
import { createMarketplaceCheckout } from '../../lib/marketplaceOrders';
import { supabase } from '../../lib/supabase.js';
import { getOrCreateConversation } from '../../lib/messages.js';

interface MarketplaceListingDetailProps {
  id: string;
  profile: Profile | null;
}

export default function MarketplaceListingDetail({ id, profile }: MarketplaceListingDetailProps) {
  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gallery, setGallery] = useState<string[]>([]);
  const [activeImage, setActiveImage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        setError(null);
        const row = await fetchListingById(id);
        setListing(row);
        if (row?.id) {
          const imgs = await getListingImages(row.id);
          const ordered = [row.image_url, ...imgs].filter((u): u is string => Boolean(u));
          setGallery(ordered);
          setActiveImage(ordered[0] ?? null);
        } else {
          setGallery([]);
          setActiveImage(null);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Impossible de charger l'annonce";
        setError(message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleContact = async () => {
    if (!profile || !listing?.user_id) return;
    try {
      const conv = await getOrCreateConversation(supabase, profile.id, listing.user_id);
      const event = new CustomEvent('shredloc:navigate', {
        detail: { section: 'messages', options: { conversationId: conv.id } },
      });
      window.dispatchEvent(event);
    } catch (err) {
      alert("Impossible d'ouvrir la messagerie.");
    }
  };

  const handleBuy = async () => {
    if (!profile || !listing) {
      alert('Connecte-toi pour acheter.');
      return;
    }
    try {
      const { url } = await createMarketplaceCheckout({
        listingId: listing.id,
        quantity: 1,
        successUrl: `${window.location.origin}/marketplace/account`,
        cancelUrl: window.location.href,
        buyerEmail: null,
      });
      if (url) {
        window.location.href = url;
      } else {
        alert('Checkout indisponible pour le moment.');
      }
    } catch (err) {
      alert("Impossible de lancer le paiement.");
    }
  };

  if (loading) return <div className="mx-auto max-w-4xl px-4 py-8 text-sm text-slate-400">Chargement...</div>;
  if (error || !listing) return <div className="mx-auto max-w-4xl px-4 py-8 text-sm text-orange-300">{error ?? "Annonce introuvable"}</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/60">
          <div className="aspect-[4/3] bg-black/20">
            {activeImage ? (
              <img src={activeImage} alt={listing.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-slate-600">Aperçu</div>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="p-3 flex gap-2 overflow-x-auto">
              {gallery.map((url) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setActiveImage(url)}
                  className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border ${activeImage===url ? 'border-orange-500' : 'border-slate-700 hover:border-orange-500/60'}`}
                >
                  <img src={url} alt="thumb" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
          <div className="p-4">
            <h1 className="text-2xl font-bold text-white">{listing.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-300">
              <span className="inline-flex items-center gap-1"><Tag size={16} /> {listing.category} â€¢ {listing.condition}</span>
              <span className="inline-flex items-center gap-1"><MapPin size={16} /> {[listing.city, listing.country].filter(Boolean).join(', ')}</span>
              {listing.shipping_available && <span className="rounded-full border border-orange-500/40 bg-orange-500/10 px-2 py-0.5 text-xs text-orange-200">Livraison possible</span>}
            </div>
            <p className="mt-3 text-slate-200 whitespace-pre-wrap">{listing.description}</p>
          </div>
        </div>
        <aside className="space-y-3">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
            <p className="text-sm text-slate-400">Prix</p>
            <p className="text-3xl font-semibold text-white">{(listing.price_cents/100).toLocaleString('fr-FR',{style:'currency',currency:listing.currency})}</p>
            <div className="mt-3 flex flex-col gap-2">
              <button type="button" onClick={handleContact} className="rounded-xl border border-orange-500/60 bg-orange-500/10 px-4 py-2 text-sm font-medium text-orange-100 hover:bg-orange-500/20 inline-flex items-center gap-2"><MessageSquare size={16}/> Contacter le vendeur</button>
              <button type="button" className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-orange-500">Faire une offre (bientÃ´t)</button>
              <button type="button" onClick={handleBuy} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-orange-500">Acheter</button>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 text-sm text-slate-300">
            <p>Vendeur: {listing.user_id.slice(0,8)}â€¦</p>
            <p>Publication: {new Date(listing.created_at).toLocaleDateString('fr-FR')}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}



