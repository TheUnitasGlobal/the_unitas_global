// Lightweight cross-component channel between DOM interactions (the
// OMNI-SYNAPSE search bar gaining focus) and the R3F background shader,
// which reads this every frame inside useFrame. A plain module-level
// mutable object rather than React state/context -- a focus/blur event or a
// 60fps read shouldn't re-render the component tree, so the shader just
// polls this value each frame and eases toward it.
export const sceneInteraction = {
  /** 0..1 -- how strongly the shader's gravity-well warp should intensify. */
  focusBoost: 0,
};
