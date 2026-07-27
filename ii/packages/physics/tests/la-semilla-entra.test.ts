import { describe, expect, it } from 'vitest'
import { admit, porQue } from '../src/admit.js'
import { buildSeedPhysics } from '../src/physics.js'

/**
 * LA OTRA MITAD DEL TRABAJO DE LA PUERTA.
 *
 * Todos los demás tests de ataque preguntan «¿la puerta rechaza lo que tiene
 * que rechazar?». Éste pregunta lo contrario, que es igual de importante y
 * mucho más fácil de olvidarse:
 *
 *   ¿la puerta deja pasar lo que tiene que dejar pasar?
 *
 * Una puerta que rechaza todo es trivialmente segura y completamente inútil, y
 * las dos formas de equivocarse NO son simétricas: dejar pasar de más se
 * endurece después, con otro adversario y otra regla. No dejar construir mata
 * el juego, y lo mata **en silencio** — nadie escribe un test para la habilidad
 * que nunca se le ocurrió que podía existir.
 *
 * Los cuatro procesos semilla son el piso absoluto. Si alguno deja de entrar,
 * la reparación está mal, no el proceso: sin `friccion` no hay primer fuego de
 * la partida, y sin `union` no hay caña.
 */
describe('los cuatro procesos semilla entran', () => {
  const phys = buildSeedPhysics()

  for (const id of ['friccion', 'union', 'deshilachar', 'extraccion'] as const) {
    it(`${id} pasa admit() sin una sola razón en contra`, () => {
      const p = phys.processes.get(id)
      expect(p, `el proceso «${id}» no existe en la física semilla`).toBeDefined()
      const v = admit(p!, phys)
      expect(v.ok, `«${id}» fue rechazado:\n${porQue(v)}`).toBe(true)
    })
  }
})
