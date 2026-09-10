SELECT SUM(volume_usd) AS volume_24h_usd
FROM {{ ref('Accrued — Canonical Swaps') }}
WHERE block_time >= NOW() - INTERVAL '24' HOUR
