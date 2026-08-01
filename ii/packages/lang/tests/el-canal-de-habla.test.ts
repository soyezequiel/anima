/**
 * EL CANAL DE HABLA — que esté SEPARADO, y que eso se pueda probar.
 *
 * «Separado» no es una carpeta: es que **nada del tick lo toca**. Si el canal se
 * borrara entero, la criatura haría exactamente lo mismo — sólo que en silencio.
 * Eso es lo que hace cierto el «cuesta 0 en el camino de acción» del documento, y
 * es lo que se afirma acá.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CanalDeHabla, narrarElGap, narrarProgreso } from '../src/habla.js'

describe('el canal de habla', () => {
  it('guarda lo dicho con su tick y su clase', () => {
    const c = new CanalDeHabla()
    c.decir(0, 'acuse', 'dale, voy')
    c.decir(41, 'progreso', 'até dos cosas')
    c.decir(215, 'listo', 'terminé')
    expect(c.cuantos).toBe(3)
    expect(c.ultimo?.clase).toBe('listo')
    // Lo nuevo desde un tick: es lo que una UI pinta sin repintar todo.
    expect(c.desde(41).map((d) => d.clase)).toEqual(['progreso', 'listo'])
  })

  it('no guarda vacíos, y tiene techo', () => {
    const c = new CanalDeHabla()
    c.decir(0, 'acuse', '')
    expect(c.cuantos).toBe(0)
    for (let i = 0; i < 150; i++) c.decir(i, 'progreso', `paso ${String(i)}`)
    // Se tira lo viejo, no lo nuevo: una charla larga no puede crecer sin techo
    // y lo que sirve es lo reciente.
    expect(c.cuantos).toBe(100)
    expect(c.ultimo?.texto).toBe('paso 149')
  })

  it('EL CONTROL DE QUE ESTÁ SEPARADO: el módulo no importa nada del mundo', () => {
    // La prueba de «cuesta 0 en el camino de acción», hecha sobre el fuente. Si
    // este archivo importara `@anima/world` o `@anima/perceive`, hablar podría
    // tocar el tick — y el guardián de la regla 2 no lo vería, porque importar
    // el mundo no está prohibido.
    const fuente = readFileSync(fileURLToPath(new URL('../src/habla.ts', import.meta.url)), 'utf8')
    const codigo = fuente
      .split('\n')
      .filter((l) => {
        const t = l.trimStart()
        return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
      })
      .join('\n')
    expect(codigo).not.toContain('import')
    console.log('  `habla.ts` no importa NADA: no puede tocar el tick ni por accidente')
  })

  it('el progreso se narra por lo que HIZO, no por lo que va a hacer', () => {
    expect(narrarProgreso('até dos cosas', 1)).toBe('até dos cosas')
    expect(narrarProgreso('caminé hasta ahí', 3)).toBe('caminé hasta ahí (3 veces)')
  })

  it('y el gap se narra con los pasos que SÍ se pueden dar', () => {
    // `nearest` son los pasos reversibles que `plan()` da aunque la meta entera
    // no salga. Que existan y que nadie los nombre es lo que hace que la
    // criatura parezca detenida cuando no lo está.
    expect(narrarElGap(0, 'no hay leña')).toContain('no encontré por dónde')
    const con = narrarElGap(3, 'no hay leña')
    expect(con).toContain('3 pasos')
    expect(con).toContain('no hay leña')
  })
})
