-- ============================================
-- TRC Database Migration: Add Flight Listings
-- Run this in your Supabase SQL Editor
-- Safe to re-run: every statement is idempotent
-- ============================================

-- 1. Create flight_listings table
CREATE TABLE IF NOT EXISTS flight_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  departure_country TEXT NOT NULL,
  arrival_country TEXT NOT NULL,
  departure_city TEXT,
  arrival_city TEXT,
  departure_date DATE NOT NULL,
  arrival_date DATE NOT NULL,
  available_kgs NUMERIC(5,2) NOT NULL CHECK (available_kgs > 0),
  price_per_kg NUMERIC(10,2) NOT NULL CHECK (price_per_kg >= 0),
  currency TEXT DEFAULT 'CNY',
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_flight_listings_arrival_country ON flight_listings(arrival_country);
CREATE INDEX IF NOT EXISTS idx_flight_listings_departure_country ON flight_listings(departure_country);
CREATE INDEX IF NOT EXISTS idx_flight_listings_departure_date ON flight_listings(departure_date);
CREATE INDEX IF NOT EXISTS idx_flight_listings_arrival_date ON flight_listings(arrival_date);
CREATE INDEX IF NOT EXISTS idx_flight_listings_user_id ON flight_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_flight_listings_is_active ON flight_listings(is_active);
CREATE INDEX IF NOT EXISTS idx_flight_listings_created_at ON flight_listings(created_at DESC);

-- Trigger to auto-update updated_at on flight_listings
CREATE OR REPLACE FUNCTION update_flight_listings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_flight_listings_updated_at_trigger ON flight_listings;
CREATE TRIGGER update_flight_listings_updated_at_trigger
  BEFORE UPDATE ON flight_listings
  FOR EACH ROW
  EXECUTE FUNCTION update_flight_listings_updated_at();

-- 2. Enable Row Level Security
ALTER TABLE flight_listings ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies

-- Public read access for active listings (owners always see their own,
-- including deactivated ones)
DROP POLICY IF EXISTS "Public read access to active flight listings" ON flight_listings;
CREATE POLICY "Public read access to active flight listings"
  ON flight_listings
  FOR SELECT
  TO public
  USING (is_active = true OR auth.uid() = user_id);

-- Authenticated users can create flight listings
DROP POLICY IF EXISTS "Authenticated insert access to flight listings" ON flight_listings;
CREATE POLICY "Authenticated insert access to flight listings"
  ON flight_listings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own flight listings
DROP POLICY IF EXISTS "Authenticated update access to own flight listings" ON flight_listings;
CREATE POLICY "Authenticated update access to own flight listings"
  ON flight_listings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own flight listings
DROP POLICY IF EXISTS "Authenticated delete access to own flight listings" ON flight_listings;
CREATE POLICY "Authenticated delete access to own flight listings"
  ON flight_listings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. Create a view that joins flight_listings with profile information
-- SECURITY: security_invoker makes the view respect RLS on the underlying
-- tables. profiles is readable by authenticated users only, so anonymous
-- visitors get NULL for all profile columns (display name, avatar and
-- social handles) instead of the view leaking them past RLS.
DROP VIEW IF EXISTS flight_listings_with_profile;
CREATE VIEW flight_listings_with_profile
  WITH (security_invoker = true) AS
SELECT 
  fl.id,
  fl.user_id,
  fl.departure_country,
  fl.arrival_country,
  fl.departure_city,
  fl.arrival_city,
  fl.departure_date,
  fl.arrival_date,
  fl.available_kgs,
  fl.price_per_kg,
  fl.currency,
  fl.notes,
  fl.is_active,
  fl.created_at,
  fl.updated_at,
  p.display_name,
  p.avatar_url,
  -- Normalize legacy rows that stored a single object instead of an array
  CASE
    WHEN jsonb_typeof(p.social_handles) = 'array' THEN p.social_handles
    WHEN jsonb_typeof(p.social_handles) = 'object' THEN jsonb_build_array(p.social_handles)
    ELSE '[]'::jsonb
  END AS social_handles,
  p.show_social_handle
FROM flight_listings fl
LEFT JOIN profiles p ON fl.user_id = p.id;

-- Grant access to the view (anon still sees only NULL profile columns via RLS)
GRANT SELECT ON flight_listings_with_profile TO anon;
GRANT SELECT ON flight_listings_with_profile TO authenticated;

-- 4b. One-time normalization of legacy single-object social_handles on
-- profiles so every row matches the array format the app expects.
UPDATE profiles
SET social_handles = jsonb_build_array(social_handles)
WHERE jsonb_typeof(social_handles) = 'object';

-- 5. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- ============================================
-- COMPLETED
-- ============================================
