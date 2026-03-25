/**
 * Brain Public API — embedding helper.
 *
 * Thin re-export of the shared embedding utility so Brain API routes
 * import from a consistent location without coupling directly to
 * @/lib/memory/embeddings.
 *
 * Model: OpenAI text-embedding-3-small (1536 dims)
 * Fallback: Voyage AI voyage-3-lite (512 dims) when OPENAI_API_KEY is absent
 */

export { getEmbedding } from '@/lib/memory/embeddings';
