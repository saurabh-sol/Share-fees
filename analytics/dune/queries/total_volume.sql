-- Total Accrued volume since router launch
-- 1. Save canonical_swaps.sql on Dune first (name it "Accrued Canonical Swaps")
-- 2. Copy the query ID from the URL: dune.com/queries/1234567 → 1234567
-- Canonical query ID: 8666293 (https://dune.com/queries/8666293)

SELECT SUM(volume_usd) AS total_volume_usd
FROM query_8666293
