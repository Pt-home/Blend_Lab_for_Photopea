/* sRGB <-> linear conversions for optional linear blend */

function srgbToLinear(u){
  // IEC 61966-2-1
  return (u <= 0.04045) ? (u/12.92) : Math.pow((u+0.055)/1.055, 2.4);
}

function linearToSrgb(u){
  return (u <= 0.0031308) ? (12.92*u) : (1.055*Math.pow(u, 1/2.4) - 0.055);
}

self.srgbToLinear = srgbToLinear;
self.linearToSrgb = linearToSrgb;
