-- Top trading pairs by volume
-- Canonical query ID: 8666293

SELECT
    pair,
    SUM(volume_usd) AS volume_usd,
    COUNT(*) AS swaps,
    COUNT(DISTINCT user) AS traders
FROM query_8666293
GROUP BY 1
ORDER BY volume_usd DESC
LIMIT 20
