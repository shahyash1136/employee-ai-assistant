import { openai } from "../config/openai.js";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "../db/knowledgeSchema.js";

// The API accepts up to 2048 inputs per call; far below that we're limited by
// request size, not count.
const BATCH_SIZE = 100;

// Returns one vector per input, in input order.
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const vectors: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const res = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts.slice(i, i + BATCH_SIZE),
    });

    // Results carry an `index`; sort rather than trust response order.
    for (const item of [...res.data].sort((a, b) => a.index - b.index)) {
      // vector(1536) rejects other sizes anyway, but failing here names the cause.
      if (item.embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(
          `${EMBEDDING_MODEL} returned ${item.embedding.length} dimensions, expected ${EMBEDDING_DIMENSIONS}`,
        );
      }
      vectors.push(item.embedding);
    }
  }

  return vectors;
}
