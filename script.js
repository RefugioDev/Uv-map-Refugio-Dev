let scene, camera, renderer, mesh;
let uvCanvas, uvCtx;
let xatlasReady = false;

async function init() {
  const container = document.getElementById('viewer3d');
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(400, 400);
  container.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 3);

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(2, 2, 2);
  scene.add(light);

  uvCanvas = document.getElementById('uvCanvas');
  uvCtx = uvCanvas.getContext('2d');

  animate();

  // Espera o xatlas carregar (WASM)
  if (typeof xatlas !== 'undefined' && xatlas.ready) {
    await xatlas.ready;
    xatlasReady = true;
    console.log("xatlas pronto!");
  } else {
    console.error("xatlas não carregou corretamente!");
  }

  setupUI();
}

function animate() {
  requestAnimationFrame(animate);
  if (mesh) mesh.rotation.y += 0.01;
  renderer.render(scene, camera);
}

function setupUI() {
  const fileInput = document.getElementById('fileInput');
  const uvButton = document.getElementById('uvButton');
  const exportButton = document.getElementById('exportButton');

  fileInput.addEventListener('change', handleFile);
  uvButton.addEventListener('click', generateUV);
  exportButton.addEventListener('click', exportOBJ);
}

async function handleFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const ext = file.name.split('.').pop().toLowerCase();
  const arrayBuffer = await file.arrayBuffer();

  let loader;
  if (ext === 'obj') {
    loader = new THREE.OBJLoader();
    const text = new TextDecoder().decode(arrayBuffer);
    const obj = loader.parse(text);
    mesh = obj.children[0];
  } else if (ext === 'glb' || ext === 'gltf') {
    const loaderGlb = new THREE.GLTFLoader();
    const gltf = await loaderGlb.parseAsync(arrayBuffer, '');
    mesh = gltf.scene.children[0];
  } else if (ext === 'fbx') {
    const loaderFbx = new THREE.FBXLoader();
    mesh = loaderFbx.parse(arrayBuffer);
  } else {
    alert("Formato não suportado: " + ext);
    return;
  }

  scene.add(mesh);
}

function generateUV() {
  if (!mesh) return alert("Carregue um modelo primeiro!");
  if (!xatlasReady) return alert("xatlas ainda não está pronto!");

  const geometry = mesh.geometry;
  geometry = geometry.toNonIndexed();  // tornar não indexado (facilita)

  const positions = geometry.attributes.position.array;
  const indices = Array.from({ length: geometry.attributes.position.count }, (_, i) => i);

  // chamar xatlas
  const result = xatlas.generate(positions, indices);
  const uvs = result.uvs;
  const outIndices = result.outIndices;

  // aplicar UV na geometria
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));

  // desenhar a malha UV no canvas 2D
  drawUV(uvs, outIndices);
}

function drawUV(uvs, indices) {
  uvCtx.clearRect(0, 0, uvCanvas.width, uvCanvas.height);
  uvCtx.strokeStyle = "#0f0";
  uvCtx.lineWidth = 0.5;

  const w = uvCanvas.width;
  const h = uvCanvas.height;

  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 2;
    const b = indices[i + 1] * 2;
    const c = indices[i + 2] * 2;
    uvCtx.beginPath();
    uvCtx.moveTo(uvs[a] * w, (1 - uvs[a + 1]) * h);
    uvCtx.lineTo(uvs[b] * w, (1 - uvs[b + 1]) * h);
    uvCtx.lineTo(uvs[c] * w, (1 - uvs[c + 1]) * h);
    uvCtx.closePath();
    uvCtx.stroke();
  }
}

function exportOBJ() {
  if (!mesh) return alert("Carregue um modelo primeiro!");

  const exporter = new THREE.OBJExporter();
  const objText = exporter.parse(mesh);

  const blob = new Blob([objText], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = "modelo_uv.obj";
  a.click();
}

// inicia tudo
init();