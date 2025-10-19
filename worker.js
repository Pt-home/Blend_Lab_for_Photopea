/* Blend Lab — Worker: per-channel blending only */
importScripts('./blend.js', './color.js');

onmessage = (ev) => {
  if (!ev.data || ev.data.cmd !== 'process') return;

  const { width: W, height: H, settings } = ev.data;
  const base = new Uint8ClampedArray(ev.data.base);
  const top  = new Uint8ClampedArray(ev.data.top);
  const out  = new Uint8ClampedArray(W * H * 4);

  const linear = !!settings.linear;
  const mR = settings.modesRGB?.R || "Normal";
  const mG = settings.modesRGB?.G || "Normal";
  const mB = settings.modesRGB?.B || "Normal";
  const globOpacity = clamp01(settings.opacity ?? 1.0);

  for (let i = 0, j = 0; i < W * H; i++, j += 4) {
    // base / top colors in [0..1]
    let br = base[j]   / 255, bg = base[j+1] / 255, bb = base[j+2] / 255;
    let sr = top[j]    / 255, sg = top[j+1]  / 255, sb = top[j+2]  / 255;
    const ba = base[j+3] / 255;   // base alpha
    const sa = top[j+3]  / 255;   // top alpha
  
    // Optional gamma-linear conversion (work in the selected space)
    if (linear) {
      br = srgbToLinear(br); bg = srgbToLinear(bg); bb = srgbToLinear(bb);
      sr = srgbToLinear(sr); sg = srgbToLinear(sg); sb = srgbToLinear(sb);
    }
  
    // Per-channel blend (separable)
    const Fr = blendChannel(mR, br, sr);
    const Fg = blendChannel(mG, bg, sg);
    const Fb = blendChannel(mB, bb, sb);
  
    // Effective top alpha = layer opacity * top pixel alpha
    const aEff = clamp01(globOpacity * sa);
  
    // Source-over alpha composition
    const outA = aEff + ba * (1 - aEff);
  
    // Premultiplied composition for colors in the current working space
    let or_p = Fr * aEff + br * ba * (1 - aEff);
    let og_p = Fg * aEff + bg * ba * (1 - aEff);
    let ob_p = Fb * aEff + bb * ba * (1 - aEff);
  
    // Un-premultiply (to store straight colors in ImageData)
    let or = (outA > 0) ? (or_p / outA) : 0;
    let og = (outA > 0) ? (og_p / outA) : 0;
    let ob = (outA > 0) ? (ob_p / outA) : 0;
  
    // Back to sRGB if needed
    if (linear) {
      or = linearToSrgb(or); og = linearToSrgb(og); ob = linearToSrgb(ob);
  }

  // Store
  out[j]   = Math.round(clamp01(or) * 255);
  out[j+1] = Math.round(clamp01(og) * 255);
  out[j+2] = Math.round(clamp01(ob) * 255);
  out[j+3] = Math.round(clamp01(outA) * 255);  
}


  postMessage({ pixels: out.buffer }, [out.buffer]);
};

function clamp01(x){ return x<0?0: (x>1?1:x); }

