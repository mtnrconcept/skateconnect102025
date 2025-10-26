# Sponsor Shop Variants, Bundles, and Coupons

This document summarizes the new sponsor shop capabilities added in October 2025.

## Database schema

The Supabase migration `20251021193000_add_shop_variants_bundles_coupons.sql` introduces:

- Availability windows (`available_from` / `available_until`) on `sponsor_shop_items`.
- `sponsor_shop_item_variants` for storing color/size style options.
- `sponsor_shop_bundles` with `sponsor_shop_bundle_items` join records.
- `sponsor_shop_coupons` tracking fixed or percentage discounts.

RLS policies and triggers ensure that audit columns stay in sync with the existing shop tables.

## TypeScript domain models

The following interfaces model the new entities:

- `SponsorShopItemVariant`
- `SponsorShopBundle`
- `SponsorShopBundleItem`
- `SponsorShopCoupon`

See `src/types/index.ts` for the canonical definitions.

## Synchronisation helpers

`sponsorShop.ts` now contains helper methods to upsert/delete variants, bundles, and coupons. The sponsor context exposes these helpers via the `SponsorContext` so components can refresh state after mutations.

## UI integrations

- The sponsor dashboard renders accordion tables on each shop card to display variants, coupons, and bundles.
- `SponsorShopItemModal` allows configuring availability windows plus CRUD operations for the new entities.

Remember to run the Supabase migration before testing the UI.
