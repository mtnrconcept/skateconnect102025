import type {
  Profile,
  SponsorBranding,
  SponsorContactInfo,
  SponsorPermissions,
} from '../types';

export const demoSponsorBranding: SponsorBranding = {
  brand_name: 'Shredloc Partner Lab',
  tagline: 'Campagnes créatives pour rider la scène.',
  website_url: 'https://shredloc.example/sponsor-lab',
  primary_color: '#FF7849',
  secondary_color: '#1E1B4B',
  social_links: {
    instagram: '@shredloc_partner_lab',
    linkedin: 'linkedin.com/company/shredloc-partner-lab',
  },
};

export const demoSponsorContact: SponsorContactInfo = {
  email: 'sponsor@shredloc.example',
  phone: '+33 6 12 34 56 78',
  contact_name: 'Equipe Partenariats',
  language: 'fr',
};

export const demoSponsorPermissions: SponsorPermissions = {
  canAccessAnalytics: true,
  canManageSpotlights: true,
  canManageShop: true,
  canManageApiKeys: true,
  canManageOpportunities: true,
};

export const sponsorModeHighlights = [
  'Cockpit analytics en temps réel pour suivre les riders engagés.',
  'Gestion des Spotlight, campagnes et inventaire boutique en un endroit.',
  'Accès aux clés API marketing pour activer des intégrations externes.',
];

export function buildSponsorExperienceProfile(profile: Profile): Profile {
  const mergedPermissions: SponsorPermissions = {
    ...(profile.sponsor_permissions ?? {}),
    ...demoSponsorPermissions,
  };

  return {
    ...profile,
    role: 'sponsor',
    sponsor_permissions: mergedPermissions,
    sponsor_branding: profile.sponsor_branding ?? demoSponsorBranding,
    sponsor_contact: profile.sponsor_contact ?? demoSponsorContact,
  };
}
