import { describe, expect, it } from 'vitest';
import { buildDocumentGraph, cosineSimilarity, type SecondBrainNote } from '../../lib/lifeOs/secondBrain';

function note(partial: Partial<SecondBrainNote> & Pick<SecondBrainNote, 'id'>): SecondBrainNote {
  return {
    title: partial.id,
    content: '',
    tags: [],
    embedding: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial,
  };
}

describe('cosineSimilarity', () => {
  it('is 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 0, 1], [1, 0, 1])).toBeCloseTo(1);
  });

  it('is 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('is 0 for mismatched lengths or zero vectors', () => {
    expect(cosineSimilarity([1, 2], [1])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});

describe('buildDocumentGraph', () => {
  it('links notes by tag overlap when no embeddings are present', () => {
    const notes = [
      note({ id: 'a', tags: ['life-os', 'founder'] }),
      note({ id: 'b', tags: ['life-os'] }),
      note({ id: 'c', tags: ['unrelated'] }),
    ];
    const { nodes, edges } = buildDocumentGraph(notes);
    expect(nodes).toHaveLength(3);
    expect(edges.some((e) => (e.source === 'a' && e.target === 'b') || (e.source === 'b' && e.target === 'a'))).toBe(true);
    expect(edges.every((e) => !(e.source === 'c' || e.target === 'c'))).toBe(true);
  });

  it('prefers embedding similarity over tags when both notes have one', () => {
    const notes = [
      note({ id: 'a', tags: ['x'], embedding: [1, 0, 0] }),
      note({ id: 'b', tags: ['x'], embedding: [1, 0, 0.01] }),
    ];
    const { edges } = buildDocumentGraph(notes);
    expect(edges).toHaveLength(1);
    expect(edges[0].reason).toBe('embedding');
  });

  it('never produces a duplicate undirected edge', () => {
    const notes = [note({ id: 'a', tags: ['t'] }), note({ id: 'b', tags: ['t'] })];
    const { edges } = buildDocumentGraph(notes);
    expect(edges).toHaveLength(1);
  });
});
