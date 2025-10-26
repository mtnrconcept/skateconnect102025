import type { ShopFrontItem } from '../types';

export interface ShopFallbackMetadata extends Record<string, unknown> {
  asin: string;
  externalProductUrl: string;
  externalCheckoutUrl?: string;
  variantCheckoutUrls?: Record<string, string>;
  paymentMode: 'external';
  tagline?: string;
}

function createMetadata(metadata: ShopFallbackMetadata): ShopFallbackMetadata {
  const { variantCheckoutUrls, ...rest } = metadata;
  return {
    ...rest,
    ...(variantCheckoutUrls ? { variantCheckoutUrls: { ...variantCheckoutUrls } } : {}),
  };
}

function cloneMetadata(metadata: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!metadata) {
    return null;
  }
  const typed = metadata as ShopFallbackMetadata;
  return createMetadata({
    asin: typed.asin,
    externalProductUrl: typed.externalProductUrl,
    externalCheckoutUrl: typed.externalCheckoutUrl,
    variantCheckoutUrls: typed.variantCheckoutUrls ? { ...typed.variantCheckoutUrls } : undefined,
    paymentMode: 'external',
    tagline: typed.tagline,
  });
}

const now = new Date();
const availabilityStart = new Date('2024-01-10T00:00:00.000Z').toISOString();
const availabilityExtended = new Date('2024-12-31T23:59:59.000Z').toISOString();
const seasonalDropStart = new Date('2024-03-01T00:00:00.000Z').toISOString();
const seasonalDropEnd = new Date('2024-09-30T23:59:59.000Z').toISOString();

export const SHOP_CATALOG_FALLBACK: ShopFrontItem[] = [
  {
    id: 'amazon-element-section-complete-80',
    sponsorId: 'element-fr',
    name: 'Element Section – Planche de skateboard complète 8.0"',
    description:
      "Setup complet Element Section 8.0'' avec trucks Element Raw, roues 52 mm et roulements ABEC 5 pour un ride polyvalent dès la sortie de la boîte.",
    priceCents: 12995,
    currency: 'EUR',
    stock: 12,
    imageUrl: 'https://m.media-amazon.com/images/I/71pSXI3f9bL._AC_SL1500_.jpg',
    availableFrom: availabilityStart,
    availableUntil: availabilityExtended,
    metadata: createMetadata({
      asin: 'B08DH2YG3D',
      externalProductUrl: 'https://www.amazon.fr/dp/B08DH2YG3D',
      externalCheckoutUrl: 'https://www.amazon.fr/dp/B08DH2YG3D?th=1',
      paymentMode: 'external',
      tagline: 'Livraison Prime 24h – montage prêt à rider',
    }),
    sponsor: {
      id: 'element-fr',
      displayName: 'Element France',
      brandName: 'Element Skateboards',
      primaryColor: '#FF4F00',
      secondaryColor: '#1A1A1A',
      logoUrl: 'https://m.media-amazon.com/images/I/51Xf0Xi6wRL._AC_SX679_.jpg',
      stripeReady: true,
    },
    variants: [],
  },
  {
    id: 'amazon-powell-peralta-dragon-formula',
    sponsorId: 'powell-peralta-eu',
    name: 'Powell Peralta Dragon Formula – Roues skateboard 52/54/56 mm',
    description:
      "La gomme Dragon Formula DF 93A adhère comme une roue molle tout en glissant comme une 101A. Pack de quatre roues, parfait pour les curbs et bowls.",
    priceCents: 7390,
    currency: 'EUR',
    stock: 32,
    imageUrl: 'https://m.media-amazon.com/images/I/61-0hGg7P5L._AC_SX679_.jpg',
    availableFrom: seasonalDropStart,
    availableUntil: seasonalDropEnd,
    metadata: createMetadata({
      asin: 'B09V7TXYR7',
      externalProductUrl: 'https://www.amazon.fr/dp/B09V7TXYR7',
      externalCheckoutUrl: 'https://www.amazon.fr/dp/B09V7TXYR7?th=1',
      paymentMode: 'external',
      variantCheckoutUrls: {
        'powell-df-52': 'https://www.amazon.fr/dp/B09V7TXYR7?th=1&psc=1',
        'powell-df-54': 'https://www.amazon.fr/dp/B09V7TMNYM?th=1&psc=1',
        'powell-df-56': 'https://www.amazon.fr/dp/B09V7THXRS?th=1&psc=1',
      },
      tagline: 'Dragon Formula DF93A – toutes surfaces, zéro flatspot',
    }),
    sponsor: {
      id: 'powell-peralta-eu',
      displayName: 'Powell Peralta Europe',
      brandName: 'Powell Peralta',
      primaryColor: '#C2002F',
      secondaryColor: '#FCE300',
      logoUrl: 'https://m.media-amazon.com/images/I/61T9qKqRRqL._AC_SX679_.jpg',
      stripeReady: true,
    },
    variants: [
      {
        id: 'powell-df-52',
        name: '52 mm',
        size: '52 mm',
        color: 'Blanc',
        priceCents: 7290,
        stock: 10,
        imageUrl: 'https://m.media-amazon.com/images/I/61-0hGg7P5L._AC_SX679_.jpg',
        availabilityStart: seasonalDropStart,
        availabilityEnd: seasonalDropEnd,
      },
      {
        id: 'powell-df-54',
        name: '54 mm',
        size: '54 mm',
        color: 'Blanc',
        priceCents: 7390,
        stock: 12,
        imageUrl: 'https://m.media-amazon.com/images/I/61U7lA1NVHL._AC_SX679_.jpg',
        availabilityStart: seasonalDropStart,
        availabilityEnd: seasonalDropEnd,
      },
      {
        id: 'powell-df-56',
        name: '56 mm',
        size: '56 mm',
        color: 'Blanc',
        priceCents: 7590,
        stock: 10,
        imageUrl: 'https://m.media-amazon.com/images/I/61AqvGjNFdL._AC_SX679_.jpg',
        availabilityStart: seasonalDropStart,
        availabilityEnd: seasonalDropEnd,
      },
    ],
  },
  {
    id: 'amazon-bones-reds-bearings',
    sponsorId: 'bones-bearings',
    name: 'Bones Reds – Roulements skateboard (pack de 8)',
    description:
      'Roulements Bones Reds pré-lubrifiés Speed Cream, cages en nylon pour vitesse et durabilité. Idéal street et park.',
    priceCents: 2499,
    currency: 'EUR',
    stock: 48,
    imageUrl: 'https://m.media-amazon.com/images/I/61y5PjaVX5L._AC_SX679_.jpg',
    availableFrom: availabilityStart,
    availableUntil: availabilityExtended,
    metadata: createMetadata({
      asin: 'B000FDR0AO',
      externalProductUrl: 'https://www.amazon.fr/dp/B000FDR0AO',
      externalCheckoutUrl: 'https://www.amazon.fr/dp/B000FDR0AO?th=1',
      paymentMode: 'external',
      tagline: 'La référence mondiale des roulements abordables',
    }),
    sponsor: {
      id: 'bones-bearings',
      displayName: 'Bones Bearings',
      brandName: 'Bones',
      primaryColor: '#CC0000',
      secondaryColor: '#FFFFFF',
      logoUrl: 'https://m.media-amazon.com/images/I/61Q4vOB0MDL._AC_SX679_.jpg',
      stripeReady: true,
    },
    variants: [],
  },
  {
    id: 'amazon-santa-cruz-flame-dot-hoodie',
    sponsorId: 'santa-cruz-eu',
    name: 'Santa Cruz Flame Dot – Hoodie unisexe',
    description:
      'Sweat à capuche Santa Cruz Flame Dot en molleton 60/40, poche kangourou et sérigraphie iconique pour cruiser avec style.',
    priceCents: 7490,
    currency: 'EUR',
    stock: 24,
    imageUrl: 'https://m.media-amazon.com/images/I/71Bfw-0DpBL._AC_SY879_.jpg',
    availableFrom: availabilityStart,
    availableUntil: availabilityExtended,
    metadata: createMetadata({
      asin: 'B0B6QMSQJW',
      externalProductUrl: 'https://www.amazon.fr/dp/B0B6QMSQJW',
      externalCheckoutUrl: 'https://www.amazon.fr/dp/B0B6QMSQJW?th=1',
      paymentMode: 'external',
      variantCheckoutUrls: {
        'santa-cruz-hoodie-s': 'https://www.amazon.fr/dp/B0B6QMT6T8?th=1&psc=1',
        'santa-cruz-hoodie-m': 'https://www.amazon.fr/dp/B0B6QN3M76?th=1&psc=1',
        'santa-cruz-hoodie-l': 'https://www.amazon.fr/dp/B0B6QNTCGC?th=1&psc=1',
        'santa-cruz-hoodie-xl': 'https://www.amazon.fr/dp/B0B6QNCX97?th=1&psc=1',
      },
      tagline: 'Collection Santa Cruz Classics – coupe relax et sérigraphie premium',
    }),
    sponsor: {
      id: 'santa-cruz-eu',
      displayName: 'NHS Santa Cruz',
      brandName: 'Santa Cruz Skateboards',
      primaryColor: '#FFC700',
      secondaryColor: '#1C1C1C',
      logoUrl: 'https://m.media-amazon.com/images/I/71xKjV+ZwGL._AC_SY741_.jpg',
      stripeReady: true,
    },
    variants: [
      {
        id: 'santa-cruz-hoodie-s',
        name: 'Taille S',
        size: 'S',
        color: 'Noir',
        priceCents: 7490,
        stock: 6,
        imageUrl: 'https://m.media-amazon.com/images/I/71Bfw-0DpBL._AC_SY879_.jpg',
        availabilityStart: availabilityStart,
        availabilityEnd: availabilityExtended,
      },
      {
        id: 'santa-cruz-hoodie-m',
        name: 'Taille M',
        size: 'M',
        color: 'Noir',
        priceCents: 7490,
        stock: 8,
        imageUrl: 'https://m.media-amazon.com/images/I/71Bfw-0DpBL._AC_SY879_.jpg',
        availabilityStart: availabilityStart,
        availabilityEnd: availabilityExtended,
      },
      {
        id: 'santa-cruz-hoodie-l',
        name: 'Taille L',
        size: 'L',
        color: 'Noir',
        priceCents: 7490,
        stock: 6,
        imageUrl: 'https://m.media-amazon.com/images/I/71Bfw-0DpBL._AC_SY879_.jpg',
        availabilityStart: availabilityStart,
        availabilityEnd: availabilityExtended,
      },
      {
        id: 'santa-cruz-hoodie-xl',
        name: 'Taille XL',
        size: 'XL',
        color: 'Noir',
        priceCents: 7490,
        stock: 4,
        imageUrl: 'https://m.media-amazon.com/images/I/71Bfw-0DpBL._AC_SY879_.jpg',
        availabilityStart: availabilityStart,
        availabilityEnd: availabilityExtended,
      },
    ],
  },
  {
    id: 'amazon-globe-mahalo-shoes',
    sponsorId: 'globe-europe',
    name: 'Globe Mahalo – Chaussures de skate vegan Black/White',
    description:
      'Chaussures Globe Mahalo Black/White en toile vegan, semelle Shockbed™ et renforts ollie pour résister aux sessions quotidiennes.',
    priceCents: 6990,
    currency: 'EUR',
    stock: 18,
    imageUrl: 'https://m.media-amazon.com/images/I/71A73PvvrqL._AC_SY695_.jpg',
    availableFrom: availabilityStart,
    availableUntil: availabilityExtended,
    metadata: createMetadata({
      asin: 'B09SHF8QFS',
      externalProductUrl: 'https://www.amazon.fr/dp/B09SHF8QFS',
      externalCheckoutUrl: 'https://www.amazon.fr/dp/B09SHF8QFS?th=1',
      paymentMode: 'external',
      variantCheckoutUrls: {
        'globe-mahalo-41': 'https://www.amazon.fr/dp/B09SHF8QFS?th=1&psc=1',
        'globe-mahalo-42': 'https://www.amazon.fr/dp/B09SHG39J1?th=1&psc=1',
        'globe-mahalo-43': 'https://www.amazon.fr/dp/B09SHFS8YS?th=1&psc=1',
      },
      tagline: 'Semelle Shockbed™ + renforts ollie – approuvées par Mark Appleyard',
    }),
    sponsor: {
      id: 'globe-europe',
      displayName: 'Globe Europe',
      brandName: 'Globe Brand',
      primaryColor: '#1E1E1E',
      secondaryColor: '#E53935',
      logoUrl: 'https://m.media-amazon.com/images/I/61h3sZ3VebL._AC_SX679_.jpg',
      stripeReady: true,
    },
    variants: [
      {
        id: 'globe-mahalo-41',
        name: 'Pointure EU 41',
        size: '41',
        color: 'Noir/Blanc',
        priceCents: 6990,
        stock: 6,
        imageUrl: 'https://m.media-amazon.com/images/I/71A73PvvrqL._AC_SY695_.jpg',
        availabilityStart: availabilityStart,
        availabilityEnd: availabilityExtended,
      },
      {
        id: 'globe-mahalo-42',
        name: 'Pointure EU 42',
        size: '42',
        color: 'Noir/Blanc',
        priceCents: 6990,
        stock: 6,
        imageUrl: 'https://m.media-amazon.com/images/I/71A73PvvrqL._AC_SY695_.jpg',
        availabilityStart: availabilityStart,
        availabilityEnd: availabilityExtended,
      },
      {
        id: 'globe-mahalo-43',
        name: 'Pointure EU 43',
        size: '43',
        color: 'Noir/Blanc',
        priceCents: 6990,
        stock: 6,
        imageUrl: 'https://m.media-amazon.com/images/I/71A73PvvrqL._AC_SY695_.jpg',
        availabilityStart: availabilityStart,
        availabilityEnd: availabilityExtended,
      },
    ],
  },
];

function cloneShopItem(item: ShopFrontItem): ShopFrontItem {
  return {
    ...item,
    sponsor: { ...item.sponsor },
    variants: item.variants.map((variant) => ({ ...variant })),
    metadata: cloneMetadata(item.metadata),
  };
}

export function getFallbackCatalog(): ShopFrontItem[] {
  return SHOP_CATALOG_FALLBACK.map(cloneShopItem);
}

export function getFallbackShopItem(itemId: string): ShopFrontItem | undefined {
  return SHOP_CATALOG_FALLBACK.find((item) => item.id === itemId);
}

export function getFallbackVariantCheckoutUrl(
  item: ShopFrontItem,
  variantId: string | null | undefined,
): string | null {
  const metadata = (item.metadata ?? {}) as ShopFallbackMetadata;
  if (variantId && metadata.variantCheckoutUrls && metadata.variantCheckoutUrls[variantId]) {
    return metadata.variantCheckoutUrls[variantId];
  }
  return metadata.externalCheckoutUrl ?? metadata.externalProductUrl ?? null;
}

export function isFallbackCatalogActive(): boolean {
  return true;
}

export const FALLBACK_CATALOG_GENERATED_AT = now.toISOString();
