function AsciiBlock({ lines, className = "" }: { lines: string[]; className?: string }) {
  return (
    <div className={`font-mono text-[10px] uppercase leading-[1.6] tracking-[0.35em] text-[#a1a1aa] ${className}`}>
      {lines.map((line) => (
        <p key={line} className="whitespace-nowrap">
          {line.split("").map((char, i) =>
            char === " " ? (
              <span key={i} className="inline-block w-[0.35em]" />
            ) : (
              <span key={i}>{char}</span>
            ),
          )}
        </p>
      ))}
      <span className="mt-2 block h-px w-8 bg-[#c23a3a]" />
    </div>
  );
}

export function DecorativeAscii() {
  return (
    <>
      <AsciiBlock
        lines={["W A L L E T", "C O N N E C T"]}
        className="absolute left-6 top-[28%] hidden lg:block"
      />
      <AsciiBlock
        lines={["O W N", "E X P L O R E", "E A R N", "O N C H A I N"]}
        className="absolute right-6 top-[32%] hidden text-right lg:block [&_span:last-child]:ml-auto"
      />
      <AsciiBlock
        lines={["E T H", "R O B I N H O O D   E T H", "A N D   M O R E"]}
        className="absolute bottom-[18%] left-6 hidden md:block"
      />
      <AsciiBlock
        lines={["S A M E", "W A L L E T", "M O R E", "P O S S I B I L I T I E S"]}
        className="absolute bottom-[18%] right-6 hidden text-right md:block [&_span:last-child]:ml-auto"
      />
    </>
  );
}
