-- Rolling 24h volume
-- Canonical query ID: 8666293

SELECT SUM(volume_usd) AS volume_24h_usd
FROM query_8666293
WHERE block_time >= NOW() - INTERVAL '24' HOUR
