import { parseToolArguments } from "@/lib/format";

// Tool arguments arrive as a JSON string. Render `key: value` pairs when it
// parses, otherwise fall back to the raw text rather than hiding anything a
// reviewer might need to see before approving.
export function ToolArguments({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">None</span>;

  const parsed = parseToolArguments(value);
  if (!parsed) {
    return <span className="font-mono text-xs break-all">{value}</span>;
  }

  const entries = Object.entries(parsed);
  if (entries.length === 0) {
    return <span className="text-muted-foreground">None</span>;
  }

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
      {entries.map(([key, val]) => (
        <div key={key} className="contents">
          <dt className="text-muted-foreground">{key}</dt>
          <dd className="font-mono break-all">
            {typeof val === "string" ? val : JSON.stringify(val)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
