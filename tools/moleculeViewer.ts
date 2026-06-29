// Builds the self-contained HTML document rendered inside the WebView.
// three.js is injected as a base64 data-URL module so the viewer works offline.
// All CPK colours/radii are computed in React Native (single source of truth in cpk.ts)
// and embedded as JSON, so the HTML stays a dumb renderer.

import { Molecule } from "./cif";
import { getElementInfo } from "./cpk";
import { THREE_MODULE_BASE64 } from "./three.bundle";

export type RenderModel = "ball-stick" | "space-filling" | "wireframe" | "stick";

type ViewerAtom = { id: string; el: string; x: number; y: number; z: number; c: string; r: number };
type ViewerBond = { a: number; b: number; o: number };

export type ViewerPayload = {
  atoms: ViewerAtom[];
  bonds: ViewerBond[];
  model: RenderModel;
  background: string;
};

// Messages sent from the WebView back to React Native.
export type ViewerMessage =
  | { type: "ready" }
  | { type: "select"; id: string; element: string; name: string; x: number; y: number; z: number }
  | { type: "deselect" }
  | { type: "screenshot"; data: string }
  | { type: "error"; message: string };

export function buildViewerPayload(
  molecule: Molecule,
  model: RenderModel,
  background: string
): ViewerPayload {
  const index = new Map<string, number>();
  const atoms: ViewerAtom[] = molecule.atoms.map((atom, i) => {
    index.set(atom.id, i);
    const info = getElementInfo(atom.element);
    return { id: atom.id, el: atom.element, x: atom.x, y: atom.y, z: atom.z, c: info.color, r: info.radius };
  });
  const bonds: ViewerBond[] = [];
  for (const bond of molecule.bonds) {
    const a = index.get(bond.a);
    const b = index.get(bond.b);
    if (a !== undefined && b !== undefined) {
      bonds.push({ a, b, o: bond.order });
    }
  }
  return { atoms, bonds, model, background };
}

export function buildViewerHtml(payload: ViewerPayload): string {
  const dataJson = JSON.stringify(payload);
  const threeUrl = `data:text/javascript;base64,${THREE_MODULE_BASE64}`;

  // NOTE: the embedded script avoids backtick template literals so it can live
  // safely inside this TS template string.
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: ${payload.background}; }
  #c { display: block; width: 100vw; height: 100vh; touch-action: none; }
</style>
</head>
<body>
<canvas id="c"></canvas>
<script type="module">
import * as THREE from '${threeUrl}';

const DATA = ${dataJson};

function send(msg) {
  var s = JSON.stringify(msg);
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(s); // native WebView
  } else if (window.parent && window.parent !== window) {
    window.parent.postMessage(s, '*'); // web iframe
  }
}

try {
  const canvas = document.getElementById('c');
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(DATA.background);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);

  // Lighting: ambient fill + two directional lights for depth.
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(1, 1, 1);
  scene.add(key);
  const back = new THREE.DirectionalLight(0xffffff, 0.4);
  back.position.set(-1, -0.5, -1);
  scene.add(back);

  // Pivot group holds the molecule; we rotate/pan this group.
  const pivot = new THREE.Group();
  scene.add(pivot);

  // Centre the molecule on its centroid.
  let cx = 0, cy = 0, cz = 0;
  for (const a of DATA.atoms) { cx += a.x; cy += a.y; cz += a.z; }
  const n = DATA.atoms.length || 1;
  cx /= n; cy /= n; cz /= n;

  // Bounding radius (for camera framing).
  let maxR = 1;
  for (const a of DATA.atoms) {
    const dx = a.x - cx, dy = a.y - cy, dz = a.z - cz;
    const d = Math.sqrt(dx*dx + dy*dy + dz*dz);
    if (d > maxR) maxR = d;
  }

  const model = DATA.model;
  const BALL_SCALE = 0.28;
  const STICK_RADIUS = 0.12;

  const sphereGeo = new THREE.SphereGeometry(1, 24, 16);
  const atomMeshes = [];

  function atomDisplayRadius(a) {
    if (model === 'space-filling') return a.r;            // van der Waals
    if (model === 'wireframe') return 0;                  // no spheres
    if (model === 'stick') return STICK_RADIUS * 1.1;     // tiny caps
    return Math.max(0.25, a.r * BALL_SCALE);              // ball-and-stick
  }

  for (let i = 0; i < DATA.atoms.length; i++) {
    const a = DATA.atoms[i];
    const radius = atomDisplayRadius(a);
    if (radius <= 0) { atomMeshes.push(null); continue; }
    const mat = new THREE.MeshPhongMaterial({ color: new THREE.Color(a.c), shininess: 80 });
    const mesh = new THREE.Mesh(sphereGeo, mat);
    mesh.scale.setScalar(radius);
    mesh.position.set(a.x - cx, a.y - cy, a.z - cz);
    mesh.userData.index = i;
    pivot.add(mesh);
    atomMeshes.push(mesh);
  }

  // Bonds as cylinders (skip for space-filling).
  if (model !== 'space-filling') {
    const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true);
    const up = new THREE.Vector3(0, 1, 0);
    const bondRadius = model === 'wireframe' ? 0.04 : STICK_RADIUS;
    for (const bond of DATA.bonds) {
      const a = DATA.atoms[bond.a];
      const b = DATA.atoms[bond.b];
      const start = new THREE.Vector3(a.x - cx, a.y - cy, a.z - cz);
      const end = new THREE.Vector3(b.x - cx, b.y - cy, b.z - cz);
      const dir = new THREE.Vector3().subVectors(end, start);
      const len = dir.length();
      if (len === 0) continue;
      const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      const quat = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
      // Two half-cylinders, each coloured by its atom.
      const halves = [
        { mat: a.c, from: start },
        { mat: b.c, from: end },
      ];
      for (const half of halves) {
        const cyl = new THREE.Mesh(cylGeo, new THREE.MeshPhongMaterial({ color: new THREE.Color(half.mat), shininess: 60 }));
        cyl.scale.set(bondRadius, len / 2, bondRadius);
        cyl.position.copy(new THREE.Vector3().addVectors(half.from, mid).multiplyScalar(0.5));
        cyl.quaternion.copy(quat);
        pivot.add(cyl);
      }
    }
  }

  // Frame the camera so the whole molecule fits both vertically and horizontally.
  // In portrait the horizontal field of view is the tighter constraint, so we fit
  // against whichever dimension needs the greater distance, plus a safety margin.
  function computeCamDist() {
    const vFov = (camera.fov * Math.PI) / 180;
    const aspect = window.innerWidth / window.innerHeight;
    const fitR = maxR + 1.2; // bounding radius + room for atom spheres / margin
    const distV = fitR / Math.tan(vFov / 2);
    const distH = fitR / (Math.tan(vFov / 2) * aspect);
    return Math.max(distV, distH, 4) * 1.1;
  }

  let camDist = computeCamDist();
  const minDist = camDist * 0.25;
  const maxDist = camDist * 5;
  camera.position.set(0, 0, camDist);
  camera.lookAt(0, 0, 0);

  // ----- Interaction -----
  const raycaster = new THREE.Raycaster();
  let selected = null;

  function highlight(mesh) {
    if (selected && selected.material.emissive) {
      selected.material.emissive.setHex(0x000000);
    }
    selected = mesh;
    if (mesh && mesh.material.emissive) {
      mesh.material.emissive.setHex(0x555555);
    }
  }

  function pickAtom(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
    const meshes = atomMeshes.filter(Boolean);
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length > 0) {
      const mesh = hits[0].object;
      const a = DATA.atoms[mesh.userData.index];
      highlight(mesh);
      send({ type: 'select', id: a.id, element: a.el, name: a.id, x: a.x, y: a.y, z: a.z });
    } else {
      highlight(null);
      send({ type: 'deselect' });
    }
  }

  // Touch / pointer controls.
  let pointers = new Map();
  let lastSingle = null;
  let lastDist = 0;
  let lastMid = null;
  let downX = 0, downY = 0, downTime = 0, moved = false;

  function onDown(e) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);
    if (pointers.size === 1) {
      lastSingle = { x: e.clientX, y: e.clientY };
      downX = e.clientX; downY = e.clientY; downTime = Date.now(); moved = false;
    } else if (pointers.size === 2) {
      const pts = Array.from(pointers.values());
      lastDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      lastMid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    }
  }

  function onMove(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 1 && lastSingle) {
      const dx = e.clientX - lastSingle.x;
      const dy = e.clientY - lastSingle.y;
      if (Math.abs(e.clientX - downX) > 6 || Math.abs(e.clientY - downY) > 6) moved = true;
      pivot.rotation.y += dx * 0.01;
      pivot.rotation.x += dy * 0.01;
      lastSingle = { x: e.clientX, y: e.clientY };
    } else if (pointers.size === 2) {
      moved = true;
      const pts = Array.from(pointers.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      // Pinch zoom (dolly camera).
      if (lastDist > 0) {
        const factor = lastDist / dist;
        camera.position.z = Math.min(maxDist, Math.max(minDist, camera.position.z * factor));
      }
      // Two-finger pan.
      if (lastMid) {
        const panX = (mid.x - lastMid.x) * camera.position.z * 0.0015;
        const panY = (mid.y - lastMid.y) * camera.position.z * 0.0015;
        pivot.position.x += panX;
        pivot.position.y -= panY;
      }
      lastDist = dist;
      lastMid = mid;
    }
  }

  function onUp(e) {
    const wasSingle = pointers.size === 1;
    pointers.delete(e.pointerId);
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
    if (wasSingle && !moved && Date.now() - downTime < 300) {
      pickAtom(e.clientX, e.clientY);
    }
    lastSingle = null;
    lastDist = 0;
    lastMid = null;
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    // Reframe so the molecule stays fully visible after an orientation change.
    camera.position.z = computeCamDist();
  });

  // Messages from React Native.
  function handleHostMessage(raw) {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'screenshot') {
        renderer.render(scene, camera);
        const dataUrl = renderer.domElement.toDataURL('image/png');
        send({ type: 'screenshot', data: dataUrl });
      } else if (msg.type === 'deselect') {
        highlight(null);
      }
    } catch (err) {}
  }
  window.addEventListener('message', (e) => handleHostMessage(e.data));
  document.addEventListener('message', (e) => handleHostMessage(e.data)); // Android

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();
  send({ type: 'ready' });
} catch (err) {
  send({ type: 'error', message: String(err && err.message ? err.message : err) });
}
</script>
</body>
</html>`;
}
