// The Studio's own asset view for `assets.view: "gltf"`, loaded in the Workbench iframe like a URL-template view.
// Driven by URL only: `#file=<path>&anchor=<clip>&t=<seconds>&play=0|1`. The hash changes without a reload,
// so the file loads once per asset. Anchors are the file's clips; the Studio sets the clip and the time.
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

// preserveDrawingBuffer: the Studio's default screenshot reads this canvas from outside.
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setClearColor(0x1b1b1f);
document.body.append(renderer.domElement);
const scene = new THREE.Scene();
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(3, 5, 4);
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2), sun);
const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
const clock = new THREE.Clock();

let file = '';
let gltf: GLTF | undefined;
let mixer: THREE.AnimationMixer | undefined;
let playing = false;

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
}

function frame(model: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).length() || 1;
  camera.position.copy(center).add(new THREE.Vector3(0.6, 0.5, 1).normalize().multiplyScalar(size * 1.6));
  camera.lookAt(center);
}

async function apply() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (p.get('file') !== file) {
    file = p.get('file') ?? '';
    if (gltf) scene.remove(gltf.scene);
    gltf = await new GLTFLoader().loadAsync(file.startsWith('/') ? file : `/${file}`);
    scene.add(gltf.scene);
    frame(gltf.scene);
    mixer = new THREE.AnimationMixer(gltf.scene);
  }
  mixer!.stopAllAction();
  const clip = gltf!.animations.find((c) => c.name === p.get('anchor'));
  playing = !!clip && p.get('play') === '1';
  if (clip) {
    // Paused, the last frame stays the last frame instead of wrapping to the first.
    const action = mixer!.clipAction(clip).setLoop(playing ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = true;
    action.play();
  }
  mixer!.setTime(Number(p.get('t')) || 0);
  clock.getDelta();
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(() => {
  if (!playing) return;
  mixer!.update(clock.getDelta());
  renderer.render(scene, camera);
});
addEventListener('resize', resize);
addEventListener('hashchange', apply);
resize();
apply();
