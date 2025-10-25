import type { Profile, SponsorBranding } from '../../../types';
import { getUserDisplayName } from '../../../lib/userUtils';

interface SponsorProfileHeroProps {
  profile: Profile;
}

const DEFAULT_PRIMARY_COLOR = '#FF7849';
const DEFAULT_SECONDARY_COLOR = '#1E1B4B';
const DEFAULT_TAGLINE = 'Sponsoring créatif pour booster la scène skate.';

function normalizeColor(value: string | null | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed;
}

function buildCta(
  branding: SponsorBranding | null,
  contactEmail: string | null | undefined,
): { href: string | null; label: string } {
  if (branding?.website_url) {
    return {
      href: branding.website_url,
      label: 'Découvrir nos offres B2B',
    };
  }

  if (contactEmail) {
    return {
      href: `mailto:${contactEmail}`,
      label: 'Contacter l’équipe partenariats',
    };
  }

  return {
    href: null,
    label: 'En savoir plus prochainement',
  };
}

function getBrandInitial(label: string): string {
  const normalized = label.trim();
  if (!normalized) {
    return 'S';
  }

  const [first] = normalized;
  return first?.toUpperCase() ?? 'S';
}

interface ColorSwatchProps {
  color: string;
  label: string;
  isFallback?: boolean;
}

function ColorSwatch({ color, label, isFallback }: ColorSwatchProps) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div
        className={`w-10 h-10 rounded-lg border border-white/30 shadow-inner ${
          isFallback ? 'border-dashed' : ''
        }`}
        style={{ backgroundColor: color }}
      />
      <span className="text-[10px] uppercase tracking-wide text-white/80">
        {label}
        {isFallback ? ' · défaut' : ''}
      </span>
    </div>
  );
}

export default function SponsorProfileHero({ profile }: SponsorProfileHeroProps) {
  const branding = profile.sponsor_branding ?? null;
  const brandName = branding?.brand_name?.trim() || getUserDisplayName(profile);
  const tagline = branding?.tagline?.trim() || DEFAULT_TAGLINE;
  const primaryColor = normalizeColor(branding?.primary_color, DEFAULT_PRIMARY_COLOR);
  const secondaryColor = normalizeColor(branding?.secondary_color, DEFAULT_SECONDARY_COLOR);
  const hasCustomPrimary = Boolean(branding?.primary_color?.trim());
  const hasCustomSecondary = Boolean(branding?.secondary_color?.trim());
  const hasLogo = Boolean(branding?.logo_url?.trim());
  const cta = buildCta(branding, profile.sponsor_contact?.email ?? null);

  return (
    <section className="relative mb-6 overflow-hidden rounded-2xl border border-dark-700 bg-dark-800">
      <div
        className="absolute inset-0 opacity-80"
        style={{
          backgroundImage: `linear-gradient(120deg, ${primaryColor}, ${secondaryColor})`,
        }}
      />
      <div className="relative z-10 flex flex-col gap-6 p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-6 md:flex-row md:items-center">
          <div className="flex items-center justify-center">
            {hasLogo ? (
              <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-white/40 bg-white/10 shadow-lg backdrop-blur">
                <img
                  src={branding?.logo_url ?? ''}
                  alt={`Logo ${brandName}`}
                  className="h-full w-full object-contain"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/30 bg-white/10 text-3xl font-semibold text-white shadow-lg backdrop-blur">
                {getBrandInitial(brandName)}
              </div>
            )}
          </div>

          <div className="flex-1 text-white">
            <p className="text-xs uppercase tracking-[0.3em] text-white/70">Espace sponsor</p>
            <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{brandName}</h1>
            <p className="mt-3 max-w-xl text-sm text-white/85 sm:text-base">{tagline}</p>
          </div>
        </div>

        <div className="flex flex-col items-start gap-4 md:items-end">
          <div className="flex gap-3">
            <ColorSwatch color={primaryColor} label="Primaire" isFallback={!hasCustomPrimary} />
            <ColorSwatch color={secondaryColor} label="Secondaire" isFallback={!hasCustomSecondary} />
          </div>

          {cta.href ? (
            <a
              href={cta.href}
              target={cta.href.startsWith('http') ? '_blank' : undefined}
              rel={cta.href.startsWith('http') ? 'noreferrer' : undefined}
              className="inline-flex items-center gap-2 rounded-full bg-white/90 px-5 py-2 text-sm font-semibold text-dark-900 transition hover:bg-white"
            >
              {cta.label}
              <span aria-hidden="true">→</span>
            </a>
          ) : (
            <span className="inline-flex items-center rounded-full bg-white/15 px-4 py-2 text-xs font-medium text-white/80">
              {cta.label}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
