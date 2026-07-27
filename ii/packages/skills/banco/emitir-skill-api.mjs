// ─── La emisión del `skill-api.d.ts` ─────────────────────────────────────────
//
// EL ARCHIVO QUE VE EL MODELO SE EMITE DEL CÓDIGO REAL. No se transcribe.
//
// El documento de arquitectura lo pide con nombre y apellido: «el `.d.ts` se
// emite con `tsc --declaration` del código real. La clase entera de bugs "la
// referencia quedó vieja" desaparece por construcción». Es el bug que
// `DSL_REFERENCE` tiene en Ánima I: una referencia copiada a mano que divergió
// —le faltan seis operaciones y cinco condiciones— y por eso el modelo no puede
// inventar nada que coloque bloques. Ni una parrilla.
//
// Uso:
//   node banco/emitir-skill-api.mjs             regenera src/skill-api.d.ts
//   node banco/emitir-skill-api.mjs --stdout    lo escribe en stdout y no toca nada
//
// ─── Por qué hay que coser dos archivos ─────────────────────────────────────
//
// `tsc --declaration` emite UN `.d.ts` por archivo fuente, y no sabe empaquetar:
// `--outFile` sólo funciona con `amd`/`system` y produce bloques
// `declare module "…"`, que no son importables. Como la fuente son dos archivos
// (`tipos.ts` y `ctx.ts`) y el destino es uno solo, alguien tiene que unirlos.
//
// La costura es de una línea, y eso NO es casualidad: `ctx.ts` importa
// exclusivamente de `./tipos.js`, así que las únicas referencias relativas de
// `ctx.d.ts` son su `import type` y su `export *`. Se borran las dos y se pega
// el resto debajo de `tipos.d.ts`. Cualquier otra referencia relativa que
// aparezca es un error y el emisor se planta: sin esa verificación, la costura
// silenciosamente dejaría un `import` roto adentro del archivo que ES el prompt.

import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PKG = dirname(dirname(fileURLToPath(import.meta.url)))
const EMIT = join(PKG, '.emit')
const DESTINO = join(PKG, 'src', 'skill-api.d.ts')
const TSC = join(PKG, 'node_modules', 'typescript', 'bin', 'tsc')

/** Los dos fuentes, en el orden en que se cosen: primero el vocabulario. */
const PARTES = ['tipos.d.ts', 'ctx.d.ts']

const CABECERA = `// ─── @anima/skills — la superficie que ve el código que escribe el modelo ───
//
// ARCHIVO GENERADO. No se edita a mano: se emite de \`src/tipos.ts\` y \`src/ctx.ts\`
// con \`tsc --declaration\`, y hay un test que falla si lo commiteado difiere de lo
// emitido. Para regenerarlo:
//
//     pnpm --filter @anima/skills emitir-api
//
// Que se emita y no se transcriba es lo que hace imposible la clase entera de
// bugs «la referencia quedó vieja»: si la física suma una cualidad, acá está sin
// que nadie la copie; si alguien escribe acá una cualidad que la física no
// tiene, no compila. En Ánima I la referencia del lenguaje se mantenía a mano en
// \`codex.ts\`, divergió, y por eso el modelo no puede colocar bloques.
//
// Todo lo que sigue sale de \`@anima/physics\`, \`@anima/world\` y \`@anima/oracle\`.
`

/** Una línea que es una sentencia entera hacia `./tipos.js`. */
const HACIA_TIPOS = /from '\.\/tipos\.js';\s*$/

/**
 * El texto del `skill-api.d.ts`, cosido y normalizado a saltos `\n`.
 *
 * Normalizar los saltos no es cosmético: en Windows `tsc` emite CRLF, y si el
 * archivo commiteado y el emitido difieren sólo en eso, el test de no-divergencia
 * se pone rojo por una razón que no tiene nada que ver con la API.
 */
export function emitirSkillApi() {
  rmSync(EMIT, { recursive: true, force: true })
  mkdirSync(EMIT, { recursive: true })
  try {
    const r = spawnSync(process.execPath, [TSC, '-p', join(PKG, 'tsconfig.api.json')], {
      cwd: PKG,
      encoding: 'utf8',
    })
    if (r.status !== 0) {
      throw new Error(`tsc no pudo emitir las declaraciones:\n${(r.stdout ?? '') + (r.stderr ?? '')}`)
    }

    const cuerpos = PARTES.map((parte) => {
      const crudo = readFileSync(join(EMIT, parte), 'utf8').replace(/\r\n/g, '\n')
      // De `ctx.d.ts` se van su `import type … from './tipos.js'` y su
      // `export * from './tipos.js'`: lo que traían ya está pegado arriba.
      return crudo
        .split('\n')
        .filter((l) => !HACIA_TIPOS.test(l))
        .join('\n')
        .trim()
    })

    const texto = `${CABECERA}\n${cuerpos.join('\n\n')}\n`

    // La verificación que hace honesta a la costura. Si algún día `ctx.ts`
    // importa de un tercer archivo del paquete, esto se planta acá en vez de
    // dejar un `import` colgado adentro del archivo que ES el prompt.
    const relativa = texto.match(/from '\.[^']*'/)
    if (relativa) {
      throw new Error(
        `el .d.ts cosido quedó con una referencia relativa (${relativa[0]}): ` +
          'la costura sólo sabe borrar las que van a ./tipos.js. Ver el encabezado de este script.',
      )
    }
    return texto
  } finally {
    rmSync(EMIT, { recursive: true, force: true })
  }
}

export const RUTA_SKILL_API = DESTINO

// `resolve` de los dos lados: en Windows `process.argv[1]` viene con barras
// invertidas y `fileURLToPath` no, y comparar las cadenas crudas nunca daría true.
const invocadoDirecto =
  process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))

if (invocadoDirecto) {
  const texto = emitirSkillApi()
  if (process.argv.includes('--stdout')) {
    process.stdout.write(texto)
  } else {
    writeFileSync(DESTINO, texto)
    process.stderr.write(`skill-api.d.ts emitido: ${texto.split('\n').length} líneas\n`)
  }
}
