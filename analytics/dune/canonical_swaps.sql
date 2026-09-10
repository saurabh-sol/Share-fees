-- Accrued — Canonical Swaps
-- One row per AccruedSwap event. All dashboard queries should SELECT FROM this CTE or a saved query version.
--
-- After Dune decodes AccruedSwapRouter, replace `accruedswaprouter_evt_AccruedSwap` with the decoded table name.
-- Event topic0 (pre-decode fallback): 0x02af581b08266c263f4af271e385893d78e2f4d569e17b387178a0eb119b54a4

WITH raw_swaps AS (
    SELECT
        evt_block_time AS block_time,
        evt_block_number AS block_number,
        evt_tx_hash AS tx_hash,
        evt_index,
        "user" AS trader,
        tokenIn AS token_in,
        tokenOut AS token_out,
        amountIn AS amount_in_raw,
        amountOut AS amount_out_raw,
        recipient
    FROM robinhood.accruedswaprouter_evt_AccruedSwap
    WHERE contract_address = 0xc78e883f87675e75334df4d341f6fcb0915ebf19
),

priced AS (
    SELECT
        block_time,
        block_number,
        tx_hash,
        evt_index,
        trader AS user,
        token_in,
        token_out,
        amount_in_raw,
        amount_out_raw,
        amount_in_raw / POWER(10, COALESCE(dec_in.decimals, 18)) AS amount_in,
        amount_out_raw / POWER(10, COALESCE(dec_out.decimals, 18)) AS amount_out,
        COALESCE(sym_in.symbol, 'UNKNOWN') AS token_in_symbol,
        COALESCE(sym_out.symbol, 'UNKNOWN') AS token_out_symbol,
        -- USD: stablecoin leg first, then price oracles (see docs/analytics/usd-methodology.md)
        CASE
            WHEN token_in = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168 THEN amount_in_raw / 1e6
            WHEN token_out = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168 THEN amount_out_raw / 1e6
            WHEN token_in = 0xE246BC49b0598d7Cd9f0eAD48B885034f1254380 THEN amount_in_raw / 1e6
            ELSE (amount_in_raw / POWER(10, COALESCE(dec_in.decimals, 18))) * COALESCE(p_in.price, 0)
        END AS volume_usd,
        0 AS fee_usd,
        CONCAT(
            COALESCE(sym_in.symbol, SUBSTRING(CAST(token_in AS VARCHAR), 1, 10)),
            '/',
            COALESCE(sym_out.symbol, SUBSTRING(CAST(token_out AS VARCHAR), 1, 10))
        ) AS pair
    FROM raw_swaps s
    LEFT JOIN tokens.erc20 robinhood AS dec_in ON dec_in.contract_address = s.token_in
    LEFT JOIN tokens.erc20 robinhood AS dec_out ON dec_out.contract_address = s.token_out
    LEFT JOIN prices.usd robinhood AS p_in ON p_in.contract_address = s.token_in
        AND p_in.minute = date_trunc('minute', s.block_time)
    LEFT JOIN tokens.erc20 robinhood AS sym_in ON sym_in.contract_address = s.token_in
    LEFT JOIN tokens.erc20 robinhood AS sym_out ON sym_out.contract_address = s.token_out
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
