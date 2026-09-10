-- Chart: daily volume + swap count
-- Canonical query ID: 8666293

SELECT
    DATE_TRUNC('day', block_time) AS date,
    SUM(volume_usd) AS daily_volume_usd,
    COUNT(*) AS swap_count
FROM query_8666293
GROUP BY 1
ORDER BY 1
