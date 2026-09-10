-- Total Accrued volume since router launch
SELECT SUM(volume_usd) AS total_volume_usd
FROM (
    -- Paste canonical_swaps.sql body or reference saved query "Accrued — Canonical Swaps"
    SELECT volume_usd FROM {{ ref('Accrued — Canonical Swaps') }}
) c
