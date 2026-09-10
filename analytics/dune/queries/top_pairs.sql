SELECT
    pair,
    SUM(volume_usd) AS volume_usd,
    COUNT(*) AS swaps,
    COUNT(DISTINCT user) AS traders
FROM {{ ref('Accrued — Canonical Swaps') }}
GROUP BY 1
ORDER BY volume_usd DESC
LIMIT 20
