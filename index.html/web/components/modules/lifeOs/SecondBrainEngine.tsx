'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Plus, Share2 } from 'lucide-react';
import { lifeOsFetch } from '@/lib/lifeOs/clientFetch';
import type { DocumentGraph, SecondBrainNote } from '@/lib/lifeOs/secondBrain';

/**
 * Second Brain: vectorized document graph + document intelligence.
 * Composer -> POST /api/life/second-brain/notes (embeds via OpenAI if
 * configured, fails open otherwise) -> GET .../graph renders the resulting
 * similarity graph as a simple radial SVG (no force-simulation dependency --
 * Low-Memory Armor discourages pulling in a new heavy graph library for a
 * personal-note-count graph).
 */
export function SecondBrainEngine() {
  const t = useTranslations('LifeOs.secondBrain');
  const tc = useTranslations('LifeOs.common');

  const [notes, setNotes] = useState<SecondBrainNote[]>([]);
  const [graph, setGraph] = useState<DocumentGraph>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [notesRes, graphRes] = await Promise.all([
        lifeOsFetch('/api/life/second-brain/notes'),
        lifeOsFetch('/api/life/second-brain/graph'),
      ]);
      const notesJson = await notesRes.json();
      const graphJson = await graphRes.json();
      if (notesJson.ok) setNotes(notesJson.notes);
      if (graphJson.ok) setGraph(graphJson.graph);
    } catch {
      /* fail-open: keep whatever was already rendered */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!title.trim() || !content.trim() || saving) return;
    setSaving(true);
    try {
      const tags = tagsInput
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
      const res = await lifeOsFetch('/api/life/second-brain/notes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, content, tags }),
      });
      if (res.ok) {
        setTitle('');
        setContent('');
        setTagsInput('');
        await load();
      }
    } finally {
      setSaving(false);
    }
  };

  const activeNote = notes.find((n) => n.id === selected) ?? null;

  // Radial layout: nodes placed on a circle, edges drawn as straight lines.
  const size = 320;
  const radius = size / 2 - 32;
  const center = size / 2;
  const positions = new Map<string, { x: number; y: number }>();
  graph.nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / Math.max(graph.nodes.length, 1) - Math.PI / 2;
    positions.set(node.id, { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) });
  });

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-accent">{t('composerLabel')}</h2>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('titlePlaceholder')}
          className="w-full border border-accent/20 bg-void/60 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-accent focus:outline-none"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t('contentPlaceholder')}
          rows={4}
          className="w-full border border-accent/20 bg-void/60 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-accent focus:outline-none"
        />
        <input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder={t('tagsPlaceholder')}
          className="w-full border border-accent/20 bg-void/60 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving || !title.trim() || !content.trim()}
          className="flex items-center gap-2 border border-accent/40 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-accent transition-colors hover:border-accent disabled:opacity-40"
        >
          {saving ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
          {t('addNote')}
        </button>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-accent">
          <Share2 size={14} aria-hidden="true" />
          {t('graphLabel')}
        </h2>
        {loading ? (
          <p className="text-xs text-gray-500">{tc('loading')}</p>
        ) : graph.nodes.length === 0 ? (
          <p className="text-xs text-gray-500">{tc('empty')}</p>
        ) : (
          <div className="flex flex-col gap-6 sm:flex-row">
            <svg width={size} height={size} className="shrink-0" role="img" aria-label={t('graphLabel')}>
              {graph.edges.map((edge, i) => {
                const a = positions.get(edge.source);
                const b = positions.get(edge.target);
                if (!a || !b) return null;
                return (
                  <line
                    key={i}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={edge.reason === 'embedding' ? '#00f3ff' : '#d4af37'}
                    strokeOpacity={0.25 + edge.weight * 0.5}
                    strokeWidth={1}
                  />
                );
              })}
              {graph.nodes.map((node) => {
                const p = positions.get(node.id);
                if (!p) return null;
                const isSelected = node.id === selected;
                return (
                  <g key={node.id} onClick={() => setSelected(node.id)} className="cursor-pointer">
                    <circle cx={p.x} cy={p.y} r={isSelected ? 7 : 5} fill={isSelected ? '#d4af37' : '#0f1016'} stroke="#d4af37" strokeWidth={1.5} />
                    <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize={9} fill="#9ca3af">
                      {node.title.slice(0, 14)}
                    </text>
                  </g>
                );
              })}
            </svg>

            <div className="flex-1 border border-accent/15 bg-void/60 p-4 text-sm">
              {activeNote ? (
                <>
                  <p className="mb-2 font-serif text-base text-white">{activeNote.title}</p>
                  <p className="mb-3 whitespace-pre-wrap text-xs text-gray-400">{activeNote.content}</p>
                  {activeNote.tags.length > 0 && (
                    <p className="text-[10px] uppercase tracking-widest text-gray-500">{activeNote.tags.join(' · ')}</p>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-500">{t('selectNodeHint')}</p>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
