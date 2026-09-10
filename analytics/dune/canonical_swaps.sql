-- Accrued — Canonical Swaps
-- One row per AccruedSwap event. All dashboard queries should SELECT FROM this CTE or a saved query version.
--
-- Uses robinhood.logs (works before Dune contract decode finishes).
-- After decode is live, you may switch raw_swaps to:
--   FROM robinhood.accruedswaprouter_evt_AccruedSwap
-- (confirm exact table name in Dune Data Explorer → Search "AccruedSwap")

WITH raw_swaps AS (
    SELECT
        block_time,
        block_number,
        tx_hash,
        index AS evt_index,
        varbinary_substring(topic1, 13, 20) AS "user",
        varbinary_substring(topic2, 13, 20) AS token_in,
        varbinary_substring(topic3, 13, 20) AS token_out,
        bytearray_to_uint256(bytearray_substring(data, 1, 32)) AS amount_in_raw,
        bytearray_to_uint256(bytearray_substring(data, 33, 32)) AS amount_out_raw,
        varbinary_substring(bytearray_substring(data, 65, 32), 13, 20) AS recipient
    FROM robinhood.logs
    WHERE contract_address = 0xc78e883f87675e75334df4d341f6fcb0915ebf19
      AND topic0 = 0x02af581b08266c263f4af271e385893d78e2f4d569e17b387178a0eb119b54a4
      AND block_number >= 59334164
),

priced AS (
    SELECT
        s.block_time,
        s.block_number,
        s.tx_hash,
        s.evt_index,
        s."user" AS user,
        s.token_in,
        s.token_out,
        s.amount_in_raw,
        s.amount_out_raw,
        s.amount_in_raw / POWER(10, COALESCE(meta_in.decimals, 18)) AS amount_in,
        s.amount_out_raw / POWER(10, COALESCE(meta_out.decimals, 18)) AS amount_out,
        COALESCE(meta_in.symbol, 'UNKNOWN') AS token_in_symbol,
        COALESCE(meta_out.symbol, 'UNKNOWN') AS token_out_symbol,
        CASE
            WHEN s.token_in = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168 THEN s.amount_in_raw / 1e6
            WHEN s.token_out = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168 THEN s.amount_out_raw / 1e6
            WHEN s.token_in = 0xE246BC49b0598d7Cd9f0eAD48B885034f1254380 THEN s.amount_in_raw / 1e6
            WHEN s.token_out = 0xE246BC49b0598d7Cd9f0eAD48B885034f1254380 THEN s.amount_out_raw / 1e6
            ELSE (s.amount_in_raw / POWER(10, COALESCE(meta_in.decimals, 18))) * COALESCE(px.price, 0)
        END AS volume_usd,
        0 AS fee_usd,
        CONCAT(
            COALESCE(meta_in.symbol, SUBSTRING(CAST(s.token_in AS VARCHAR), 1, 10)),
            '/',
            COALESCE(meta_out.symbol, SUBSTRING(CAST(s.token_out AS VARCHAR), 1, 10))
        ) AS pair
    FROM raw_swaps s
    LEFT JOIN tokens.erc20 meta_in
        ON meta_in.blockchain = 'robinhood'
        AND meta_in.contract_address = s.token_in
    LEFT JOIN tokens.erc20 meta_out
        ON meta_out.blockchain = 'robinhood'
        AND meta_out.contract_address = s.token_out
    LEFT JOIN prices.usd px
        ON px.blockchain = 'robinhood'
        AND px.contract_address = s.token_in
        AND px.minute = DATE_TRUNC('minute', s.block_time)
)

SELECT
    block_time,
    block_number,
    tx_hash,
    evt_index,
    user,
    token_in,
    token_out,
    token_in_symbol,
    token_out_symbol,
    amount_in,
    amount_out,
    volume_usd,
    fee_usd,
    pair
FROM priced
WHERE volume_usd > 0
