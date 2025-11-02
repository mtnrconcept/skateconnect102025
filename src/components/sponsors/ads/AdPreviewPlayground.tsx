import AdMedia from './AdMedia';
import type { CampaignDraft } from '../../../types/ads';

interface PlaygroundProps {
  draft: CampaignDraft;
}

export default function AdPreviewPlayground({ draft }: PlaygroundProps) {
  const mediaKind: 'image' | 'video' | null = draft.creative.mediaUrl
    ? draft.creative.format === 'video'
      ? 'video'
      : 'image'
    : null;

  return (
    <div className="mt-8 space-y-6">
      <h3 className="text-sm font-semibold text-white/90">Résultat réel (simulation)</h3>

      {/* Page: Accueil / Feed */}
      {(draft.targetPages ?? []).includes('home-feed') && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white">
          <p className="mb-3 text-xs uppercase tracking-widest text-slate-400">Accueil / Feed</p>
          <div className="grid gap-4 md:grid-cols-[1fr_280px]">
            <div className="space-y-3">
              <div className="h-48 rounded-xl bg-white/5" />
              <div className="h-48 rounded-xl bg-white/5" />
              <div className="h-48 rounded-xl bg-white/5" />
            </div>
            {draft.placements.includes('side-feed') && (
              <aside className="rounded-xl border border-white/10 bg-white/10 p-3">
                <p className="mb-2 text-xs text-slate-300">Bloc sponsor à côté du feed</p>
                {mediaKind && draft.creative.mediaUrl ? (
                  <AdMedia
                    url={draft.creative.mediaUrl}
                    kind={mediaKind}
                    landingUrl={draft.creative.landingUrl}
                    className="aspect-[4/5] w-full overflow-hidden rounded-lg"
                  />
                ) : (
                  <div className="aspect-[4/5] w-full rounded-lg bg-black/20" />
                )}
                <div className="mt-2 text-sm font-semibold">{draft.creative.headline}</div>
                <div className="text-xs text-slate-300">{draft.creative.subheadline}</div>
              </aside>
            )}
          </div>
        </section>
      )}

      {/* Page: Détail du post */}
      {(draft.targetPages ?? []).includes('post-detail') && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white">
          <p className="mb-3 text-xs uppercase tracking-widest text-slate-400">Détail du post</p>
          {draft.placements.includes('top-banner') && (
            <div className="mb-3 h-20 w-full overflow-hidden rounded-lg border border-white/10 bg-gradient-to-r from-orange-500/30 to-orange-500/30">
              <div className="flex h-full items-center justify-between px-4 text-sm">
                <span className="font-semibold">{draft.creative.headline}</span>
                <a
                  href={draft.creative.landingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30"
                >
                  {draft.creative.callToAction}
                </a>
              </div>
            </div>
          )}
          <div className="rounded-xl border border-white/10 bg-white/10 p-3">
            <p className="text-xs text-slate-300">Média du post</p>
            {draft.placements.includes('post-media-interstitial') && mediaKind && draft.creative.mediaUrl ? (
              <Interstitial mediaUrl={draft.creative.mediaUrl} kind={mediaKind} landingUrl={draft.creative.landingUrl} />
            ) : (
              <div className="aspect-[4/5] w-full rounded-lg bg-black/20" />
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function Interstitial({ mediaUrl, kind, landingUrl }: { mediaUrl: string; kind: 'image' | 'video'; landingUrl?: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    // no-op
  }, []);
  const trigger = () => {
    setShow(true);
    setTimeout(() => setShow(false), 5000);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={trigger}
        className="mb-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs hover:bg-white/20"
      >
        Simuler l’ouverture du post
      </button>
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg bg-black/20">
        {show ? (
          <AdMedia url={mediaUrl} kind={kind} landingUrl={landingUrl} className="h-full w-full" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">Média d’origine</div>
        )}
      </div>
    </div>
  );
}
