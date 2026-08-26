-- Arabic search folding.
--
-- The catalogue stores names as written: "أرز بسمتي", "جبن موزاريلا". A buyer
-- types "الأرز" or "لجبن" — a different hamza, and an article glued to the
-- front. Comparing the raw strings misses every one of those, so both sides
-- are folded to the same skeleton before they meet.
--
-- IMMUTABLE is what lets this be indexed later; it only depends on its input.
CREATE OR REPLACE FUNCTION waw_fold(txt text) RETURNS text
  LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
    SELECT translate(
             regexp_replace(lower(txt), '[ً-ْٰ]', '', 'g'),
             'أإآةى',
             'اااهي'
           )
  $$;

CREATE INDEX IF NOT EXISTS products_name_ar_folded_idx
  ON products (waw_fold(name_ar) text_pattern_ops);
CREATE INDEX IF NOT EXISTS products_name_en_folded_idx
  ON products (waw_fold(name_en) text_pattern_ops);
