'use client';

import Matter from 'matter-js';

/**
 * Matter.js wrapper with guaranteed teardown. Physics simulations own a
 * `requestAnimationFrame` runner and (optionally) a canvas renderer -- left
 * running past unmount is exactly the kind of leaked background work
 * CLAUDE.md's Low-Memory Armor section warns about, so `destroy()` is not
 * optional cleanup, it's the point of this wrapper.
 *
 * Client-only by construction (Matter.Render touches `document`/`canvas`),
 * so any component using this must be dynamically imported with
 * `{ ssr: false }` -- see web/components/canvas/SceneLazy.tsx for the
 * established precedent with the R3F scene.
 */
export interface MatterEngineHandle {
  engine: Matter.Engine;
  world: Matter.World;
  runner: Matter.Runner;
  render: Matter.Render | null;
  destroy: () => void;
}

export interface CreateMatterEngineOptions {
  /** Attach a canvas renderer. Omit to drive the world headlessly (e.g. a
   *  custom R3F/canvas draw loop reads body positions off `world` itself). */
  canvas?: HTMLCanvasElement;
  width?: number;
  height?: number;
  gravity?: { x?: number; y?: number; scale?: number };
  background?: string;
}

export function createMatterEngine(options: CreateMatterEngineOptions = {}): MatterEngineHandle {
  const engine = Matter.Engine.create();
  const world = engine.world;

  if (options.gravity) {
    world.gravity.x = options.gravity.x ?? world.gravity.x;
    world.gravity.y = options.gravity.y ?? world.gravity.y;
    world.gravity.scale = options.gravity.scale ?? world.gravity.scale;
  }

  let render: Matter.Render | null = null;
  if (options.canvas) {
    render = Matter.Render.create({
      canvas: options.canvas,
      engine,
      options: {
        width: options.width ?? options.canvas.width,
        height: options.height ?? options.canvas.height,
        wireframes: false,
        background: options.background ?? 'transparent',
      },
    });
    Matter.Render.run(render);
  }

  const runner = Matter.Runner.create();
  Matter.Runner.run(runner, engine);

  return {
    engine,
    world,
    runner,
    render,
    destroy() {
      Matter.Runner.stop(runner);
      if (render) {
        Matter.Render.stop(render);
      }
      Matter.World.clear(world, false);
      Matter.Engine.clear(engine);
    },
  };
}
