/* Blend Lab — App (UI + worker)
   - File buttons are visually explicit; names are shown below.
   - Canvas: contain+center; panel width adjustable.
   - Linear light OFF by default; auto-preview on relevant changes.
*/

const MODES = [
  "Normal",
  "Darken","Multiply","Color Burn","Linear Burn",
  "Lighten","Screen","Color Dodge","Linear Dodge (Add)",
  "Overlay","Soft Light","Hard Light","Vivid Light","Linear Light","Pin Light","Hard Mix",
  "Difference","Exclusion","Subtract","Divide"
];

const els = {
  fileTop:  document.getElementById('fileTop'),
  fileBase: document.getElementById('fileBase'),
  fileTopName:  document.getElementById('fileTopName'),
  fileBaseName: document.getElementById('fileBaseName'),
  swap: document.getElementById('swapBtn'),
  linear: document.getElementById('linearChk'),
  modeR: document.getElementById('modeR'),
  modeG: document.getElementById('modeG'),
  modeB: document.getElementById('modeB'),
  globOpacity: document.getElementById('globOpacity'),
  update: document.getElementById('updateBtn'),
  exportBtn: document.getElementById('exportBtn'),
  status: document.getElementById('status'),
  canvas: document.getElementById('preview'),
  panelWidth: document.getElementById('panelWidth'),
  panelWidthVal: document.getElementById('panelWidthVal'),
};

let W = 1200, H = 800;
let baseImg = null, topImg = null;

let state = {
  linear: false,
  modesRGB: { R:"Normal", G:"Normal", B:"Normal" },
  opacity: 1.0
};

/* -------------------------------------------------------------------------- */
/* Photopea plugin integration (minimal, non-invasive)                        */
/* -------------------------------------------------------------------------- */
const LAB_ORIGIN = 'https://pt-home.github.io';
const CURRENT_SESSION = (() => {
  const p = new URLSearchParams(location.search).get('sessionId');
  return p || null; // if null, Lab runs standalone (no plugin)
})();
let pluginWin = null; // will store the plugin frame window when LAB_OPEN arrives

// Tiny helper: load image from a blob URL (does not modify existing readImage(file))
async function readImageFromURL(url){
  const img = new Image();
  img.decoding = 'async';
  img.crossOrigin = 'anonymous';
  img.src = url;
  await img.decode();
  return img;
}

/* ensure labels exist (in case HTML not updated for some reason) */
function ensureNameHolder(inputEl, id){
  let el = document.getElementById(id);
  if (el) return el;
  el = document.createElement('div');
  el.id = id; el.className = 'filename'; el.textContent = '—';
  inputEl.insertAdjacentElement('afterend', el);
  return el;
}
els.fileTopName  = els.fileTopName  || ensureNameHolder(els.fileTop,  'fileTopName');
els.fileBaseName = els.fileBaseName || ensureNameHolder(els.fileBase, 'fileBaseName');

/* Panel width */
function applyPanelWidth(vw){
  document.documentElement.style.setProperty('--panelW', `${vw}vw`);
  els.panelWidthVal.textContent = `${vw}vw`;
}
applyPanelWidth(parseInt(els.panelWidth.value,10));
els.panelWidth.addEventListener('input', e => applyPanelWidth(parseInt(e.target.value,10)));

/* Populate selects */
function fillModeSelect(sel){
  sel.innerHTML = MODES.map(m=>`<option value="${m}">${m}</option>`).join('');
}
[els.modeR, els.modeG, els.modeB].forEach(fillModeSelect);
els.modeR.value = state.modesRGB.R;
els.modeG.value = state.modesRGB.G;
els.modeB.value = state.modesRGB.B;

/* Defaults to UI */
els.linear.checked = state.linear;
els.globOpacity.value = Math.round(state.opacity * 100);

/* Throttled render */
let needsRender = false;
function requestRender(){
  if (needsRender) return;
  needsRender = true;
  requestAnimationFrame(()=>{ needsRender = false; refreshPreview(); });
}

/* Control listeners */
els.modeR.addEventListener('change', ()=>{ state.modesRGB.R = els.modeR.value; requestRender(); });
els.modeG.addEventListener('change', ()=>{ state.modesRGB.G = els.modeG.value; requestRender(); });
els.modeB.addEventListener('change', ()=>{ state.modesRGB.B = els.modeB.value; requestRender(); });
els.globOpacity.addEventListener('input', ()=>{ state.opacity = parseFloat(els.globOpacity.value)/100; requestRender(); });
els.linear.addEventListener('change', ()=>{ state.linear = els.linear.checked; requestRender(); });

els.update.addEventListener('click', refreshPreview);
els.exportBtn.addEventListener('click', exportPNG);

/* Image I/O */
async function readImage(file){
  const buf = await file.arrayBuffer();
  const url = URL.createObjectURL(new Blob([buf]));
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  URL.revokeObjectURL(url);
  return img;
}

/* Canvas sizing */
function chooseCanvasSize(){
  const w1 = baseImg ? baseImg.naturalWidth  : 0;
  const h1 = baseImg ? baseImg.naturalHeight : 0;
  const w2 = topImg  ? topImg.naturalWidth   : 0;
  const h2 = topImg  ? topImg.naturalHeight  : 0;
  W = Math.max(w1, w2) || 1200;
  H = Math.max(h1, h2) || 800;
  els.canvas.width = W;
  els.canvas.height = H;
}

/* Paint single image (no worker) */
function paintSingleImage(img){
  chooseCanvasSize();
  const g = els.canvas.getContext('2d');
  g.clearRect(0,0,W,H);
  const sx = W / img.width, sy = H / img.height;
  const s  = Math.min(sx, sy);
  const dw = Math.round(img.width * s), dh = Math.round(img.height * s);
  const dx = Math.round((W - dw)/2), dy = Math.round((H - dh)/2);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, dx, dy, dw, dh);
  setStatus('Single image preview');
}

/* Contained ImageData */
function getContainedImageData(img, w, h){
  const c = document.createElement('canvas'); c.width=w; c.height=h;
  const g = c.getContext('2d');
  g.clearRect(0,0,w,h);
  const sx = w / img.width, sy = h / img.height;
  const s = Math.min(sx, sy);
  const dw = Math.round(img.width * s), dh = Math.round(img.height * s);
  const dx = Math.round((w - dw)/2), dy = Math.round((h - dh)/2);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, dx, dy, dw, dh);
  return g.getImageData(0,0,w,h);
}

/* Worker */
let worker = null;
function initWorker(){
  if (worker) return worker;
  try { worker = new Worker('./worker.js'); }
  catch(e){
    const needServer = location.protocol==='file:' || /SecurityError|origin 'null'|accessed from origin/i.test(String(e));
    if (needServer){
      setStatus("Web Worker cannot load from file://. Run a local server (e.g., python -m http.server 5500).");
    } else { setStatus('Worker creation error: ' + e); }
    throw e;
  }
  return worker;
}
function setStatus(s){ els.status.textContent = s; }

/* Preview */
function refreshPreview(){
  if (baseImg && !topImg){ paintSingleImage(baseImg); return; }
  if (!baseImg && topImg){ paintSingleImage(topImg); return; }
  if (!baseImg && !topImg){ setStatus('Load at least one image.'); return; }

  try { initWorker(); } catch { return; }

  chooseCanvasSize();
  const baseID = getContainedImageData(baseImg, W, H);
  const topID  = getContainedImageData(topImg,  W, H);

  const msg = {
    cmd:'process', width:W, height:H,
    base: baseID.data.buffer, top: topID.data.buffer,
    settings:{ linear: state.linear, modesRGB: state.modesRGB, opacity: state.opacity }
  };

  setStatus('Processing…');
  const t0 = performance.now();
  worker.onmessage = (ev)=>{
    const t1 = performance.now();
    setStatus(`Done (${(t1-t0).toFixed(1)} ms)`);
    const out = new ImageData(new Uint8ClampedArray(ev.data.pixels), W, H);
    const g = els.canvas.getContext('2d'); g.putImageData(out, 0, 0);
  };
  worker.postMessage(msg, [msg.base, msg.top]);
}

/* Export */
function exportPNG(){
  els.canvas.toBlob((blob)=>{
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'blend_lab.png';
    a.click();
    URL.revokeObjectURL(a.href);
  }, 'image/png');
}

/* File events */
els.fileBase.addEventListener('change', async ()=>{
  const f = els.fileBase.files?.[0];
  if (f) {
    els.fileBaseName.textContent = f.name;
    baseImg = await readImage(f);
    if (!topImg) paintSingleImage(baseImg); else refreshPreview();
  } else { els.fileBaseName.textContent = '—'; }
});
els.fileTop.addEventListener('change', async ()=>{
  const f = els.fileTop.files?.[0];
  if (f) {
    els.fileTopName.textContent = f.name;
    topImg = await readImage(f);
    if (!baseImg) paintSingleImage(topImg); else refreshPreview();
  } else { els.fileTopName.textContent = '—'; }
});

els.swap.addEventListener('click', ()=>{
  [baseImg, topImg] = [topImg, baseImg];
  [els.fileBaseName.textContent, els.fileTopName.textContent] =
    [els.fileTopName.textContent, els.fileBaseName.textContent];
  if (baseImg && topImg) refreshPreview();
  else if (baseImg) paintSingleImage(baseImg);
  else if (topImg) paintSingleImage(topImg);
  else setStatus('Load at least one image.');
});

/* -------------------------------------------------------------------------- */
/* Photopea plugin: message listener + export back                            */
/* -------------------------------------------------------------------------- */
window.addEventListener('message', async (ev) => {
  if (!CURRENT_SESSION) return;                 // integration only if launched with ?sessionId
  if (ev.origin !== LAB_ORIGIN) return;         // security: accept only from our GH Pages origin
  const msg = ev.data || {};
  if (!msg || msg.sessionId !== CURRENT_SESSION) return; // ignore foreign sessions

  // Handshake from plugin → reply READY
  if (msg.type === 'LAB_OPEN') {
    pluginWin = ev.source;
    try {
      pluginWin.postMessage({ type: 'LAB_READY', sessionId: CURRENT_SESSION }, LAB_ORIGIN);
    } catch (e) {
      console.warn('Failed to send LAB_READY:', e);
    }
    return;
  }

  // Receive active layer as PNG buffer and route to base / blend
  if (msg.type === 'LAB_IMAGE' && msg.buffer instanceof ArrayBuffer) {
    const { seq, role, name, mime } = msg;
    try {
      const blob = new Blob([msg.buffer], { type: mime || 'image/png' });
      const url  = URL.createObjectURL(blob);
      const img  = await readImageFromURL(url);
      URL.revokeObjectURL(url);

      if (role === 'base') {
        baseImg = img;
        if (els.fileBaseName) els.fileBaseName.textContent = name || 'from Photopea';
      } else if (role === 'blend' || role === 'top') {
        topImg = img;
        if (els.fileTopName) els.fileTopName.textContent = name || 'from Photopea';
      } else {
        console.warn('Unknown role in LAB_IMAGE:', role);
      }

      refreshPreview(); // repaint with new inputs

      // Confirm to plugin that image was applied
      if (pluginWin) {
        pluginWin.postMessage({ type: 'LAB_IMAGE_APPLIED', sessionId: CURRENT_SESSION, seq }, LAB_ORIGIN);
      }
      setStatus('Image from Photopea applied.');
    } catch (e) {
      console.error('LAB_IMAGE handling error:', e);
      setStatus('Error applying image from Photopea.');
    }
    return;
  }
});

/* Hook up "Export PNG to Photopea (new document)" button if present */
const exportToPeaBtn = document.getElementById('exportToPeaBtn');
if (exportToPeaBtn) {
  exportToPeaBtn.addEventListener('click', () => {
    if (!CURRENT_SESSION || !pluginWin) {
      setStatus('Photopea plugin is not connected. Use local Export PNG.');
      return;
    }
    els.canvas.toBlob(async (blob) => {
      if (!blob) return;
      const buf = await blob.arrayBuffer();
      try {
        pluginWin.postMessage({
          type: 'LAB_EXPORT',
          sessionId: CURRENT_SESSION,
          name: 'BlendLab Result.png',
          mime: 'image/png',
          buffer: buf
        }, LAB_ORIGIN, [buf]); // transfer buffer ownership for performance
        setStatus('Sent result to Photopea (new document).');
      } catch (e) {
        console.error('Failed to post LAB_EXPORT:', e);
        setStatus('Failed to send result to Photopea.');
      }
    }, 'image/png');
  });
}

/* Initial status */
if (location.protocol==='file:'){ setStatus("Heads up: opened via file:// — worker will not start. Use a local server."); }
else { setStatus('—'); }
