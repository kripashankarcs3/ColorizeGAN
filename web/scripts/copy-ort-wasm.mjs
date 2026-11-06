// Copies the onnxruntime-web WebAssembly binary from node_modules into
// public/ort/ so the site serves it itself (no CDN). Runs before dev/build.
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(webRoot, 'node_modules', 'onnxruntime-web', 'dist')
const target = join(webRoot, 'public', 'ort')

// The "onnxruntime-web/wasm" bundle already contains the JS glue code,
// so only the .wasm binary has to be served as a static file.
const files = ['ort-wasm-simd-threaded.wasm']

mkdirSync(target, { recursive: true })
for (const file of files) {
  copyFileSync(join(source, file), join(target, file))
  console.log(`copied ${file} -> public/ort/`)
}
