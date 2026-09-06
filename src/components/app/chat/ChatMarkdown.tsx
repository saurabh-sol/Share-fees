import type { ReactNode } from "react";

function renderInline(text: string, keyPrefix: string) {
  const parts: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let match = pattern.exec(text);
  let index = 0;
  while (match) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(
        <strong key={`${keyPrefix}-b-${index}`} className="font-medium text-zinc-100">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      parts.push(
        <code
          key={`${keyPrefix}-c-${index}`}
          className="rounded-sm bg-background px-1 py-0.5 font-mono text-[12px] text-zinc-200"
        >
          {token.slice(1, -1)}
        </code>,
      );
    }
    last = match.index + token.length;
    index += 1;
    match = pattern.exec(text);
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function splitBlocks(source: string) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Array<
    | { type: "code"; lang: string; text: string }
    | { type: "heading"; level: number; text: string }
    | { type: "list"; ordered: boolean; items: string[] }
    | { type: "p"; text: string }
  > = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? "").startsWith("```")) {
        body.push(lines[i] ?? "");
        i += 1;
      }
      blocks.push({ type: "code", lang, text: body.join("\n") });
      i += 1;
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1]!.length, text: heading[2]!.trim() });
      i += 1;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length) {
        const current = lines[i] ?? "";
        const item = ordered ? /^\s*\d+\.\s+(.+)$/.exec(current) : /^\s*[-*]\s+(.+)$/.exec(current);
        if (!item) break;
        items.push(item[1]!.trim());
        i += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const para: string[] = [line];
    i += 1;
    while (i < lines.length) {
      const current = lines[i] ?? "";
      if (
        !current.trim() ||
        current.startsWith("```") ||
        /^(#{1,3})\s+/.test(current) ||
        /^\s*[-*]\s+/.test(current) ||
        /^\s*\d+\.\s+/.test(current)
      ) {
        break;
      }
      para.push(current);
      i += 1;
    }
    blocks.push({ type: "p", text: para.join(" ") });
  }
  return blocks;
}

export function ChatMarkdown({ text }: { text: string }) {
  const blocks = splitBlocks(text);
  if (blocks.length === 0) {
    return <p className="text-sm leading-relaxed text-zinc-400">Empty reply.</p>;
  }
  return (
    <div className="space-y-3 text-sm leading-relaxed text-zinc-200">
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        if (block.type === "code") {
          return (
            <pre
              key={key}
              className="overflow-x-auto border border-white/8 bg-background px-3 py-3 font-mono text-[12px] leading-relaxed text-zinc-300"
            >
              {block.lang ? (
                <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                  {block.lang}
                </span>
              ) : null}
              <code>{block.text}</code>
            </pre>
          );
        }
        if (block.type === "heading") {
          const cls =
            block.level === 1
              ? "text-xl tracking-tight text-zinc-100"
              : block.level === 2
                ? "text-lg tracking-tight text-zinc-100"
                : "text-base tracking-tight text-zinc-100";
          return (
            <p key={key} className={cls}>
              {renderInline(block.text, key)}
            </p>
          );
        }
        if (block.type === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List
              key={key}
              className={`space-y-1 pl-5 text-zinc-200 ${block.ordered ? "list-decimal" : "list-disc"}`}
            >
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`}>{renderInline(item, `${key}-${itemIndex}`)}</li>
              ))}
            </List>
          );
        }
        return (
          <p key={key} className="whitespace-pre-wrap">
            {renderInline(block.text, key)}
          </p>
        );
      })}
    </div>
  );
}
