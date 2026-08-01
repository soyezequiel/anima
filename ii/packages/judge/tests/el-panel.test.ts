/**
 * EL PANEL DEL JUEZ — «se puede mostrar» del Hito 7.
 *
 * Este test **genera** `ii/docs/panel-del-juez.html`. Es el patrón que el repo
 * ya tiene en `ii/docs/visor/partida.html`: un panel escrito a mano queda viejo
 * el día que cambia un cargo; uno que sale de un test se pone rojo.
 *
 * Y los sujetos son los cinco que el hito juntó: la habilidad honesta, las dos
 * mentirosas, el aparejo que pesca y el palo pelado. Un panel con un solo caso
 * verde no muestra nada.
 */

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildSeedPhysics } from '@anima/physics'
import type { Body } from '@anima/physics'
import { Contexto, Partida } from '@anima/perceive'
import type { BodyView, Ctx, Intent, Outcome, StepResult } from '@anima/skills'
import { done, fail } from '@anima/skills'
import { CONTRATO_SOSTENER, sostener } from '@anima/skills/innatas'
import { describe, expect, it } from 'vitest'
import type { Sujeto } from '../src/ablacion.js'
import { juzgarDispositivo } from '../src/dispositivo.js'
import { EL_ACTOR } from '../src/escena.js'
import { juzgar } from '../src/juzgar.js'
import { panelDe } from '../src/panel.js'
import type { Dictamen } from '../src/tipos.js'

const phys = buildSeedPhysics()
const SEMILLA = 20260727n
type Args = { que: BodyView }

function argsDe(p: Partida): Args | undefined {
  const ctx = new Contexto(p.proyeccion, { actor: EL_ACTOR, rng: p.dado.tirar, lugares: p.lugares }).ctx
  const otros = ctx.see([]).filter((b) => b.id !== `${EL_ACTOR}-cuerpo`)
  return otros[0] === undefined ? undefined : { que: otros[0] }
}

const sujeto = (nombre: string, skill: Sujeto<Args>['skill']): Sujeto<Args> => ({
  acusada: { nombre, contrato: { ...CONTRATO_SOSTENER, nombre } },
  skill,
  argsDe,
})

function* mentirosa(_c: Ctx, _a: Args): Generator<Intent, Outcome, StepResult> {
  return done()
}
function* sobreajustada(ctx: Ctx, args: Args): Generator<Intent, Outcome, StepResult> {
  if (ctx.q(args.que, 'mass') !== 1) return fail('esto no es lo que practiqué')
  return yield* sostener(ctx, args)
}

function obraConPuntas(id: string): Body {
  return {
    id,
    form: 'vara',
    parts: [
      { substance: 'madera', mass: 0.5, q: {} },
      { substance: 'liana', mass: 0.2, q: {} },
    ],
    joints: [{ a: 0, b: 1, via: 'liana', strength: 0.4 }],
    state: {},
  } as unknown as Body
}
function palo(id: string): Body {
  return { id, form: 'vara', parts: [{ substance: 'madera', mass: 0.5, q: {} }], joints: [], state: {} } as unknown as Body
}

/** El sexto sujeto, y entra por el panel: sin él no aparecía `injuzgable`. */
const PIDE_LO_IMPOSIBLE: Sujeto<Args> = {
  acusada: {
    nombre: 'pide-lo-imposible',
    contrato: {
      ...CONTRATO_SOSTENER,
      nombre: 'pide-lo-imposible',
      // El catálogo llega a 0,55 de `toxicity`: no hay materia que lo cumpla,
      // así que no hay mundo donde probarla. Ver el tramo C.
      precondiciones: [{ sujeto: 'el-objetivo', q: 'toxicity', op: '>=', v: 0.6 }],
    },
  },
  skill: sostener,
  argsDe,
}

const DICTAMENES: readonly Dictamen[] = [
  juzgarDispositivo(obraConPuntas('aparejo'), phys, SEMILLA),
  juzgar(sujeto('sostener', sostener), phys),
  juzgar(sujeto('sobreajustada', sobreajustada), phys),
  juzgar(sujeto('mentirosa', mentirosa), phys),
  juzgarDispositivo(palo('palo-pelado'), phys, SEMILLA),
  juzgar(PIDE_LO_IMPOSIBLE, phys),
]

describe('el panel del juez', () => {
  const html = panelDe(DICTAMENES)

  it('SE ESCRIBE, y por eso no se puede pudrir', () => {
    const destino = fileURLToPath(new URL('../../../docs/panel-del-juez.html', import.meta.url))
    writeFileSync(destino, html, 'utf8')
    console.log(`\n  escrito: ii/docs/panel-del-juez.html · ${String(html.length)} bytes · ${String(DICTAMENES.length)} dictámenes`)
    expect(html.length).toBeGreaterThan(1000)
  })

  it('muestra los CUATRO cargos aunque tres estén verdes', () => {
    // El panel existe para que «construye bien y no sirve» no se lea igual que
    // «no lo puede armar». Esconder los verdes deja la mitad de la frase.
    for (const c of ['plano', 'construccion', 'uso', 'utilidad']) expect(html).toContain(`>${c}<`)
  })

  it('muestra LOS MUNDOS DONDE FALLÓ, con nombre', () => {
    // Es la mitad del requisito que se olvida: «no promueve» sin el mundo es un
    // veredicto que no se puede contestar.
    expect(html).toContain('Mundos donde falló')
    expect(html).toContain('al-borde')
  })

  it('los cuatro grados aparecen — un panel de un solo color no muestra nada', () => {
    for (const g of ['promueve', 'no-promueve', 'inconcluso', 'injuzgable']) {
      expect(html, `falta el grado ${g}`).toContain(g)
    }
  })

  it('es DETERMINISTA: sin fecha ni nada que cambie solo', () => {
    // Para que un `git diff` del archivo generado signifique que cambió un
    // veredicto, y no que se volvió a correr.
    expect(panelDe(DICTAMENES)).toBe(html)
    expect(html).not.toMatch(/\b20\d\d-\d\d-\d\d\b/)
  })

  it('un nombre con `<` no rompe la página', () => {
    const roto: Dictamen = { habilidad: '<script>x</script>', cargos: [], grado: 'inconcluso', regresiones: [] }
    expect(panelDe([roto])).not.toContain('<script>x')
  })
})
