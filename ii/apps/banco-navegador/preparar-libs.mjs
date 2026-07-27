/**
 * Copia los `lib.*.d.ts` de TypeScript a `public/lib/` para que el banco los
 * pueda pedir por HTTP.
 *
 * No es una comodidad del banco: es lo que la fragua va a tener que hacer de
 * verdad. Para typechequear una habilidad en el navegador hay que tener las
 * declaraciones estándar del lenguaje, y en el navegador no hay `node_modules`:
 * hay que bajarlas. Cuánto pesan es parte de la respuesta que el Hito 0 busca.
 */
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const origen = join(aqui, '../../../node_modules/typescript/lib')
const destino = join(aqui, 'public/lib')

mkdirSync(destino, { recursive: true })

// Solo la cadena de ES2022. Nada de DOM, webworker ni scripthost: el código
// generado corre en el worker del mundo y no tiene ninguna de esas cosas.
// (Y el banco de typecheck en Node ya midió que incluirlas cuesta 2.8×.)
const sirve = (f) =>
  f.startsWith('lib.') &&
  f.endsWith('.d.ts') &&
  !f.includes('dom') &&
  !f.includes('webworker') &&
  !f.includes('scripthost') &&
  !f.includes('esnext') &&
  !f.includes('full')

let n = 0
let bytes = 0
for (const f of readdirSync(origen).filter(sirve)) {
  copyFileSync(join(origen, f), join(destino, f))
  bytes += statSync(join(origen, f)).size
  n++
}

// Y la superficie que ve el código generado, que es lo que el banco
// typechequea. Se copia en vez de importarse para que el navegador la pida por
// HTTP igual que haría la fragua.
copyFileSync(join(aqui, '../../packages/skills/src/skill-api.d.ts'), join(aqui, 'public/skill-api.d.ts'))

console.log(`libs: ${n} archivos, ${(bytes / 1024).toFixed(0)} KB · más skill-api.d.ts`)
