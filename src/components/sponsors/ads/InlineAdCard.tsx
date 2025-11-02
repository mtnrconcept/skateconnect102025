import React from 'react';

interface InlineAdCardProps {
  sponsorName: string;
  headline: string;
  subheadline?: string;
  message: string;
  callToAction: string;
  landingUrl?: string;
  mediaUrl?: string;
  format: 'image' | 'video' | 'carousel';
  primaryColor: string;
  accentColor: string;
  placementsCount?: number;
  aspect?: '4/5' | '9/16' | '3/4';
  fillContainer?: boolean;
  splitTwoThirds?: boolean;
}

export default function InlineAdCard({
  sponsorName,
  headline,
  subheadline,
  message,
  callToAction,
  landingUrl,
  mediaUrl,
  format,
  primaryColor,
  accentColor,
  placementsCount = 1,
  aspect = '4/5',
  fillContainer = false,
  splitTwoThirds = false,
}: InlineAdCardProps) {
  const isVideo = format === 'video';
  const aspectClass = aspect === '9/16' ? 'aspect-[9/16]' : aspect === '3/4' ? 'aspect-[3/4]' : 'aspect-[4/5]';

  if (fillContainer) {
    const Card = (
      <div
        className="relative h-full w-full overflow-hidden rounded-4xl border border-white/11 bg-white/6 shadow-[0px_60px_-35px_rgba(0,0,0,0.9)]"
        style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
      >
        {mediaUrl ? (
          isVideo ? (
            <video src={mediaUrl} className="absolute inset-0 h-full w-full object-cover" muted playsInline loop />
          ) : (
            <img src={mediaUrl} alt="ad" className="absolute inset-0 h-full w-full object-cover" />
          )
        ) : (
          <div className="absolute inset-0 h-full w-full bg-black/30" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/30 to-black/70" />
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.35em] text-white/70">{sponsorName}</p>
          <h3 className="mt-2 line-clamp-1 text-xl sm:text-2xl font-semibold text-white">{headline}</h3>
          {subheadline && <p className="mt-1 line-clamp-1 text-xs sm:text-sm text-white/85">{subheadline}</p>}
          <p className="mt-3 line-clamp-2 text-xs sm:text-sm leading-relaxed text-white/90">{message}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <a
              href={landingUrl || '#'}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 font-semibold text-white hover:bg-white/25"
            >
              {callToAction}
            </a>
            <span className="inline-flex items-center gap-2 text-white/70">
              {placementsCount} placement(s)
            </span>
          </div>
        </div>
      </div>
    );
    return landingUrl ? (
      <a href={landingUrl} target="_blank" rel="noreferrer" className="block">{Card}</a>
    ) : (
      Card
    );
  }

  if (splitTwoThirds) {
    const Card = (
      <div
        className={`overflow-hidden rounded-3xl border border-white/11 bg-white/5 shadow-[0_24px_60px_-35px_rgba(0,0,0,0.9)] ${aspectClass}`}
        style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
      >
        <div className="relative h-2/3 w-full bg-black">
          {mediaUrl ? (
            isVideo ? (
              <video src={mediaUrl} className="absolute inset-0 h-full w-full object-cover" muted playsInline loop />
            ) : (
              <img src={mediaUrl} alt="ad" className="absolute inset-0 h-full w-full object-cover" />
            )
          ) : (
            <div className="absolute inset-0 h-full w-full bg-black/30" />
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-black/0 to-black/60" />
        </div>
        <div className="h-1/3 w-full bg-black/55 p-4 sm:p-5">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.35em] text-white/70">{sponsorName}</p>
          <h3 className="mt-2 line-clamp-1 text-lg sm:text-xl font-semibold text-white">{headline}</h3>
          {subheadline && <p className="mt-1 line-clamp-1 text-xs sm:text-sm text-white/85">{subheadline}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <a
              href={landingUrl || '#'}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 font-semibold text-white hover:bg-white/25"
            >
              {callToAction}
            </a>
            <span className="inline-flex items-center gap-2 text-white/70">{placementsCount} placement(s)</span>
          </div>
        </div>
      </div>
    );
    return landingUrl ? (
      <a href={landingUrl} target="_blank" rel="noreferrer" className="block">{Card}</a>
    ) : (
      Card
    );
  }

  const Card = (
    <div
      className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_24px_60px_-35px_rgba(0,0,0,0.9)]"
      style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
    >
      <div className={`relative w-full bg-black ${aspectClass}`}>
        {mediaUrl ? (
          isVideo ? (
            <video src={mediaUrl} className="h-full w-full object-cover" muted playsInline loop />
          ) : (
            <img src={mediaUrl} alt="ad" className="h-full w-full object-cover" />
          )
        ) : (
          <div className="h-full w-full bg-black/30" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/30 to-black/60" />
      </div>

      <div className="bg-black/25 p-6">
        <p className="text-[11px] uppercase tracking-[0.4em] text-white/70">{sponsorName}</p>
        <h3 className="mt-2 text-2xl font-semibold text-white">{headline}</h3>
        {subheadline && <p className="mt-1 text-sm text-white/80">{subheadline}</p>}
      </div>

      <div className="bg-black/45 p-6 text-sm text-white/85">
        <p className="leading-relaxed text-white/90">{message}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <a
            href={landingUrl || '#'}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-semibold text-white hover:bg-white/25"
          >
            {callToAction}
          </a>
          <span className="inline-flex items-center gap-2 text-xs text-white/70">
            {placementsCount} placement(s)
          </span>
        </div>
      </div>
    </div>
  );

  return landingUrl ? (
    <a href={landingUrl} target="_blank" rel="noreferrer" className="block">{Card}</a>
  ) : (
    Card
  );
}
