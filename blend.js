/* All separable blend modes (per-channel). Inputs in [0,1]. */

function clamp01(x){ return x<0?0:(x>1?1:x); }

function blendChannel(mode, B, S) {
  switch (mode) {
    case "Normal": return S;
    case "Darken": return Math.min(B, S);
    case "Lighten": return Math.max(B, S);
    case "Multiply": return B * S;
    case "Screen": return 1 - (1-B)*(1-S);

    // Photopea/PS (div) with fill=1
    case "Color Dodge": {
      if (B === 0) return 0;
      const t = 1 - S;
      if (B >= t) return 1;
      return Math.min(B / t, 1);
    }

    // Photopea/PS (idiv) with fill=1
    case "Color Burn": {
      const d = S;
      const t = 1 - B;
      if (B === 1) return 1;
      if (t >= d) return 0;
      return 1 - ( t / Math.max(d, 1e-6) );
    }

    case "Linear Dodge (Add)": return clamp01(B + S);
    case "Linear Burn": return clamp01(B + S - 1);

    case "Overlay": return (B <= 0.5) ? (2*B*S) : (1 - 2*(1-B)*(1-S));
    case "Hard Light": return (S <= 0.5) ? (B * (2*S)) : (1 - (1-B)*(2*(1-S)));
    case "Soft Light": return softLight(B, S);

    case "Difference": return Math.abs(B - S);
    case "Exclusion":  return B + S - 2*B*S;
    case "Subtract":   return clamp01(B - S);

    // Divide: Photopea-like epsilon denominator
    case "Divide":     return Math.min(B / Math.max(S, 0.000001), 1);

    case "Vivid Light": return vividLight(B, S);
    case "Linear Light": return clamp01(B + 2*S - 1);
    case "Pin Light": return (S <= 0.5) ? Math.min(B, 2*S) : Math.max(B, 2*S - 1);

    // Hard Mix per Photopea: f>0.99 => step(a+b,1). We fix f=1.0.
    case "Hard Mix": {
      const f = 1.0;
      if (f > 0.99) return (B + S >= 1) ? 1 : 0;
      const EPS = 1e-6;
      return Math.min(1, Math.max(0, (B + S*f - f) / (1 - f + EPS)));
    }

    default: return S;
  }
}

function softLight(B, S) {
  if (S <= 0.5) return B - (1 - 2*S)*B*(1 - B);
  const d = (B <= 0.25) ? (((16*B - 12)*B + 4)*B) : Math.sqrt(B);
  return B + (2*S - 1)*(d - B);
}

function vividLight(B, S) {
  if (S <= 0.5) {
    const s = Math.max(0, Math.min(1, 2*S));
    return (s === 0) ? 0 : 1 - clamp01((1 - B)/s);
  } else {
    const s = Math.max(0, Math.min(1, 2*(1 - S)));
    return (s === 0) ? 1 : clamp01(B / s);
  }
}

self.blendChannel = blendChannel;
