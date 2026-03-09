/**
 * Embedding helper for semantic memory search.
 * Primary: OpenAI text-embedding-3-small (1536 dims, $0.02/1M tokens — nearly free)
 * Fallback: Voyage AI voyage-3-lite (512 dims) — note: requires vector column to be 512 if used
 */

async function getEmbedding(text: string): Promise<number[]> {
  // Option A: OpenAI (best quality, nearly free)
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI embeddings error: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    return data.data[0].embedding;
  }

  // Option B: Voyage AI (Anthropic's recommended embedding partner)
  // NOTE: voyage-3-lite uses 512 dimensions — update vector column if switching primary
  const voyageKey = process.env.VOYAGE_API_KEY;
  if (voyageKey) {
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${voyageKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'voyage-3-lite', input: [text] }),
    });
    if (!res.ok) {
      throw new Error(`Voyage AI embeddings error: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    return data.data[0].embedding;
  }

  throw new Error('No embedding API key configured. Set OPENAI_API_KEY or VOYAGE_API_KEY');
}

export { getEmbedding };
