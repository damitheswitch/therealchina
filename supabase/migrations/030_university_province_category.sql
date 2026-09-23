-- 030_university_province_category.sql
--
-- Two more directory fields on universities, populated by the 软科 merge:
--   province      — English province name ('Zhejiang'); city stays separate
--                   so the browse filter can offer province → city grouping
--   uni_category  — 软科 subject category normalised to English tokens
--                   (different axis than uni_type public/private)

ALTER TABLE public.universities
  ADD COLUMN IF NOT EXISTS province TEXT,
  ADD COLUMN IF NOT EXISTS uni_category TEXT CHECK (
    uni_category IS NULL OR uni_category IN (
      'comprehensive','stem','normal','agriculture','forestry','medicine',
      'finance','language','politics','ethnic','sports','arts','tcm',
      'cooperative','other'
    )
  );
