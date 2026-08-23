'use client';

import { useMemo, useRef } from 'react';
import { extend, useFrame, type Object3DNode } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { sceneInteraction } from '@/lib/sceneInteraction';

// Ashima Arts / Stefan Gustavson simplex noise (MIT/public-domain, the same
// implementation glsl-noise (installed as a dependency) wraps for glslify
// pipelines). Inlined directly here rather than imported so this shader
// works with Next.js's default webpack config -- no raw-loader for .glsl
// files is configured. If a `.glsl` asset pipeline is added later (see
// scripts/generate-types.ps1 sibling task), swap this for
// `glsl-noise/simplex/3d.glsl` via glslify.
const simplexNoise3d = /* glsl */ `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }
`;

const NeuralShaderMaterialImpl = shaderMaterial(
  {
    uTime: 0,
    uColorA: new THREE.Color('#d4af37'),
    uColorB: new THREE.Color('#00f3ff'),
    uColorVoid: new THREE.Color('#030305'),
    // Pointer position in 0..1 UV space, tracked from R3F's built-in
    // pointer state -- drives a soft "wormhole" gravity-well warp so the
    // background reacts to the cursor instead of looping in place.
    uMouse: new THREE.Vector2(0.5, 0.5),
    // 0..1 -- driven by lib/sceneInteraction.ts (e.g. the OMNI-SYNAPSE
    // search bar gaining focus) to intensify the warp into a black-hole
    // suction effect around the pointer.
    uFocusBoost: 0,
  },
  /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  /* glsl */ `
    uniform float uTime;
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    uniform vec3 uColorVoid;
    uniform vec2 uMouse;
    uniform float uFocusBoost;
    varying vec2 vUv;

    ${simplexNoise3d}

    void main() {
      vec2 uv = vUv * 3.0;

      // Gravity-well warp: pull sample coordinates toward the cursor within
      // a soft falloff radius, like light bending near the wormhole throat.
      // uFocusBoost (search-bar focus) multiplies both the pull radius and
      // strength for a "black hole suction" intensification.
      vec2 toMouse = vUv - uMouse;
      float distToMouse = length(toMouse);
      float pullRadius = 0.45 + uFocusBoost * 0.25;
      float pull = smoothstep(pullRadius, 0.0, distToMouse) * (0.35 + uFocusBoost * 0.9);
      uv -= normalize(toMouse + 1e-4) * pull;

      float n = snoise(vec3(uv, uTime * 0.06));
      float lattice = smoothstep(0.15, 0.55, abs(n));
      float mouseGlow = smoothstep(0.4, 0.0, distToMouse) * (0.25 + uFocusBoost * 0.4);
      vec3 color = mix(uColorVoid, mix(uColorA, uColorB, n * 0.5 + 0.5), lattice * 0.6 + mouseGlow);

      // Event-horizon darkening at the very center when focus-boosted.
      float horizon = uFocusBoost * smoothstep(0.22, 0.0, distToMouse);
      color = mix(color, uColorVoid, horizon * 0.75);

      gl_FragColor = vec4(color, 1.0);
    }
  `,
);

extend({ NeuralShaderMaterialImpl });

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      neuralShaderMaterialImpl: Object3DNode<
        InstanceType<typeof NeuralShaderMaterialImpl>,
        typeof NeuralShaderMaterialImpl
      >;
    }
  }
}

/** Full-viewport plane driving the neural-lattice background shader. */
export function NeuralShader() {
  const materialRef = useRef<
    THREE.ShaderMaterial & { uTime: number; uMouse: THREE.Vector2; uFocusBoost: number }
  >(null);
  const args = useMemo<[number, number]>(() => [1, 1], []);

  useFrame((state, delta) => {
    const material = materialRef.current;
    if (!material) return;

    material.uTime += delta;

    // R3F tracks pointer position as normalized device coords (-1..1);
    // remap to the shader's 0..1 UV space and ease toward it so the warp
    // trails the cursor smoothly instead of snapping every frame.
    const targetX = state.pointer.x * 0.5 + 0.5;
    const targetY = state.pointer.y * 0.5 + 0.5;
    material.uMouse.x += (targetX - material.uMouse.x) * 0.08;
    material.uMouse.y += (targetY - material.uMouse.y) * 0.08;

    material.uFocusBoost += (sceneInteraction.focusBoost - material.uFocusBoost) * 0.06;
  });

  return (
    <mesh scale={[20, 20, 1]}>
      <planeGeometry args={args} />
      <neuralShaderMaterialImpl ref={materialRef} />
    </mesh>
  );
}
