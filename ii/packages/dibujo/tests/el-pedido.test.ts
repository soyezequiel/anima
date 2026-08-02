// ─── QUÉ SE LE PIDE AL MODELO, Y QUÉ SE LE ACEPTA ───────────────────────────
//
// El encargo no es un texto lindo: es la lista de lo que el mundo sabe de una
// pieza. Si el modelo dibuja una madera dura más apretada que una madera común
// es porque los números se lo dijeron, y este archivo afirma que los números
// están ahí.
//
// Y la otra mitad: lo que se acepta de vuelta. Un modelo contesta con cercas de
// código y con una frase de cortesía adelante casi siempre, así que rechazar por
// eso sería tirar dibujos buenos. Pero limpiar de más es empezar a adivinar qué
// quiso decir, y el costo de rechazar es barato: se dibuja procedural una vuelta
// más, que ya sabemos que se ve bien.

import { describe, expect, it } from 'vitest'

import { buildSeedPhysics, type Physics } from '@anima/physics'

import { encargoDe, loQueHayQuePedir, partirClave, recibir, revisarRespuesta } from '../src/pedido.js'
import { dibujoValido } from './un-dibujo-valido.js'
import { claveDeCriatura, claveDePieza, spritesEnMemoria } from '../src/sprite.js'

const PHYS: Physics = buildSeedPhysics()


describe('(a) la clave se parte y se vuelve a armar', () => {
  it('ida y vuelta', () => {
    expect(partirClave(claveDePieza('vara', 'madera-dura', 24))).toEqual({
      forma: 'vara',
      sustancia: 'madera-dura',
      lado: 24,
    })
  })

  it('EL CONTROL: una clave rota no se entiende, y no explota', () => {
    for (const mala of ['', 'vara', 'vara/madera', 'vara/madera/x', 'vara/madera/2', 'vara/madera/999']) {
      expect(partirClave(mala), mala).toBeUndefined()
    }
  })
})

describe('(b) el encargo dice lo que el mundo sabe', () => {
  it('PIDE UNA COSA, NO UN MATERIAL: es lo que arregló «no se entiende qué es»', () => {
    // El encargo viejo decía «una PIEZA de madera en forma de vara» y el modelo
    // dibujaba eso: una barra de cinco filas sobre veinticuatro. «Un pedazo de
    // madera» no restringe ninguna silueta, y a 24 píxeles la silueta es casi
    // todo el reconocimiento.
    const e = encargoDe(claveDePieza('vara', 'madera', 24), PHYS)
    expect(e).toBeDefined()
    if (e === undefined) return
    expect(e.prompt).toContain('un palo de madera')
    expect(e.prompt).not.toContain('PIEZA de madera en forma de')
    expect(e.lado).toBe(24)
  })

  it('LAS CUALIDADES VIAJAN COMO PALABRAS, no como números', () => {
    // `rigidez 0.70` es una escala abstracta sin referente visual: el modelo
    // tiene que inventarse el mapeo, y el prompt viejo lo empujaba hacia la
    // TEXTURA — que a 24 píxeles es ruido, y el ruido arruinó la rama.
    const e = encargoDe(claveDePieza('vara', 'madera-dura', 24), PHYS)
    expect(e?.prompt).toContain('se quiebra en planos')
    expect(e?.prompt).not.toContain('0.88')
    expect(e?.prompt).not.toContain('rigidez 0')
  })

  it('Y DICE CUÁNTO DEL CUADRO OCUPAR, que era el defecto que nadie nombraba', () => {
    // Nadie dibuja una rama ocupando el 17% del cuadro. Una PIEZA sí, porque es
    // el recorte de algo más grande y un recorte no tiene tamaño natural.
    const e = encargoDe(claveDePieza('vara', 'madera', 24), PHYS)
    expect(e?.prompt).toContain('al menos 20 de las 24 filas')
  })

  it('LA CRIATURA PIDE UNA CRIATURA, y antes pedía «una pieza suelta»', () => {
    // El bug que explicaba la roca mejor que cualquier teoría sobre la clave:
    // `partirClave` daba `forma: 'criatura'`, la tabla de formas no la tenía, y
    // el prompt salía con «la forma "criatura" es una pieza suelta».
    const e = encargoDe(claveDeCriatura('carne', 24), PHYS)
    expect(e).toBeDefined()
    expect(e?.prompt).toContain('una criatura viva, de pie, de frente')
    expect(e?.prompt).toContain('dos piernas con un hueco')
    expect(e?.prompt).not.toContain('pedazo suelto')
  })

  it('DOS SUSTANCIAS PARECIDAS PIDEN DIBUJOS DISTINTOS', () => {
    // Es el caso que motivó el tercer eje: madera y madera-dura son la misma
    // familia y la misma forma. Si el encargo fuera igual, el modelo no tendría
    // manera de dibujarlas distinto y el problema volvería por la ventana.
    const a = encargoDe(claveDePieza('vara', 'madera', 24), PHYS)
    const b = encargoDe(claveDePieza('vara', 'madera-dura', 24), PHYS)
    expect(a?.prompt).not.toBe(b?.prompt)
  })

  it('NO PIDE COLORES: el modelo elige volumen, nunca color', () => {
    const e = encargoDe(claveDePieza('bloque', 'piedra', 24), PHYS)
    expect(e?.prompt).toContain('No elegís colores')
    expect(e?.prompt).toContain('UN 3 NUNCA TOCA EL VACÍO')
  })

  it('y no se le pide dibujar algo que el mundo no tiene', () => {
    expect(encargoDe(claveDePieza('vara', 'unobtanio', 24), PHYS)).toBeUndefined()
  })

  it('lo que hay que pedir sale de lo que falta, en orden', () => {
    const sprites = spritesEnMemoria()
    sprites.pedir(claveDePieza('vara', 'madera', 24))
    sprites.pedir(claveDePieza('bloque', 'piedra', 8))
    const encargos = loQueHayQuePedir(sprites, PHYS)
    expect(encargos.length).toBe(2)
    expect(encargos.map((e) => e.clave)).toEqual([...encargos.map((e) => e.clave)].sort())
  })
})

describe('(c) lo que contesta el modelo', () => {
  const clave = claveDePieza('vara', 'madera', 24)

  it('una respuesta pelada entra', () => {
    const sprites = spritesEnMemoria()
    expect(recibir(sprites, clave, 24, dibujoValido(24).join('\n')).ok).toBe(true)
    expect(sprites.dameYa(clave)).toBeDefined()
  })

  it('CON CERCA DE CÓDIGO Y UNA FRASE ADELANTE, que es lo que pasa siempre', () => {
    const sprites = spritesEnMemoria()
    const texto = ['Acá va tu vara de madera:', '```', ...dibujoValido(24), '```', '¡Espero que te sirva!'].join('\n')
    expect(recibir(sprites, clave, 24, texto).ok).toBe(true)
  })

  it('y con fines de línea de Windows, que ya dejó ciego a un detector de este árbol', () => {
    const sprites = spritesEnMemoria()
    expect(recibir(sprites, clave, 24, dibujoValido(24).join('\r\n')).ok).toBe(true)
  })

  it('LO QUE NO SE ENTIENDE SE RECHAZA: no se adivina qué quiso decir', () => {
    const sprites = spritesEnMemoria()
    const v = recibir(sprites, clave, 24, 'no sé dibujar eso, perdón')
    expect(v.ok).toBe(false)
    expect(sprites.dameYa(clave)).toBeUndefined()
    // Y sigue en la lista de lo que falta, para volver a intentar.
    sprites.pedir(clave)
    expect(sprites.loQueFalta()).toEqual([clave])
  })

  it('EL CONTROL: una respuesta de 23 filas no se completa sola', () => {
    // El modo de falla tentador es rellenar la fila que falta. Sería un dibujo
    // que nadie hizo, y la puerta existe justamente para no hacer eso.
    const sprites = spritesEnMemoria()
    expect(recibir(sprites, clave, 24, dibujoValido(24).slice(1).join('\n')).ok).toBe(false)
  })

  it('y `revisarRespuesta` saca el mismo veredicto sin tocar el repositorio', () => {
    expect(revisarRespuesta(clave, dibujoValido(24).join('\n')).ok).toBe(true)
    expect(revisarRespuesta(clave, 'cualquier cosa').ok).toBe(false)
  })
})
