function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function ExchangesDesk({
  exchanges,
}: {
  exchanges: Array<{
    exchangeId: string;
    status: string;
    fromCurrency: string;
    toCurrency: string;
    fromNetwork: string;
    toNetwork: string;
    fromAmount: string;
    toAmount: string;
    notionalUsdCents: number;
    depositTx: string | null;
    payoutTx: string | null;
    createdAt: Date | string;
  }>;
}) {
  if (exchanges.length === 0) {
    return <p className="text-zinc-400">No pay-in routes yet.</p>;
  }

  return (
    <ul className="divide-y divide-white/8 border-y border-white/8">
      {exchanges.map((row) => (
        <li key={row.exchangeId} className="grid grid-cols-1 gap-2 py-5 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div>
            <p className="font-mono text-sm text-zinc-100">
              {row.fromAmount} {row.fromCurrency.toUpperCase()} ({row.fromNetwork}) → {row.toAmount}{" "}
              {row.toCurrency.toUpperCase()} ({row.toNetwork})
            </p>
            <p className="mt-1 break-all font-mono text-xs text-zinc-500">{row.exchangeId}</p>
          </div>
          <div className="font-mono text-sm text-zinc-300 md:text-right">
            <p className="uppercase tracking-[0.12em] text-zinc-500">{row.status}</p>
            <p className="tabular-nums">{money(row.notionalUsdCents)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
