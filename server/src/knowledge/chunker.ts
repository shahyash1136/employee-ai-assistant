// Heading-first chunker for the markdown policy documents. Pure: no I/O.
//
// Why not a blind 500-800 token window: each policy is ~1-1.6k tokens split into
// 13-15 short `##` sections (80-250 tokens). A wide window packs 4-6 unrelated
// sections into one chunk and blurs the embedding. So a section is the unit of
// retrieval, tiny neighbours are merged, and only an oversized section falls
// back to paragraph / sentence splitting.

export const MAX_CHUNK_TOKENS = 500;
// Only sections this small get merged. Tuned against 10 sample questions: at 100,
// merged chunks buried a minority section (Outside Employment, Processing Time)
// and top-1 hit rate was 8/10; at 60 it was 10/10.
export const MIN_CHUNK_TOKENS = 60;
const OVERLAP_TOKENS = 60;

// ~4 chars/token for English (OpenAI's rule of thumb). Good enough for sizing
// decisions and avoids pulling in a tokenizer dependency.
export const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

export interface Chunk {
  source: string;
  chunkIndex: number;
  // Exactly what gets embedded and later shown to the model: a document label
  // line followed by the section(s), so a chunk is meaningful on its own.
  content: string;
  metadata: Record<string, unknown>;
}

interface Section {
  heading: string;
  body: string;
  tokens: number;
}

const makeSection = (heading: string, body: string): Section => ({
  heading,
  body,
  tokens: estimateTokens(heading) + estimateTokens(body),
});

// Flat `key: value` frontmatter only. Not worth a YAML dependency.
function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) return { meta: {}, body: raw };

  const meta: Record<string, string> = {};
  for (const line of match[1]!.split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    meta[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return { meta, body: raw.slice(match[0].length) };
}

function splitSections(body: string): Section[] {
  const sections: Section[] = [];
  let heading = "Overview";
  let lines: string[] = [];

  const flush = () => {
    const text = lines.join("\n").trim();
    if (text) sections.push(makeSection(heading, text));
    lines = [];
  };

  for (const line of body.split(/\r?\n/)) {
    if (/^# /.test(line)) continue; // document title comes from frontmatter
    const h = /^## (.+)$/.exec(line);
    if (h) {
      flush();
      heading = h[1]!.trim();
    } else {
      lines.push(line);
    }
  }
  flush();
  return sections;
}

// A single "sentence" longer than the cap (no punctuation at all) still has to
// be cut somewhere.
function hardSplit(text: string): string[] {
  if (estimateTokens(text) <= MAX_CHUNK_TOKENS) return [text];
  const size = MAX_CHUNK_TOKENS * 4;
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

// Only used when a cut has to land inside a paragraph. Cuts on paragraph
// boundaries need no overlap because paragraphs are self-contained.
function splitWithOverlap(block: string): string[] {
  const sentences = block.split(/(?<=[.!?])\s+/).flatMap(hardSplit);
  const windows: string[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const sentence of sentences) {
    const tokens = estimateTokens(sentence);
    if (current.length && currentTokens + tokens > MAX_CHUNK_TOKENS) {
      windows.push(current.join(" "));

      // Carry the tail of the finished window into the next one.
      const tail: string[] = [];
      let tailTokens = 0;
      for (let i = current.length - 1; i >= 0; i--) {
        const t = estimateTokens(current[i]!);
        if (tailTokens + t > OVERLAP_TOKENS) break;
        tail.unshift(current[i]!);
        tailTokens += t;
      }
      current = tail;
      currentTokens = tailTokens;
    }
    current.push(sentence);
    currentTokens += tokens;
  }
  if (current.length) windows.push(current.join(" "));
  return windows;
}

function splitOversized(section: Section): Section[] {
  if (section.tokens <= MAX_CHUNK_TOKENS) return [section];

  // Blank-line blocks keep tables and bullet lists intact.
  const pieces: string[] = [];
  for (const block of section.body.split(/\n{2,}/)) {
    if (estimateTokens(block) <= MAX_CHUNK_TOKENS) pieces.push(block);
    else pieces.push(...splitWithOverlap(block));
  }

  const parts: string[] = [];
  let current = "";
  for (const piece of pieces) {
    if (current && estimateTokens(`${current}\n\n${piece}`) > MAX_CHUNK_TOKENS) {
      parts.push(current);
      current = piece;
    } else {
      current = current ? `${current}\n\n${piece}` : piece;
    }
  }
  if (current) parts.push(current);

  return parts.map((text, i) => makeSection(`${section.heading} (part ${i + 1}/${parts.length})`, text));
}

const groupTokens = (group: Section[]): number => group.reduce((sum, s) => sum + s.tokens, 0);

// Sections under MIN_CHUNK_TOKENS are merged with their next neighbour (never
// past MAX_CHUNK_TOKENS); anything bigger stands alone as its own chunk.
function packSections(sections: Section[]): Section[][] {
  const forward: Section[][] = [];
  for (let i = 0; i < sections.length; i++) {
    const group = [sections[i]!];
    while (
      groupTokens(group) < MIN_CHUNK_TOKENS &&
      i + 1 < sections.length &&
      groupTokens(group) + sections[i + 1]!.tokens <= MAX_CHUNK_TOKENS
    ) {
      group.push(sections[++i]!);
    }
    forward.push(group);
  }

  // A tiny section following a large one has no next neighbour to absorb it
  // (e.g. a closing "Questions" section), and a ~10-token chunk embeds poorly.
  // Fold such orphans backwards instead.
  const packed: Section[][] = [];
  for (const group of forward) {
    const prev = packed[packed.length - 1];
    if (prev && groupTokens(group) < MIN_CHUNK_TOKENS && groupTokens(prev) + groupTokens(group) <= MAX_CHUNK_TOKENS) {
      prev.push(...group);
    } else {
      packed.push(group);
    }
  }
  return packed;
}

export function chunkPolicyDocument(raw: string, source: string): Chunk[] {
  const { meta, body } = parseFrontmatter(raw);
  if (!meta.title) throw new Error(`${source}: frontmatter is missing "title"`);

  const label = meta.policy_id
    ? `${meta.title} (${meta.policy_id}${meta.version ? `, v${meta.version}` : ""})`
    : meta.title;

  const groups = packSections(splitSections(body).flatMap(splitOversized));

  return groups.map((group, chunkIndex) => {
    const content = [label, ...group.map((s) => `## ${s.heading}\n${s.body}`)].join("\n\n");
    return {
      source,
      chunkIndex,
      content,
      metadata: { ...meta, sections: group.map((s) => s.heading), approx_tokens: estimateTokens(content) },
    };
  });
}
