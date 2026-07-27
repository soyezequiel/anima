/**
 * LOS HUECOS DE LA SUPERFICIE, MEDIDOS CON `tsc`.
 *
 * Cada sonda es el código que una de las quince innatas QUERRÍA escribir. Se
 * compila de verdad, contra el `skill-api.d.ts` emitido, y se registra el
 * error. **El error ES el resultado** — es el mismo idioma con el que se
 * midieron los 28 borradores de la escalera de capacidades.
 *
 * Y hay dos sondas que esperan CERO errores, que es el hallazgo peor: el código
 * compila y hace otra cosa. Un error de compilación cuesta 90 ms; un verde
 * falso cuesta la grilla entera del Hito 7 y encima no dice por qué.
 *
 * POR QUÉ ACÁ Y NO COMO ARCHIVOS EN `src/innatas/`: los quince archivos de
 * verdad COMPILAN, y tienen que seguir compilando — son el entregable. Las
 * sondas no compilan a propósito, y meterlas en `src/` rompería el typecheck
 * del paquete para los otros dos que están trabajando en él. Los borradores
 * resuelven lo mismo con cuatro `tsconfig.tN.json` aparte; acá se resuelve con
 * un directorio temporal, que no deja nada en el árbol.
 */

import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const RAIZ = resolve(__dirname, '..')
const TSC = join(RAIZ, 'node_modules/typescript/bin/tsc')

interface Sonda {
  nombre: string
  porque: string
  cuerpo: string
  /** Códigos de error esperados. Vacío = se espera que COMPILE, y eso es el hallazgo. */
  espera: string[]
}

const CABECERA = `import type { BodyView, Cell, Ctx, RolesOf } from '${join(RAIZ, 'src/ctx').replace(/\\/g, '/')}.js'\n`

const SONDAS: Sonda[] = [
  // ─── Lo que falta, y el compilador lo dice ────────────────────────────────
  {
    nombre: 'canal-de-entrada',
    porque: 'seguir-orden-de-movimiento · `say` sale y nada entra. No hay forma de recibir una orden.',
    cuerpo: 'export function f(ctx: Ctx): string { return ctx.heard() }',
    espera: ['TS2339'],
  },
  {
    nombre: 'cuidador',
    porque: 'seguir-orden-de-movimiento · «vení» y «seguime» necesitan saber dónde está quien pidió.',
    cuerpo: 'export function f(ctx: Ctx): BodyView { return ctx.caretaker }',
    espera: ['TS2339'],
  },
  {
    nombre: 'abortar',
    porque: 'huir-del-dolor · un reflejo que no puede cortar lo que corre no es un reflejo.',
    cuerpo: 'export function f(ctx: Ctx): void { ctx.abort() }',
    espera: ['TS2339'],
  },
  {
    nombre: 'remember',
    porque: 'tantear · `recall` existe y no hay ninguna forma de ESCRIBIR un PlaceMemory.',
    cuerpo: 'export function f(ctx: Ctx, at: Cell): void { ctx.remember(at) }',
    espera: ['TS2339'],
  },
  {
    nombre: 'enumerar-celdas',
    porque: 'guarecerse y huir-del-dolor · `qAt` pide una celda y nada devuelve celdas.',
    cuerpo: 'export function f(ctx: Ctx): Cell[] { return ctx.cellsAround(ctx.self.at, 3) }',
    espera: ['TS2339'],
  },
  {
    nombre: 'catalogo-de-procesos',
    porque: 'aplicar-proceso y comer · los `where` de cada rol viven en la física y no cruzan.',
    cuerpo: "export function f(ctx: Ctx): unknown { return ctx.requires('union') }",
    espera: ['TS2339'],
  },
  {
    nombre: 'umbral-de-ley-ambiente',
    porque: 'frotar · HUMEDAD_QUE_APAGA (0.45) no se puede leer, y por eso está cableada.',
    cuerpo: "export function f(ctx: Ctx): number { return ctx.thresholdOf('combustion', 'moisture') }",
    espera: ['TS2339'],
  },
  {
    nombre: 'blueprints',
    porque: 'guarecerse · `place(bp)` existe y no hay de dónde sacar un `bp`.',
    cuerpo: "export function f(ctx: Ctx): unknown { return ctx.blueprints('techo') }",
    espera: ['TS2339'],
  },
  {
    nombre: 'dolor',
    porque: 'huir-del-dolor · ninguna de las 29 cualidades es daño.',
    cuerpo: "export function f(ctx: Ctx): number { return ctx.q(ctx.self, 'pain') }",
    espera: ['TS2345'],
  },
  {
    nombre: 'amenaza',
    porque: 'huir-del-dolor · nada persigue a la criatura, y si algo lo hiciera no habría con qué verlo.',
    cuerpo: "export function f(ctx: Ctx): BodyView[] { return ctx.see([{ q: 'threat', op: '>', v: 0 }]) }",
    espera: ['TS2322'],
  },
  {
    nombre: 'lluvia',
    porque: 'guarecerse · hay condición de salida (`sheltered`) y no hay condición de entrada.',
    cuerpo: "export function f(ctx: Ctx): number { return ctx.qAt(ctx.self.at, 'raining') }",
    espera: ['TS2345'],
  },
  {
    nombre: 'buscar-techo-con-see',
    porque: 'guarecerse · `sheltered` es de celda: `see()` no la acepta. Se busca con `recall`, que sí.',
    cuerpo: "export function f(ctx: Ctx): BodyView[] { return ctx.see([{ q: 'sheltered', op: '>=', v: 0.5 }]) }",
    espera: ['TS2322'],
  },
  {
    nombre: 'afilar',
    porque: 'aplicar-proceso · `sharpness` está en el catálogo y ningún proceso la sube. Sin afilar no hay lanza.',
    cuerpo:
      "export function f(ctx: Ctx, a: BodyView): unknown { return ctx.apply('afilar', { a, b: a, actor: a }) }",
    espera: ['TS2345'],
  },
  {
    nombre: 'rol-opcional',
    porque:
      'unir · `exactOptionalPropertyTypes` rechaza `b: args.b` con `b?: BodyView`. El modelo lo va a escribir así SIEMPRE.',
    cuerpo:
      'export function f(ctx: Ctx, a: { binder: BodyView; a: BodyView; b?: BodyView }): RolesOf<"union"> {\n' +
      '  return { binder: a.binder, a: a.a, b: a.b }\n}',
    espera: ['TS2375'],
  },
  {
    nombre: 'opcion-opcional',
    porque: 'poner · lo mismo con `put(b, at, { onTopOf })`. Aparece cada vez que un opcional alimenta a otro.',
    cuerpo:
      'export function f(ctx: Ctx, b: BodyView, at: Cell, sobre?: BodyView): unknown {\n' +
      '  return ctx.put(b, at, { onTopOf: sobre })\n}',
    espera: ['TS2379'],
  },

  // ─── LOS FALSOS VERDES. Compilan, y ése es el hallazgo. ───────────────────
  {
    nombre: 'FALSO-VERDE-unidades',
    porque:
      'esperar · `explore.maxTicks` va en TICKS y `clock.secondsToNightfall` en SEGUNDOS. Alimentar uno con el otro compila, y a 20 Hz explora veinte veces menos de lo que se quería. `ctx.hz` permite convertir y nada obliga.',
    cuerpo:
      'export function f(ctx: Ctx): unknown {\n' +
      '  return ctx.explore({ until: () => false, maxTicks: ctx.clock.secondsToNightfall })\n}',
    espera: [],
  },
  {
    nombre: 'FALSO-VERDE-taparme-a-mi-misma',
    porque:
      'guarecerse · `covering` toma un `BodyView` y `SelfView extends BodyView`, así que taparse a una misma typechequea. Si la ley 12 ocluye sobre la criatura no está dicho en ninguna parte: es el mismo modo de fallo que `q(fogata, "oxygen")` antes de que existiera `qAt`.',
    cuerpo:
      'export function f(ctx: Ctx, techo: BodyView): unknown {\n' +
      '  return ctx.put(techo, ctx.self.at, { covering: ctx.self })\n}',
    espera: [],
  },
  {
    nombre: 'FALSO-VERDE-vista-congelada',
    porque:
      '`ctx.self` es una PROPIEDAD. Guardarla en una local antes de un `yield` y releerla después compila, y devuelve el tick viejo. Es lo que rompió cinco de las quince al correrlas.',
    cuerpo:
      'export function f(ctx: Ctx): number {\n' +
      '  const yo = ctx.self\n' +
      '  return yo.holding.length + yo.stamina\n}',
    espera: [],
  },

  // ─── Los controles: si éstos fallan, el arnés no está midiendo nada ───────
  {
    nombre: 'control-lo-que-si-anda',
    porque: 'CONTROL · si esto no compila, todas las sondas de arriba son ruido.',
    cuerpo:
      'export function f(ctx: Ctx, a: BodyView, b: BodyView): number {\n' +
      "  const v = ctx.can('friccion', { a, b, actor: ctx.self })\n" +
      "  const s = ctx.qAt(ctx.self.at, 'sheltered')\n" +
      "  const r = ctx.recall([{ q: 'sheltered', op: '>=', v: 0.5 }])\n" +
      "  return (v.ok ? 1 : 0) + s + r.length + ctx.hz + ctx.self.stamina + ctx.rateOf(a, 'temperature')\n}",
    espera: [],
  },
]

let dir = ''
const salida = new Map<string, string[]>()

function codigos(texto: string): string[] {
  const out: string[] = []
  for (const linea of texto.split('\n')) {
    const m = linea.trimEnd().match(/^(.+?\.ts)\((\d+),(\d+)\): error (TS\d+): /)
    if (m?.[1] && m[4]) out.push(`${m[1].split(/[\\/]/).pop()}:${m[4]}`)
  }
  return out
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'innatas-huecos-'))
  for (const s of SONDAS) writeFileSync(join(dir, `${s.nombre}.ts`), CABECERA + s.cuerpo + '\n')
  writeFileSync(
    join(dir, 'tsconfig.json'),
    JSON.stringify({
      extends: join(RAIZ, '../../tsconfig.base.json').replace(/\\/g, '/'),
      compilerOptions: { noEmit: true, noUnusedLocals: false, noUnusedParameters: false, types: [] },
      include: ['*.ts'],
    }),
  )
  const r = spawnSync(process.execPath, [TSC, '-p', dir], { encoding: 'utf8' })
  const texto = (r.stdout ?? '') + (r.stderr ?? '')
  for (const s of SONDAS) salida.set(s.nombre, [])
  for (const c of codigos(texto)) {
    const [archivo, codigo] = c.split(':')
    const n = archivo?.replace(/\.ts$/, '')
    if (n && codigo) salida.get(n)?.push(codigo)
  }
}, 120_000)

afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
})

describe('los huecos de la superficie, medidos', () => {
  for (const s of SONDAS.filter((x) => x.espera.length > 0)) {
    it(`${s.nombre} — ${s.porque}`, () => {
      const got = salida.get(s.nombre) ?? []
      // No se compara la lista entera: un hueco puede producir errores en
      // cascada. Lo que se afirma es que el error ESPERADO está.
      for (const e of s.espera) expect(got, `${s.nombre} dio [${got.join(', ')}]`).toContain(e)
    })
  }

  describe('LOS FALSOS VERDES — compilan, y ése es el hallazgo', () => {
    for (const s of SONDAS.filter((x) => x.espera.length === 0 && x.nombre.startsWith('FALSO'))) {
      it(`${s.nombre} — ${s.porque}`, () => {
        expect(salida.get(s.nombre), 'si esto empieza a dar error, el hueco se cerró').toEqual([])
      })
    }
  })

  it('control: lo que la API SÍ deja escribir, compila', () => {
    // Una puerta que rechaza todo es trivialmente segura y completamente
    // inútil. Este control es la otra mitad de la medición.
    expect(salida.get('control-lo-que-si-anda')).toEqual([])
  })

  it('el arnés encontró huecos en al menos ocho lugares distintos', () => {
    const conError = SONDAS.filter((s) => (salida.get(s.nombre) ?? []).length > 0)
    expect(conError.length).toBeGreaterThanOrEqual(8)
  })
})
