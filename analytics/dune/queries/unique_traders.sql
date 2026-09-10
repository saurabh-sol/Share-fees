SELECT COUNT(DISTINCT user) AS unique_traders
FROM {{ ref('Accrued — Canonical Swaps') }}
