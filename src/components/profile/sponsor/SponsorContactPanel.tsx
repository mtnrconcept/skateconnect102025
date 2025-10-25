import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Mail,
  Copy,
  Phone,
  Download,
  Globe,
  MapPin,
  FileText,
} from 'lucide-react';
import type { Profile, SponsorMediaKitResource } from '../../../types';
import { trackEvent } from '../../../lib/tracking';

interface SponsorContactPanelProps {
  profile: Profile;
}

type CopyStatus = 'idle' | 'success' | 'error';

async function copyToClipboard(value: string): Promise<boolean> {
  if (typeof navigator === 'undefined') {
    return false;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('Clipboard API rejected writeText call', error);
    }
  }

  if (typeof document === 'undefined') {
    return false;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-1000px';
  textarea.style.top = '-1000px';
  document.body.appendChild(textarea);
  textarea.select();

  let success = false;
  try {
    success = document.execCommand('copy');
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('document.execCommand copy fallback failed', error);
    }
  }

  document.body.removeChild(textarea);
  return success;
}

function getMediaKitBadge(kit: SponsorMediaKitResource): string | null {
  if (kit.format) {
    return kit.format.toUpperCase();
  }
  const url = kit.url.toLowerCase();
  if (url.endsWith('.pdf')) return 'PDF';
  if (url.endsWith('.zip')) return 'ZIP';
  if (url.endsWith('.pptx')) return 'PPTX';
  if (url.endsWith('.docx')) return 'DOC';
  return null;
}

export default function SponsorContactPanel({ profile }: SponsorContactPanelProps) {
  const contact = profile.sponsor_contact ?? null;
  const mediaKits = useMemo(() => profile.sponsor_media_kits ?? [], [profile.sponsor_media_kits]);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');

  const email = contact?.email ?? null;
  const phone = contact?.phone ?? null;
  const contactName = contact?.contact_name ?? null;
  const preferredLanguage = contact?.language ?? null;
  const contactAddress = contact?.address ?? null;

  useEffect(() => {
    if (copyStatus === 'idle') {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCopyStatus('idle');
    }, 2500);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [copyStatus]);

  const handleCopyEmail = useCallback(async () => {
    if (!email) {
      return;
    }

    const success = await copyToClipboard(email);
    setCopyStatus(success ? 'success' : 'error');

    trackEvent({
      category: 'sponsor_contact',
      action: success ? 'copy_email_success' : 'copy_email_failed',
      label: profile.id,
      metadata: {
        hasEmail: Boolean(email),
      },
    });
  }, [email, profile.id]);

  const handleMailtoClick = useCallback(() => {
    if (!email) {
      return;
    }

    trackEvent({
      category: 'sponsor_contact',
      action: 'mailto_click',
      label: profile.id,
      metadata: {
        hasEmail: true,
      },
    });
  }, [email, profile.id]);

  const handleDownloadKit = useCallback(
    (kit: SponsorMediaKitResource) => {
      trackEvent({
        category: 'sponsor_contact',
        action: 'download_media_kit',
        label: kit.id,
        metadata: {
          profileId: profile.id,
          format: kit.format ?? getMediaKitBadge(kit),
        },
      });
    },
    [profile.id],
  );

  return (
    <aside className="bg-dark-800 border border-dark-700 rounded-xl p-6 space-y-6 lg:sticky lg:top-28 h-fit">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.3em] text-orange-300">Relations sponsors</p>
        <h2 className="text-lg font-semibold text-white">Contact sponsoring</h2>
        {contactName ? (
          <p className="text-sm text-gray-400">{contactName}</p>
        ) : (
          <p className="text-sm text-gray-500">Equipe sponsoring</p>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="mt-1 rounded-full bg-orange-500/20 p-2 text-orange-300">
            <Mail size={16} />
          </div>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wide text-gray-500">Email</p>
            {email ? (
              <a
                href={`mailto:${email}`}
                onClick={handleMailtoClick}
                className="text-sm font-medium text-white hover:text-orange-300 transition-colors break-words"
              >
                {email}
              </a>
            ) : (
              <p className="text-sm text-gray-500">Email non renseigné</p>
            )}
          </div>
        </div>

        {phone ? (
          <div className="flex items-start gap-3">
            <div className="mt-1 rounded-full bg-orange-500/20 p-2 text-orange-300">
              <Phone size={16} />
            </div>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wide text-gray-500">Téléphone</p>
              <a
                href={`tel:${phone}`}
                onClick={() =>
                  trackEvent({
                    category: 'sponsor_contact',
                    action: 'phone_click',
                    label: profile.id,
                    metadata: { hasPhone: true },
                  })
                }
                className="text-sm font-medium text-white hover:text-orange-300 transition-colors"
              >
                {phone}
              </a>
            </div>
          </div>
        ) : null}

        {preferredLanguage ? (
          <div className="flex items-start gap-3">
            <div className="mt-1 rounded-full bg-orange-500/20 p-2 text-orange-300">
              <Globe size={16} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Langue</p>
              <p className="text-sm font-medium text-white uppercase">{preferredLanguage}</p>
            </div>
          </div>
        ) : null}

        {contactAddress ? (
          <div className="flex items-start gap-3">
            <div className="mt-1 rounded-full bg-orange-500/20 p-2 text-orange-300">
              <MapPin size={16} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Adresse</p>
              <p className="text-sm font-medium text-white whitespace-pre-line">{contactAddress}</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleCopyEmail}
          disabled={!email}
          className="inline-flex items-center gap-2 rounded-lg border border-orange-500/60 bg-orange-500/10 px-4 py-2 text-sm font-medium text-orange-200 transition-colors hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:border-dark-600 disabled:bg-dark-700 disabled:text-gray-500"
        >
          <Copy size={16} />
          Copier l'email
        </button>
        {email ? (
          <a
            href={`mailto:${email}`}
            onClick={handleMailtoClick}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
          >
            <Mail size={16} />
            Écrire un email
          </a>
        ) : null}
      </div>

      {copyStatus === 'success' ? (
        <p className="text-xs text-emerald-300">Adresse copiée dans le presse-papiers.</p>
      ) : null}
      {copyStatus === 'error' ? (
        <p className="text-xs text-red-300">Impossible de copier l'adresse. Copiez-la manuellement.</p>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-orange-300" />
          <p className="text-sm font-semibold text-white">Media kits</p>
        </div>
        {mediaKits.length > 0 ? (
          <ul className="space-y-2">
            {mediaKits.map((kit) => {
              const badge = getMediaKitBadge(kit);
              return (
                <li key={kit.id}>
                  <a
                    href={kit.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleDownloadKit(kit)}
                    className="group flex items-start justify-between gap-3 rounded-lg border border-dark-600 bg-dark-900/60 px-4 py-3 transition-colors hover:border-orange-500/60 hover:bg-dark-900"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white group-hover:text-orange-200">{kit.label}</p>
                      {kit.description ? (
                        <p className="text-xs text-gray-400">{kit.description}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {badge ? (
                        <span className="rounded-full border border-orange-500/40 bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange-200">
                          {badge}
                        </span>
                      ) : null}
                      <Download size={16} className="text-orange-300" />
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Ajoutez vos media kits dans Supabase (profil → `sponsor_media_kits`).</p>
        )}
      </div>
    </aside>
  );
}
