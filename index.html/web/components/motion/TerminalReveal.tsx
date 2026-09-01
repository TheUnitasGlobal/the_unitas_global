'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface TerminalRevealProps {
  text: string;
  className?: string;
  /** ms per character. */
  speed?: number;
  /** Delay before the reveal starts, ms. */
  startDelay?: number;
  cursorColor?: string;
}

/**
 * Sequential per-character "terminal insert" text reveal with a blinking
 * caret -- a native reimplementation of the terminal-insert / article-
 * highlight motion beat (the kind reborn-motion-skills packaged as a
 * Remotion video preset) as a live, reusable UI primitive instead of a
 * pre-rendered video clip.
 *
 * Fails open on prefers-reduced-motion: renders the full string immediately,
 * no per-character stagger, matching every other reduced-motion branch in
 * this codebase (ComingSoonCinema, GlassTiltPanel).
 */
export function TerminalReveal({
  text,
  className = '',
  speed = 28,
  startDelay = 0,
  cursorColor = '#00f3ff',
}: TerminalRevealProps) {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(reduceMotion ? text.length : 0);
  const chars = useMemo(() => Array.from(text), [text]);

  useEffect(() => {
    if (reduceMotion) {
      setShown(chars.length);
      return;
    }
    setShown(0);
    let cancelled = false;
    let i = 0;
    const startTimer = window.setTimeout(function tick() {
      const step = () => {
        if (cancelled) return;
        i += 1;
        setShown(i);
        if (i < chars.length) window.setTimeout(step, speed);
      };
      step();
    }, startDelay);
    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
    };
  }, [chars, speed, startDelay, reduceMotion]);

  const done = shown >= chars.length;

  return (
    <span className={`font-mono ${className}`}>
      {chars.slice(0, shown).join('')}
      {!done && (
        <motion.span
          aria-hidden="true"
          className="ml-0.5 inline-block h-[1em] w-[0.5em] translate-y-[0.1em] align-middle"
          style={{ backgroundColor: cursorColor }}
          animate={{ opacity: [1, 1, 0, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
        />
      )}
    </span>
  );
}
