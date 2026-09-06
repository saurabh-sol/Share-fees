function AsciiBlock({ lines, className = "" }: { lines: string[]; className?: string }) {
  return (
    <div
      className={`font-mono text-[9px] uppercase leading-[1.7] tracking-[0.32em] text-muted ${className}`}
    >
      {lines.map((line) => (
        <p key={line} className="whitespace-nowrap">
          {line}
        </p>
      ))}
      <span className="mt-1.5 block h-px w-7 bg-accent" />
    </div>
  );
}

export function DecorativeAscii() {
  return (
    <>
      <AsciiBlock
        lines={["WALLET", "CONNECT"]}
        className="absolute left-8 top-[16%] hidden lg:block"
      />
      <AsciiBlock
        lines={["OWN", "EXPLORE", "EARN", "ONCHAIN"]}
        className="absolute right-8 top-[20%] hidden text-right lg:block"
      />
      <AsciiBlock
        lines={["ETH", "ROBINHOOD ETH", "AND MORE"]}
        className="absolute bottom-[10%] left-8 hidden md:block"
      />
      <AsciiBlock
        lines={["SAME", "WALLET", "MORE", "POSSIBILITIES"]}
        className="absolute bottom-[10%] right-8 hidden text-right md:block"
      />
    </>
  );
}
