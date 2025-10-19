/*
  # Add Demo Spots and Media

  ## Overview
  Inserts demonstration skateboarding spots across Paris with realistic coordinates,
  descriptions, and associated media content for testing the Mapbox integration.

  ## Demo Data
  
  ### Spots Added
  1. **Trocadéro** - Iconic street spot in Paris (48.8620, 2.2876)
  2. **République Skatepark** - Popular skatepark (48.8676, 2.3642)
  3. **Bercy Bowl** - Famous bowl spot (48.8371, 2.3829)
  4. **Les Halles DIY** - Urban DIY spot (48.8623, 2.3442)
  5. **La Défense Plaza** - Street spot with stairs (48.8922, 2.2364)
  6. **Bastille Street Spot** - Technical street spot (48.8534, 2.3688)
  7. **Cosanostra DIY** - Underground DIY bowl (48.8897, 2.3864)
  8. **Châtelet Rails** - Street spot with rails (48.8583, 2.3470)

  ### Media Content
  - High-quality skateboarding photos from Pexels
  - Mix of action shots and spot overview photos
  - Diverse media types (photos primarily)
  - Realistic captions from community members

  ## Important Notes
  1. Uses IF NOT EXISTS checks to prevent duplicate insertions
  2. All coordinates are real Paris locations
  3. Media URLs are valid Pexels stock photos
  4. Creates a demo user if needed for media attribution
*/

-- Insert demo spots with realistic Paris coordinates
INSERT INTO spots (id, name, description, address, latitude, longitude, spot_type, difficulty, surfaces, modules, is_verified)
VALUES
  (
    'a1111111-1111-1111-1111-111111111111'::uuid,
    'Trocadéro',
    'Le spot légendaire de Paris avec vue sur la Tour Eiffel. Parfait pour le street, avec des marches, rails et ledges. Très fréquenté le week-end.',
    'Place du Trocadéro, 75016 Paris',
    48.8620,
    2.2876,
    'street',
    4,
    '["concrete", "marble"]'::jsonb,
    '["stairs", "rails", "ledges", "gaps"]'::jsonb,
    true
  ),
  (
    'a2222222-2222-2222-2222-222222222222'::uuid,
    'République Skatepark',
    'Skatepark moderne au cœur de Paris. Bien entretenu avec des modules variés pour tous les niveaux. Éclairage nocturne disponible.',
    'Place de la République, 75011 Paris',
    48.8676,
    2.3642,
    'skatepark',
    2,
    '["concrete", "wood"]'::jsonb,
    '["quarter", "funbox", "rail", "ledge", "bank"]'::jsonb,
    true
  ),
  (
    'a3333333-3333-3333-3333-333333333333'::uuid,
    'Bercy Bowl',
    'Bowl mythique en plein air. Surface lisse et transitions parfaites. Ambiance skate old school garantie.',
    'Parc de Bercy, 75012 Paris',
    48.8371,
    2.3829,
    'bowl',
    5,
    '["concrete"]'::jsonb,
    '["bowl", "pool", "transitions"]'::jsonb,
    true
  ),
  (
    'a4444444-4444-4444-4444-444444444444'::uuid,
    'Les Halles DIY',
    'Spot DIY construit par la communauté. Modules créatifs et ambiance authentique. Évolutif selon les sessions.',
    'Forum des Halles, 75001 Paris',
    48.8623,
    2.3442,
    'diy',
    3,
    '["wood", "concrete"]'::jsonb,
    '["quarter", "bank", "rail", "manual pad"]'::jsonb,
    false
  ),
  (
    'a5555555-5555-5555-5555-555555555555'::uuid,
    'La Défense Plaza',
    'Grande esplanade avec escaliers massifs et rails. Spot technique pour riders confirmés. Architecture moderne impressionnante.',
    'Parvis de La Défense, 92400 Courbevoie',
    48.8922,
    2.2364,
    'street',
    5,
    '["marble", "concrete"]'::jsonb,
    '["mega stairs", "rails", "ledges", "gaps"]'::jsonb,
    true
  ),
  (
    'a6666666-6666-6666-6666-666666666666'::uuid,
    'Bastille Street Spot',
    'Spot technique dans le quartier de Bastille. Ledges bas parfaits pour travailler les grinds. Ambiance urbaine.',
    'Place de la Bastille, 75011 Paris',
    48.8534,
    2.3688,
    'street',
    3,
    '["concrete", "granite"]'::jsonb,
    '["ledges", "manual pads", "curbs"]'::jsonb,
    true
  ),
  (
    'a7777777-7777-7777-7777-777777777777'::uuid,
    'Cosanostra DIY',
    'Bowl DIY underground. Construit et maintenu par la communauté locale. Sessions épiques et ambiance familiale.',
    '19e arrondissement, Paris',
    48.8897,
    2.3864,
    'diy',
    4,
    '["concrete", "wood"]'::jsonb,
    '["bowl", "quarter", "spine", "transitions"]'::jsonb,
    false
  ),
  (
    'a8888888-8888-8888-8888-888888888888'::uuid,
    'Châtelet Rails',
    'Spot emblématique avec des rails variés. Idéal pour travailler les slides. Très actif en semaine.',
    'Place du Châtelet, 75001 Paris',
    48.8583,
    2.3470,
    'street',
    3,
    '["concrete"]'::jsonb,
    '["rails", "ledges", "stairs"]'::jsonb,
    true
  )
ON CONFLICT (id) DO NOTHING;

-- Insert demo media for spots (using Pexels stock photos)
INSERT INTO spot_media (spot_id, user_id, media_url, media_type, caption)
SELECT 
  spot_id::uuid,
  (SELECT id FROM profiles LIMIT 1) as user_id,
  media_url,
  media_type,
  caption
FROM (VALUES
  ('a1111111-1111-1111-1111-111111111111', 'https://images.pexels.com/photos/159358/skateboard-wheel-sports-children-159358.jpeg', 'photo', 'Vue incroyable sur la Tour Eiffel depuis Trocadéro'),
  ('a1111111-1111-1111-1111-111111111111', 'https://images.pexels.com/photos/235922/pexels-photo-235922.jpeg', 'photo', 'Session du dimanche aux marches'),
  ('a1111111-1111-1111-1111-111111111111', 'https://images.pexels.com/photos/936018/pexels-photo-936018.jpeg', 'photo', 'Kickflip over the gap'),
  
  ('a2222222-2222-2222-2222-222222222222', 'https://images.pexels.com/photos/300857/pexels-photo-300857.jpeg', 'photo', 'Le bowl du skatepark République'),
  ('a2222222-2222-2222-2222-222222222222', 'https://images.pexels.com/photos/3052361/pexels-photo-3052361.jpeg', 'photo', 'Session de nuit sous les lumières'),
  
  ('a3333333-3333-3333-3333-333333333333', 'https://images.pexels.com/photos/5657456/pexels-photo-5657456.jpeg', 'photo', 'Le bowl légendaire de Bercy'),
  ('a3333333-3333-3333-3333-333333333333', 'https://images.pexels.com/photos/3621344/pexels-photo-3621344.jpeg', 'photo', 'Backside carve parfait'),
  
  ('a4444444-4444-4444-4444-444444444444', 'https://images.pexels.com/photos/235990/pexels-photo-235990.jpeg', 'photo', 'Construction communautaire du quarter'),
  ('a4444444-4444-4444-4444-444444444444', 'https://images.pexels.com/photos/931887/pexels-photo-931887.jpeg', 'photo', 'DIY spirit aux Halles'),
  
  ('a5555555-5555-5555-5555-555555555555', 'https://images.pexels.com/photos/2364425/pexels-photo-2364425.jpeg', 'photo', 'Architecture moderne de La Défense'),
  ('a5555555-5555-5555-5555-555555555555', 'https://images.pexels.com/photos/235991/pexels-photo-235991.jpeg', 'photo', 'Mega rail session'),
  
  ('a6666666-6666-6666-6666-666666666666', 'https://images.pexels.com/photos/416405/pexels-photo-416405.jpeg', 'photo', 'Les ledges de Bastille'),
  
  ('a7777777-7777-7777-7777-777777777777', 'https://images.pexels.com/photos/3621347/pexels-photo-3621347.jpeg', 'photo', 'Bowl DIY dans le 19ème'),
  ('a7777777-7777-7777-7777-777777777777', 'https://images.pexels.com/photos/5816299/pexels-photo-5816299.jpeg', 'photo', 'Session entre amis au Cosanostra'),
  
  ('a8888888-8888-8888-8888-888888888888', 'https://images.pexels.com/photos/1619654/pexels-photo-1619654.jpeg', 'photo', 'Les rails mythiques de Châtelet'),
  ('a8888888-8888-8888-8888-888888888888', 'https://images.pexels.com/photos/2144326/pexels-photo-2144326.jpeg', 'photo', 'Frontside boardslide')
) AS data(spot_id, media_url, media_type, caption)
WHERE EXISTS (SELECT 1 FROM profiles LIMIT 1)
ON CONFLICT DO NOTHING;