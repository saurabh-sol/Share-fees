SELECT
    DATE_TRUNC('day', block_time) AS date,
    SUM(volume_usd) AS daily_volume_usd,
    COUNT(*) AS swap_count
FROM {{ ref('Accrued — Canonical Swaps') }}
GROUP BY 1
ORDER BY 1
