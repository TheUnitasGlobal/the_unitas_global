// Second Brain module (founder directive 2026-09-08): vectorized document
// graph + document intelligence. Pure graph/math helpers only -- no
// Supabase or fetch calls here, so this is trivially unit-testable and safe
// to import from both the API routes and the client engine component.
//
// Graph strategy: prefer embedding cosine similarity (pgvector-backed,
// supabase/migrations/20260912000000_life_os_sovereign_modules.sql) when
// BOTH notes in a pair have one; fall back to Jaccard tag overlap otherwise.
// This degrades gracefully when OPENAI_API_KEY is unset (see
// lib/lifeOs/embeddings.ts) or pgvector isn't enabled on the project --
// the graph is never empty just because embeddings aren't configured.

export interface SecondBrainNote {
  id: string;
  title: string;
  content: string;
  tags: string[];
  embedding: number[] | null;
  created_at: string;
  updated_at: string;
}

export interface GraphNode {
  id: string;
  title: string;
  tags: string[];
}

export type GraphEdgeReason = 'embedding' | 'tags';

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  reason: GraphEdgeReason;
}

export interface DocumentGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Max edges kept per node, most-similar first -- keeps the rendered graph legible. */
const MAX_EDGES_PER_NODE = 5;
/** Cosine similarity floor for an embedding-based edge to be worth drawing. */
const EMBEDDING_SIMILARITY_FLOOR = 0.72;

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function tagJaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  const shared = a.filter((tag) => setB.has(tag)).length;
  if (shared === 0) return 0;
  const union = new Set([...a, ...b]).size;
  return shared / union;
}

/** O(n^2) -- fine for a personal note archive (hundreds, not millions, of rows). */
export function buildDocumentGraph(notes: SecondBrainNote[]): DocumentGraph {
  const nodes: GraphNode[] = notes.map((note) => ({ id: note.id, title: note.title, tags: note.tags }));
  const edges: GraphEdge[] = [];

  for (let i = 0; i < notes.length; i += 1) {
    const candidates: { id: string; weight: number; reason: GraphEdgeReason }[] = [];

    for (let j = 0; j < notes.length; j += 1) {
      if (i === j) continue;
      const a = notes[i];
      const b = notes[j];

      if (a.embedding && b.embedding) {
        const similarity = cosineSimilarity(a.embedding, b.embedding);
        if (similarity >= EMBEDDING_SIMILARITY_FLOOR) {
          candidates.push({ id: b.id, weight: similarity, reason: 'embedding' });
        }
      } else {
        const overlap = tagJaccard(a.tags, b.tags);
        if (overlap > 0) candidates.push({ id: b.id, weight: overlap, reason: 'tags' });
      }
    }

    candidates.sort((x, y) => y.weight - x.weight);
    for (const candidate of candidates.slice(0, MAX_EDGES_PER_NODE)) {
      const alreadyLinked = edges.some(
        (edge) =>
          (edge.source === notes[i].id && edge.target === candidate.id) ||
          (edge.source === candidate.id && edge.target === notes[i].id),
      );
      if (!alreadyLinked) {
        edges.push({ source: notes[i].id, target: candidate.id, weight: candidate.weight, reason: candidate.reason });
      }
    }
  }

  return { nodes, edges };
}
