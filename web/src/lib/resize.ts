// Lanczos resizing with pica, standing in for PIL's Image.Resampling.LANCZOS.
// A plain canvas drawImage() resize is bilinear and would give visibly
// different results from the desktop app.

import Pica from 'pica'

// 'js' + 'wasm' only: we already run inside a Web Worker, so pica must not
// start workers of its own ('ww'), and createImageBitmap ('cib') resizing is
// not Lanczos on every browser.
let pica: ReturnType<typeof Pica> | null = null

function getPica() {
  pica ??= Pica({ features: ['js', 'wasm'] })
  return pica
}

/** Resizes RGBA pixels with a Lanczos-3 filter (same kernel as PIL's LANCZOS). */
export async function resizeRgba(
  src: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  toWidth: number,
  toHeight: number,
): Promise<Uint8Array> {
  if (width === toWidth && height === toHeight) return new Uint8Array(src)
  return getPica().resizeBuffer({
    src,
    width,
    height,
    toWidth,
    toHeight,
    filter: 'lanczos3',
  })
}
