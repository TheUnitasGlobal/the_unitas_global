// THE UNITAS GLOBAL -- coin-core Rev 0 "quantum wormhole" cinematic intro.
//
// Only loaded when index.html's inline bootstrap decides the intro hasn't
// been seen this session (see the <script> right after <body> opens). Loads
// Three.js from CDN (matching the site's existing no-bundler CDN-script
// pattern) and renders a simple additive-blended particle tunnel -- kept
// deliberately simple (no shader pipeline) for mobile viability. No texture
// assets: particle color comes from the existing accent/neon palette.
(function () {
  'use strict';

  var THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js';
  var DURATION_MS = 3000;
  var PARTICLE_COUNT = 1800;
  var TUNNEL_DEPTH = 40;
  // Gravitational countdown: one numeral per second, pulled into the
  // singularity (see .wormhole-countdown / @keyframes wormhole-gravity-pull
  // in index.html) before the gate opens at DURATION_MS.
  var COUNTDOWN_TICKS = ['3', '2', '1'];
  var COUNTDOWN_TICK_MS = DURATION_MS / COUNTDOWN_TICKS.length;

  var finished = false;
  var renderer = null;
  var particles = null;
  var animationId = null;
  var countdownIndex = -1;

  function onResize() {
    if (!window.__wormholeCamera || !renderer) return;
    window.__wormholeCamera.aspect = window.innerWidth / window.innerHeight;
    window.__wormholeCamera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function disposeScene() {
    if (particles) {
      particles.geometry.dispose();
      particles.material.dispose();
      particles = null;
    }
    if (renderer) {
      renderer.dispose();
      renderer = null;
    }
    window.__wormholeCamera = null;
  }

  function updateCountdown(elapsed) {
    var el = document.getElementById('wormhole-countdown');
    if (!el) return;
    var tickIndex = Math.min(Math.floor(elapsed / COUNTDOWN_TICK_MS), COUNTDOWN_TICKS.length - 1);
    if (tickIndex === countdownIndex) return;
    countdownIndex = tickIndex;
    el.textContent = COUNTDOWN_TICKS[tickIndex];
    el.classList.remove('tick');
    // Force reflow so the pull-in animation restarts on every tick.
    void el.offsetWidth;
    el.classList.add('tick');
  }

  function finish() {
    if (finished) return;
    finished = true;
    sessionStorage.setItem('unitas_intro_seen', 'true');
    if (animationId) cancelAnimationFrame(animationId);
    window.removeEventListener('resize', onResize);

    var overlay = document.getElementById('wormhole-intro');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(function () {
        overlay.remove();
        disposeScene();
      }, 650);
    } else {
      disposeScene();
    }
  }

  function init() {
    var canvas = document.getElementById('wormhole-canvas');
    if (!canvas || !window.THREE) {
      finish();
      return;
    }

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 5;
    window.__wormholeCamera = camera;

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    var positions = new Float32Array(PARTICLE_COUNT * 3);
    var colors = new Float32Array(PARTICLE_COUNT * 3);
    var colorA = new THREE.Color(0xd4af37); // accent gold
    var colorB = new THREE.Color(0x00f3ff); // neon cyan

    for (var i = 0; i < PARTICLE_COUNT; i++) {
      var angle = Math.random() * Math.PI * 2;
      var radius = 1.5 + Math.random() * 1.2;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius;
      positions[i * 3 + 2] = -Math.random() * TUNNEL_DEPTH;

      var mixed = colorA.clone().lerp(colorB, Math.random());
      colors[i * 3] = mixed.r;
      colors[i * 3 + 1] = mixed.g;
      colors[i * 3 + 2] = mixed.b;
    }

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    var material = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    particles = new THREE.Points(geometry, material);
    scene.add(particles);

    var startTime = performance.now();
    var posAttr = geometry.attributes.position;

    function animate() {
      animationId = requestAnimationFrame(animate);
      var elapsed = performance.now() - startTime;
      updateCountdown(elapsed);

      for (var i = 0; i < PARTICLE_COUNT; i++) {
        var zIndex = i * 3 + 2;
        posAttr.array[zIndex] += 0.35;
        if (posAttr.array[zIndex] > 5) {
          posAttr.array[zIndex] -= TUNNEL_DEPTH;
        }
      }
      posAttr.needsUpdate = true;
      camera.rotation.z += 0.0015;

      renderer.render(scene, camera);
      if (elapsed > DURATION_MS) finish();
    }
    animate();

    window.addEventListener('resize', onResize);
  }

  var skipBtn = document.getElementById('wormhole-skip');
  if (skipBtn) skipBtn.addEventListener('click', finish);

  // Safety net: never trap a visitor behind a stuck or erroring intro.
  setTimeout(function () { if (!finished) finish(); }, DURATION_MS + 4000);

  if (window.THREE) {
    init();
  } else {
    var loader = document.createElement('script');
    loader.src = THREE_CDN;
    loader.onload = init;
    loader.onerror = finish;
    document.head.appendChild(loader);
  }
})();
