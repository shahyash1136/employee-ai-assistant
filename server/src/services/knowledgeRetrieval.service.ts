import { EMBEDDING_MODEL } from "../db/knowledgeSchema.js";
import { getVectorPool } from "../db/vectorDb.js";
import { embedTexts } from "../knowledge/embedder.js";
import { logger } from "../logging/logger.js";

export interface PolicyPassage {
  source: string;
  policy: string;
  policyId: string | null;
  version: string | null;
  sections: string[];
  content: string;
  distance: number;
}

const DEFAULT_TOP_K = 4;
const MAX_TOP_K = 10;

// Cosine distance cutoff (0 = identical, 2 = opposite). A coarse noise filter
// only. Measured top-1 distances: unrelated questions 0.73-0.94, on-topic ones
// 0.33-0.69, and HR-sounding questions the policies don't cover (notice period,
// insurance) 0.49-0.76. The last group overlaps the on-topic range, so no cutoff
// can separate "covered" from "not covered"; the agent's instructions have to
// handle passages that don't actually answer the question.
const DEFAULT_MAX_DISTANCE = 0.75;

interface ChunkRow {
  source: string;
  content: string;
  metadata: Record<string, unknown>;
  distance: number;
}

const asString = (value: unknown): string | null => (typeof value === "string" ? value : null);

function toPassage(row: ChunkRow): PolicyPassage {
  const sections = Array.isArray(row.metadata.sections)
    ? row.metadata.sections.filter((s): s is string => typeof s === "string")
    : [];
  return {
    source: row.source,
    policy: asString(row.metadata.title) ?? row.source,
    policyId: asString(row.metadata.policy_id),
    version: asString(row.metadata.version),
    sections,
    content: row.content,
    distance: row.distance,
  };
}

// Kept separate from conversation/session memory: that is per-session state,
// this is shared, read-only company knowledge.
export class KnowledgeRetrievalService {
  async searchPolicies(
    query: string,
    topK: number = DEFAULT_TOP_K,
    maxDistance: number = DEFAULT_MAX_DISTANCE,
  ): Promise<PolicyPassage[]> {
    const text = query.trim();
    if (!text) throw new Error("Search query must not be empty");
    const limit = Math.min(Math.max(Math.trunc(topK), 1), MAX_TOP_K);

    const [vector] = await embedTexts([text]);

    // Filtering on embedding_model means chunks embedded by a different model
    // are excluded instead of being compared against an incompatible vector.
    const { rows } = await getVectorPool().query<ChunkRow>(
      `SELECT source, content, metadata, embedding <=> $1::vector AS distance
         FROM knowledge.chunks
        WHERE embedding_model = $2
        ORDER BY distance
        LIMIT $3`,
      [`[${vector!.join(",")}]`, EMBEDDING_MODEL, limit],
    );

    const passages = rows.filter((row) => row.distance <= maxDistance).map(toPassage);

    // Length only, not the text: questions can contain personal details.
    logger.info(
      {
        queryChars: text.length,
        candidates: rows.length,
        returned: passages.length,
        topDistance: rows[0]?.distance ?? null,
      },
      "policy_search",
    );
    return passages;
  }
}

export const knowledgeRetrievalService = new KnowledgeRetrievalService();
