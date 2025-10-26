import { useMemo, useState } from 'react';
import {
  X,
  Loader2,
  Upload,
  Image as ImageIcon,
  Palette,
  Link as LinkIcon,
  Mail,
  Phone,
  MapPin,
  Globe,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase.js';
import { getUserDisplayName } from '../../../lib/userUtils';
import MediaUploader from '../../MediaUploader';
import SponsorProfileHero from './SponsorProfileHero';
import type {
  Profile,
  SponsorBranding,
  SponsorContactInfo,
} from '../../../types';
import type { RiderProfileEditorModalProps } from '../rider/RiderProfileEditorModal';

const DEFAULT_PRIMARY_COLOR = '#FF7849';
const DEFAULT_SECONDARY_COLOR = '#1E1B4B';

const SOCIAL_PLATFORMS: Array<{ key: string; label: string; placeholder: string }> = [
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/votre-marque' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://www.tiktok.com/@votre-marque' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@votre-marque' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://www.linkedin.com/company/votre-marque' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://www.facebook.com/votre-marque' },
  { key: 'twitter', label: 'X (Twitter)', placeholder: 'https://twitter.com/votre-marque' },
];

const LANGUAGE_OPTIONS = ['Français', 'Anglais', 'Espagnol', 'Allemand'];

type SponsorProfileEditorModalProps = RiderProfileEditorModalProps;

const isValidHexColor = (value: string): boolean => {
  return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value.trim());
};

const normalizedColorForInput = (value: string | null | undefined, fallback: string) => {
  if (!value || !isValidHexColor(value)) {
    return fallback;
  }
  return value;
};

const cleanupOptionalValue = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export default function SponsorProfileEditorModal({
  profile,
  onClose,
  onSaved,
}: SponsorProfileEditorModalProps) {
  const branding = profile.sponsor_branding ?? null;
  const contact = profile.sponsor_contact ?? null;

  const [displayName, setDisplayName] = useState(profile.display_name ?? '');
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [brandName, setBrandName] = useState(branding?.brand_name ?? getUserDisplayName(profile));
  const [tagline, setTagline] = useState(branding?.tagline ?? '');
  const [primaryColor, setPrimaryColor] = useState(branding?.primary_color ?? DEFAULT_PRIMARY_COLOR);
  const [secondaryColor, setSecondaryColor] = useState(branding?.secondary_color ?? DEFAULT_SECONDARY_COLOR);
  const [websiteUrl, setWebsiteUrl] = useState(branding?.website_url ?? '');
  const [logoUrl, setLogoUrl] = useState<string | null>(branding?.logo_url ?? null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(branding?.banner_url ?? null);
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>(() => {
    const existing = branding?.social_links ?? {};
    const initial: Record<string, string> = {};
    for (const platform of SOCIAL_PLATFORMS) {
      initial[platform.key] = existing[platform.key] ?? '';
    }
    for (const [key, value] of Object.entries(existing)) {
      if (!(key in initial)) {
        initial[key] = value ?? '';
      }
    }
    return initial;
  });
  const [contactEmail, setContactEmail] = useState(contact?.email ?? '');
  const [contactPhone, setContactPhone] = useState(contact?.phone ?? '');
  const [contactName, setContactName] = useState(contact?.contact_name ?? '');
  const [contactLanguage, setContactLanguage] = useState(contact?.language ?? '');
  const [contactAddress, setContactAddress] = useState(contact?.address ?? '');
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [showLogoUploader, setShowLogoUploader] = useState(false);
  const [showBannerUploader, setShowBannerUploader] = useState(false);

  const sanitizedSocialLinks = useMemo<Record<string, string>>(() => {
    return Object.fromEntries(
      Object.entries(socialLinks)
        .map(([key, value]) => [key, value.trim()])
        .filter(([, value]) => value.length > 0),
    );
  }, [socialLinks]);

  const previewBranding = useMemo<SponsorBranding>(
    () => ({
      brand_name: cleanupOptionalValue(brandName) ?? getUserDisplayName(profile),
      tagline: cleanupOptionalValue(tagline),
      primary_color: cleanupOptionalValue(primaryColor),
      secondary_color: cleanupOptionalValue(secondaryColor),
      website_url: cleanupOptionalValue(websiteUrl),
      logo_url: logoUrl,
      banner_url: bannerUrl,
      social_links: Object.keys(sanitizedSocialLinks).length > 0 ? sanitizedSocialLinks : null,
    }),
    [bannerUrl, brandName, logoUrl, primaryColor, profile, sanitizedSocialLinks, secondaryColor, tagline, websiteUrl],
  );

  const previewContact = useMemo<SponsorContactInfo>(
    () => ({
      email: contactEmail.trim(),
      phone: cleanupOptionalValue(contactPhone),
      contact_name: cleanupOptionalValue(contactName),
      language: cleanupOptionalValue(contactLanguage),
      address: cleanupOptionalValue(contactAddress),
    }),
    [contactAddress, contactEmail, contactLanguage, contactName, contactPhone],
  );

  const previewProfile = useMemo<Profile>(
    () => ({
      ...profile,
      display_name: cleanupOptionalValue(displayName),
      username: username.trim(),
      bio: cleanupOptionalValue(bio),
      sponsor_branding: previewBranding,
      sponsor_contact: previewContact,
    }),
    [bio, displayName, previewBranding, previewContact, profile, username],
  );

  const handleSocialLinkChange = (key: string, value: string) => {
    setSocialLinks((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      const normalizedDisplayName = cleanupOptionalValue(displayName);
      const normalizedBio = cleanupOptionalValue(bio);
      const normalizedBrandName = cleanupOptionalValue(brandName) ?? getUserDisplayName(profile);
      const normalizedTagline = cleanupOptionalValue(tagline);
      const normalizedPrimary = cleanupOptionalValue(primaryColor);
      const normalizedSecondary = cleanupOptionalValue(secondaryColor);
      const normalizedWebsite = cleanupOptionalValue(websiteUrl);
      const normalizedSocials = Object.keys(sanitizedSocialLinks).length > 0 ? sanitizedSocialLinks : null;
      const normalizedEmail = contactEmail.trim();

      if (!normalizedEmail) {
        alert('Veuillez renseigner un email de contact.');
        setSaving(false);
        return;
      }

      const updatePayload = {
        display_name: normalizedDisplayName,
        username: username.trim(),
        bio: normalizedBio,
        sponsor_branding: {
          brand_name: normalizedBrandName,
          tagline: normalizedTagline,
          primary_color: normalizedPrimary,
          secondary_color: normalizedSecondary,
          website_url: normalizedWebsite,
          logo_url: logoUrl,
          banner_url: bannerUrl,
          social_links: normalizedSocials,
        } as SponsorBranding,
        sponsor_contact: {
          email: normalizedEmail,
          phone: cleanupOptionalValue(contactPhone),
          contact_name: cleanupOptionalValue(contactName),
          language: cleanupOptionalValue(contactLanguage),
          address: cleanupOptionalValue(contactAddress),
        } as SponsorContactInfo,
      };

      const { error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', profile.id);

      if (error) throw error;

      await onSaved?.();
    } catch (error) {
      console.error('Error updating sponsor profile:', error);
      alert('Impossible de sauvegarder le profil sponsor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-h-[90vh] max-w-6xl flex-col overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-gradient-to-r from-orange-500 to-rose-500 px-6 py-5 text-white">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/80">Espace sponsor</p>
            <h2 className="text-2xl font-semibold">Personnaliser le profil</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/10 p-2 transition hover:bg-white/20"
          >
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col lg:flex-row">
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid gap-6">
              <section className="space-y-4 rounded-2xl border border-slate-200 p-5">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Informations générales</h3>
                  <p className="text-sm text-slate-500">
                    Ces informations sont utilisées dans les zones publiques et administratives de votre profil.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="displayName" className="text-sm font-medium text-slate-700">
                      Nom d’affichage
                    </label>
                    <input
                      id="displayName"
                      type="text"
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder="Nom de la marque"
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="username" className="text-sm font-medium text-slate-700">
                      Identifiant (slug)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">@</span>
                      <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        required
                        className="w-full rounded-lg border border-slate-300 py-3 pl-8 pr-4 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="bio" className="text-sm font-medium text-slate-700">
                    Description courte
                  </label>
                  <textarea
                    id="bio"
                    value={bio}
                    onChange={(event) => setBio(event.target.value)}
                    rows={3}
                    placeholder="Présentez votre ADN, vos programmes d’activation, vos athlètes ambassadeurs…"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                    maxLength={500}
                  />
                  <p className="text-xs text-slate-500">{bio.length}/500 caractères</p>
                </div>
              </section>

              <section className="space-y-4 rounded-2xl border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Branding</h3>
                    <p className="text-sm text-slate-500">
                      Adaptez l’expérience visuelle de votre espace sponsor et partagez vos assets clés.
                    </p>
                  </div>
                  <Palette className="hidden text-orange-500 md:block" size={24} />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="brandName" className="text-sm font-medium text-slate-700">
                      Nom de marque
                    </label>
                    <input
                      id="brandName"
                      type="text"
                      value={brandName}
                      onChange={(event) => setBrandName(event.target.value)}
                      required
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="tagline" className="text-sm font-medium text-slate-700">
                      Tagline / promesse
                    </label>
                    <input
                      id="tagline"
                      type="text"
                      value={tagline}
                      onChange={(event) => setTagline(event.target.value)}
                      placeholder="Sponsoring créatif pour booster la scène skate."
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-3">
                    <label className="text-sm font-medium text-slate-700">Couleur primaire</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={normalizedColorForInput(primaryColor, DEFAULT_PRIMARY_COLOR)}
                        onChange={(event) => setPrimaryColor(event.target.value)}
                        className="h-10 w-14 cursor-pointer rounded border border-slate-300"
                      />
                      <input
                        type="text"
                        value={primaryColor}
                        onChange={(event) => setPrimaryColor(event.target.value)}
                        placeholder="#FF7849"
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <label className="text-sm font-medium text-slate-700">Couleur secondaire</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={normalizedColorForInput(secondaryColor, DEFAULT_SECONDARY_COLOR)}
                        onChange={(event) => setSecondaryColor(event.target.value)}
                        className="h-10 w-14 cursor-pointer rounded border border-slate-300"
                      />
                      <input
                        type="text"
                        value={secondaryColor}
                        onChange={(event) => setSecondaryColor(event.target.value)}
                        placeholder="#1E1B4B"
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="website" className="text-sm font-medium text-slate-700">
                    Site ou landing page
                  </label>
                  <input
                    id="website"
                    type="url"
                    value={websiteUrl}
                    onChange={(event) => setWebsiteUrl(event.target.value)}
                    placeholder="https://votre-marque.com"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-700">Logo</p>
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                        {logoUrl ? (
                          <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
                        ) : (
                          <ImageIcon className="h-6 w-6 text-slate-400" />
                        )}
                      </div>
                      <div className="flex flex-1 flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowLogoUploader(true);
                          }}
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-600"
                        >
                          <Upload size={16} />
                          {logoUrl ? 'Mettre à jour le logo' : 'Uploader un logo'}
                        </button>
                        {logoUrl && (
                          <button
                            type="button"
                            onClick={() => setLogoUrl(null)}
                            className="text-left text-xs font-medium text-red-500 hover:text-red-600"
                          >
                            Supprimer le logo
                          </button>
                        )}
                      </div>
                    </div>

                    {showLogoUploader && (
                      <div className="rounded-xl border border-dashed border-slate-300 p-4">
                        {uploadingLogo ? (
                          <div className="flex flex-col items-center gap-3 text-slate-500">
                            <Loader2 className="h-6 w-6 animate-spin" />
                            <p className="text-sm">Téléchargement du logo…</p>
                          </div>
                        ) : (
                          <>
                            <MediaUploader
                              bucket="sponsors"
                              path={`${profile.id}/logo`}
                              onUploadStart={() => setUploadingLogo(true)}
                              onUploadEnd={() => setUploadingLogo(false)}
                              onUploadComplete={(url) => {
                                setLogoUrl(url);
                                setShowLogoUploader(false);
                              }}
                              onError={(message) => {
                                alert(message);
                                setUploadingLogo(false);
                                setShowLogoUploader(false);
                              }}
                              enableCrop
                              cropAspectRatio={1}
                              compressionOptions={{ maxWidth: 800, maxHeight: 800, quality: 0.9, maxSizeMB: 2 }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setShowLogoUploader(false);
                                setUploadingLogo(false);
                              }}
                              className="mt-3 text-xs font-medium text-slate-500 hover:text-slate-700"
                            >
                              Annuler
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-700">Bannière / cover</p>
                    <div className="relative h-28 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                      {bannerUrl ? (
                        <img src={bannerUrl} alt="Bannière" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-400">
                          <ImageIcon className="h-6 w-6" />
                          <span className="text-xs">Aucune bannière</span>
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 p-2">
                        <button
                          type="button"
                          onClick={() => setShowBannerUploader(true)}
                          className="inline-flex items-center gap-2 rounded-lg bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-slate-900"
                        >
                          <Upload size={14} />
                          {bannerUrl ? 'Mettre à jour' : 'Ajouter'}
                        </button>
                        {bannerUrl && (
                          <button
                            type="button"
                            onClick={() => setBannerUrl(null)}
                            className="rounded-lg bg-white/70 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-white"
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
                    </div>

                    {showBannerUploader && (
                      <div className="rounded-xl border border-dashed border-slate-300 p-4">
                        {uploadingBanner ? (
                          <div className="flex flex-col items-center gap-3 text-slate-500">
                            <Loader2 className="h-6 w-6 animate-spin" />
                            <p className="text-sm">Téléchargement de la bannière…</p>
                          </div>
                        ) : (
                          <>
                            <MediaUploader
                              bucket="sponsors"
                              path={`${profile.id}/banner`}
                              onUploadStart={() => setUploadingBanner(true)}
                              onUploadEnd={() => setUploadingBanner(false)}
                              onUploadComplete={(url) => {
                                setBannerUrl(url);
                                setShowBannerUploader(false);
                              }}
                              onError={(message) => {
                                alert(message);
                                setUploadingBanner(false);
                                setShowBannerUploader(false);
                              }}
                              enableCrop
                              cropAspectRatio={3.2}
                              compressionOptions={{ maxWidth: 2000, maxHeight: 750, quality: 0.9, maxSizeMB: 4 }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setShowBannerUploader(false);
                                setUploadingBanner(false);
                              }}
                              className="mt-3 text-xs font-medium text-slate-500 hover:text-slate-700"
                            >
                              Annuler
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="space-y-4 rounded-2xl border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Contact sponsoring</h3>
                    <p className="text-sm text-slate-500">
                      Donnez aux riders et organisateurs un point de contact direct pour vos programmes.
                    </p>
                  </div>
                  <Mail className="hidden text-orange-500 md:block" size={22} />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="contactName" className="text-sm font-medium text-slate-700">
                      Nom du contact / équipe
                    </label>
                    <input
                      id="contactName"
                      type="text"
                      value={contactName}
                      onChange={(event) => setContactName(event.target.value)}
                      placeholder="Equipe sponsoring"
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="contactEmail" className="text-sm font-medium text-slate-700">
                      Email principal
                    </label>
                    <input
                      id="contactEmail"
                      type="email"
                      value={contactEmail}
                      onChange={(event) => setContactEmail(event.target.value)}
                      required
                      placeholder="partenariats@votre-marque.com"
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="contactPhone" className="text-sm font-medium text-slate-700">
                      Téléphone
                    </label>
                    <input
                      id="contactPhone"
                      type="tel"
                      value={contactPhone}
                      onChange={(event) => setContactPhone(event.target.value)}
                      placeholder="+33 6 12 34 56 78"
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="contactLanguage" className="text-sm font-medium text-slate-700">
                      Langue préférée
                    </label>
                    <select
                      id="contactLanguage"
                      value={contactLanguage}
                      onChange={(event) => setContactLanguage(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="">Sélectionnez une langue</option>
                      {LANGUAGE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="contactAddress" className="text-sm font-medium text-slate-700">
                    Adresse / localisation
                  </label>
                  <textarea
                    id="contactAddress"
                    value={contactAddress}
                    onChange={(event) => setContactAddress(event.target.value)}
                    rows={2}
                    placeholder="Quartier général, ville, pays…"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </section>

              <section className="space-y-4 rounded-2xl border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Présence digitale</h3>
                    <p className="text-sm text-slate-500">
                      Ajoutez vos canaux clés pour que les riders puissent explorer votre univers.
                    </p>
                  </div>
                  <LinkIcon className="hidden text-orange-500 md:block" size={22} />
                </div>

                <div className="grid gap-4">
                  {SOCIAL_PLATFORMS.map((platform) => (
                    <div key={platform.key} className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-slate-700">{platform.label}</label>
                      <input
                        type="url"
                        value={socialLinks[platform.key] ?? ''}
                        onChange={(event) => handleSocialLinkChange(platform.key, event.target.value)}
                        placeholder={platform.placeholder}
                        className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>

          <aside className="border-t border-slate-200 bg-slate-50 p-6 lg:h-full lg:w-[380px] lg:border-l lg:border-t-0 lg:overflow-y-auto">
            <div className="sticky top-0 flex flex-col gap-5">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Prévisualisation live</h3>
                <SponsorProfileHero profile={previewProfile} />
              </div>

              {bannerUrl && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm">
                  <img src={bannerUrl} alt="Bannière" className="h-32 w-full object-cover" />
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-white text-slate-900 p-4 shadow-sm">
                <h4 className="text-sm font-semibold text-slate-700">Contact</h4>
                <div className="mt-3 space-y-3 text-sm">
                  <div className="flex items-start gap-2 text-slate-600">
                    <Mail size={16} className="mt-0.5 text-orange-500" />
                    <span>{previewContact.email || 'Email non défini'}</span>
                  </div>
                  {previewContact.phone && (
                    <div className="flex items-start gap-2 text-slate-600">
                      <Phone size={16} className="mt-0.5 text-orange-500" />
                      <span>{previewContact.phone}</span>
                    </div>
                  )}
                  {previewContact.address && (
                    <div className="flex items-start gap-2 text-slate-600">
                      <MapPin size={16} className="mt-0.5 text-orange-500" />
                      <span>{previewContact.address}</span>
                    </div>
                  )}
                  {previewBranding.website_url && (
                    <div className="flex items-start gap-2 text-slate-600">
                      <Globe size={16} className="mt-0.5 text-orange-500" />
                      <span>{previewBranding.website_url}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white text-slate-900 p-4 shadow-sm">
                <h4 className="text-sm font-semibold text-slate-700">Couleurs</h4>
                <div className="mt-3 flex items-center gap-3">
                  <div
                    className="flex flex-1 flex-col items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3"
                    style={{ background: previewBranding.primary_color ?? DEFAULT_PRIMARY_COLOR }}
                  >
                    <span className="text-xs font-semibold text-white/90">Primaire</span>
                    <span className="text-[10px] uppercase tracking-wide text-white/80">
                      {previewBranding.primary_color ?? DEFAULT_PRIMARY_COLOR}
                    </span>
                  </div>
                  <div
                    className="flex flex-1 flex-col items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3"
                    style={{ background: previewBranding.secondary_color ?? DEFAULT_SECONDARY_COLOR }}
                  >
                    <span className="text-xs font-semibold text-white/90">Secondaire</span>
                    <span className="text-[10px] uppercase tracking-wide text-white/80">
                      {previewBranding.secondary_color ?? DEFAULT_SECONDARY_COLOR}
                    </span>
                  </div>
                </div>
              </div>

              {Object.keys(sanitizedSocialLinks).length > 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white text-slate-900 p-4 shadow-sm">
                  <h4 className="text-sm font-semibold text-slate-700">Réseaux</h4>
                  <ul className="mt-3 space-y-2 text-sm text-slate-600">
                    {Object.entries(sanitizedSocialLinks).map(([key, value]) => (
                      <li key={key} className="truncate">
                        <span className="font-medium capitalize text-slate-700">{key}:</span> {value}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </aside>

          <div className="flex items-center gap-4 border-t border-slate-200 px-6 py-5 lg:hidden">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || uploadingLogo || uploadingBanner}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sauvegarde…
                </>
              ) : (
                'Enregistrer'
              )}
            </button>
          </div>
          <div className="hidden items-center gap-4 border-t border-slate-200 px-6 py-5 lg:flex">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || uploadingLogo || uploadingBanner}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sauvegarde…
                </>
              ) : (
                'Enregistrer'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
