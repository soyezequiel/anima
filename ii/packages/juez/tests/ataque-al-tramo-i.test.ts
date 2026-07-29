// ═══ ATAQUE AL TRAMO I ═══════════════════════════════════════════════════════
//
// Este archivo no mide el Hito 5: mide el TRAMO que dice haberlo destrabado. Son
// cinco frentes y cada uno tiene que doler con un número, no con un argumento.
//
// Lo que el tramo afirma, y que acá se pone a prueba una por una:
//
//   (a) «el arnés ya no inventa la escena: sustancia, masa y celda salen de
//       `decretoDe`, o sea de la semilla»;
//   (b) «el `source` de la pesca ya no es cualquier cosa con masa, y no se ató
//       ningún nombre: `portable<=0` es la misma cualidad con la que el mundo
//       rechaza un `take`»;
//   (c) «`cumpleCuerpo` ya contesta `holding(tag:…)`, y el índice es DERIVADO del
//       catálogo, así que el día que el oráculo invente una carne que se llame
//       distinto entra sola»;
//   (d) «no se descarta ninguna semilla».
//
// EL SALDO, con los números de abajo:
//
//   (a) sobrevive casi entera. El arnés NO elige qué hay ni cuánto pesa ni dónde
//       está — verificado. Pero elige UNA cosa que el decreto sí sabía y perdió:
//       la FORMA de las sueltas que el dios sembró para garantizar el chunk
//       (`SueltaSembrable.form`, tirado en `decreto.ts:389`). Medido: 1 de 66.
//       Y «no se descarta ninguna semilla» es falso dicho así: TRECE de las veinte
//       de §10 se reemplazan por no tener orilla. Está publicado en el propio
//       banco, así que no está escondido — está mal resumido.
//   (b) sobrevive el «no ató un nombre»: no hay un `startsWith('pozo:')` ni una
//       comparación contra `name` ni contra `id` en todo el camino del `source`.
//       NO sobrevive el resto: atar una MASA salió más caro que atar un nombre.
//       En ONCE de las veinte partidas canónicas el filtro nuevo deja a la
//       criatura sin un solo banco elegible, y en esas once no tira la caña ni
//       una vez — mientras el mundo, medido, sí le daba pescado.
//   (c) NO sobrevive. El índice no es derivado del catálogo: es un PREFIJO sobre
//       un nombre, y la ley 4 del propio motor fabrica nombres que lo hacen
//       mentir. Un tizón de pescado contesta `carnoso`.
//   (d) ver (a).
//
// ─── LO QUE PASÓ DESPUÉS: DOS DE LOS CUATRO ESTÁN CERRADOS ──────────────────
//
// Este archivo se escribió para atacar y encontró; después vino la reparación y
// los tests de abajo se quedaron midiendo lo MISMO con la afirmación dada vuelta,
// que es la única forma de que un hallazgo no se pierda al arreglarse.
//
//   (b) CERRADO. `roleFilters: {source:[portable<=0]}` salió de la fila y en su
//       lugar está `roleNoDeLaMano: ['source']`, que dice lo que el bug era —«no
//       se pesca adentro de lo que uno lleva agarrado»— sin prohibir ningún
//       banco. Medido acá mismo, mismas veinte semillas: las once que no tiraban
//       la caña una sola vez ahora la tiran las once, y las veinte de veinte
//       pescan (antes 8 de 20). El bloque (3) conserva las dos mediciones que
//       siguen siendo ciertas —los pozos con su masa, y el mundo sacando pescado
//       de un banco de 2,2630 kg— porque son del MUNDO y no del esquema.
//   (c) CERRADO. `TAGS_POR_NOMBRE` se fue entero: `BodyView` publica `tags` con
//       `tagsDe(body, phys)` y la `Physics` VIVA. El bloque (1) queda igual y sin
//       tocar una línea: mide la REGLA DE BAUTISMO de la ley 4, que sigue siendo
//       la misma y sigue siendo la razón por la que no se puede leer el nombre.
//       La contraprueba de que la lectura nueva no miente está en
//       `plan/tests/el-predicado.test.ts` («EL TIZÓN»), donde `cumpleCuerpo` es
//       importable.
//   (a) CERRADO en el dato, que es donde estaba el agujero: `Suelta` lleva ahora
//       un `form?: FormId` y `decretarChunk` lo COPIA de `SueltaSembrable` en vez
//       de tirarlo, así que el arnés lee la forma que el dios eligió y sólo
//       infiere la de lo que `scatter` dejó —que es donde nadie eligió nada—.
//       Arregla de paso al MUNDO, que el día que materialice `chunk.sueltas` iba a
//       tener el mismo agujero. El bloque (2) mide ahora las dos poblaciones.
//   (d) CERRADO en el texto: el encabezado de `el-mundo-decretado.ts` dice ahora
//       que se descartan 13 de las 20 semillas de §10 por no tener orilla, y
//       `columnaDelEncendible` publica las DOS poblaciones en el mismo renglón.
//
// Y una hipótesis del adversario que se cayó, y va escrita porque un ataque que
// sólo publica lo que acertó no es un ataque: el bloque (5) esperaba que la
// criatura se fuera de la isla sembrada y midiera sobre un mundo vacío. **No se
// va**: 0 ticks afuera en tres partidas, y no se aleja más de 4 celdas.

import { describe, expect, it } from 'vitest'

import {
  buildSeedPhysics,
  CELDA_TAPADA,
  correr,
  cumpleRol,
  dtDeFrecuencia,
  HZ_DE_REFERENCIA,
  nameOf,
  qualityOf,
  specOf,
  SUSTANCIAS_SEMILLA,
  unfx,
  unir,
} from '@anima/physics'
import type { Body, FormId, Substance } from '@anima/physics'
import {
  apply,
  crearDios,
  decretoDe,
  idDePozo,
  keyOfCell,
  mapaDeActores,
  mapaDeCuerpos,
  stepWorld,
  type WorldState,
} from '@anima/world'
import { Partida } from '@anima/perceive'
import { Creencias, Mente } from '@anima/mind'

import { potenciaSiArdiera, ROL_A_DE_FRICCION } from '../src/index.js'
import {
  cuerpo,
  escenaDe,
  formaDeLoSuelto,
  laOrilla,
  PARTIDAS,
  RADIO_EN_CHUNKS,
  semillasQueSeJuegan,
} from './el-mundo-decretado.js'

/** El lado del chunk, igual que en el arnés atacado. */
const CELDAS_DE_LADO = 16

/**
 * EL UMBRAL DE `portable`, DESPEJADO ACÁ Y NO IMPORTADO DE `@anima/plan`.
 *
 * `@anima/juez` no depende de `@anima/plan` —y no se le agrega una dependencia
 * para escribir un ataque—, así que el número se saca del MISMO lugar del que lo
 * saca la reparación: la expresión derivada de `portable` en el catálogo. Si el
 * catálogo la cambiara, este archivo se entera igual que el otro.
 */
const MASA_QUE_NO_ENTRA_EN_LA_MANO: number = (() => {
  const e = specOf('portable').derived
  if (e === undefined || e.k !== 'op' || e.f !== 'step' || e.a.k !== 'const') {
    throw new RangeError('`portable` dejó de ser `step(const, mass)`')
  }
  return e.a.v
})()

// ═══ (1) EL ÍNDICE DE NOMBRES NO ES DERIVADO: ES UN PREFIJO ═════════════════

describe('(1) `cumpleCuerpo` contesta `holding(tag:…)` leyendo el NOMBRE, y la ley 4 escribe nombres que mienten', () => {
  it('HALLAZGO · el residuo de la ley 4 hereda el nombre de su madre como PREFIJO', () => {
    // ─── QUÉ SE ATACA ────────────────────────────────────────────────────────
    //
    // `plan/src/predicado.ts` cerró el hueco de `sostiene` con `TAGS_POR_NOMBRE`:
    // un índice `nombre de sustancia → tags` construido desde `SUSTANCIAS_SEMILLA`
    // y consultado por PREFIJO sobre `BodyView.name`. El archivo escribe tres
    // límites y descarta el que importa con este argumento:
    //
    //   «lo que la ley 4 da de alta lleva UN tag y sale de `ClaseDeResiduo`, que
    //    es `'carbonoso' | 'mineral'`, así que ninguna sustancia nacida ahí puede
    //    ser `carnoso` — las seis que lo son están todas en la semilla.»
    //
    // La premisa es cierta y la conclusión no se sigue. El índice NO pregunta por
    // los tags de la sustancia del cuerpo: pregunta si el NOMBRE del cuerpo
    // empieza con el nombre de alguna sustancia de la semilla. Y `residuoDe`
    // (`physics/src/leyes.ts`) bautiza a su criatura así:
    //
    //     nombre: `${madre.lexeme.nombre} ${conservaCarbono ? 'hecho tizón' : 'hecho ceniza'}`
    //
    // O sea que el residuo de un pescado se llama «pescado hecho tizón», y eso
    // empieza con «pescado» seguido de un espacio: exactamente la condición que
    // el índice exigía para contestar. El tizón contestaba `carnoso`.
    //
    // Y no es un caso de laboratorio: la ley 4 es la que corre cuando algo se
    // pasa de fuego, o sea el paso siguiente EXACTO de la cadena que el Hito 5
    // quiere cerrar (pescar → cocinar). Un pescado que se pasó de cocción deja de
    // ser comida y sigue diciéndose carne.
    const phys = buildSeedPhysics()
    const conCarnoso: Substance[] = []
    for (const s of SUSTANCIAS_SEMILLA) if (s.tags.includes('carnoso')) conCarnoso.push(s)

    // El barrido: para CADA sustancia de la semilla, el nombre que le pondría su
    // residuo, y si ese nombre empieza con el nombre de alguna sustancia de la
    // semilla. No se reconstruye `TAGS_POR_NOMBRE`: se mide su ENTRADA.
    const nombresDeLaSemilla = SUSTANCIAS_SEMILLA.map((s) => s.lexeme.nombre)
    const heredan: string[] = []
    for (const s of SUSTANCIAS_SEMILLA) {
      for (const sufijo of ['hecho tizón', 'hecho ceniza']) {
        const nombre = `${s.lexeme.nombre} ${sufijo}`
        // La misma condición que exigía el índice: prefijo, y que termine ahí o
        // siga un espacio.
        const madre = nombresDeLaSemilla.find(
          (n) => nombre.startsWith(n) && (nombre.length === n.length || nombre[n.length] === ' '),
        )
        if (madre !== undefined) heredan.push(`${nombre} → «${madre}»`)
      }
    }

    console.log(
      `\n─── EL NOMBRE DEL RESIDUO, MEDIDO SOBRE LAS ${String(SUSTANCIAS_SEMILLA.length)} SUSTANCIAS ───\n` +
        `  sustancias con tag \`carnoso\`: ${conCarnoso.map((s) => s.lexeme.nombre).join(' · ')}\n` +
        `  residuos cuyo nombre EMPIEZA con el nombre de una sustancia de la semilla: ` +
        `${String(heredan.length)} de ${String(SUSTANCIAS_SEMILLA.length * 2)}\n` +
        `  los seis que importan:\n` +
        heredan
          .filter((h) => conCarnoso.some((s) => h.startsWith(s.lexeme.nombre)))
          .map((h) => `    ${h}`)
          .join('\n') +
        `\n`,
    )

    // Lo que se afirma: TODOS los residuos heredan el prefijo. No hay uno solo que
    // se salve, así que no es un caso de borde: es la regla de bautismo.
    expect(heredan.length).toBe(SUSTANCIAS_SEMILLA.length * 2)
    expect(phys.substances.size).toBe(SUSTANCIAS_SEMILLA.length)
  })

  it('HALLAZGO · y el mundo LO FABRICA: un pescado pasado de fuego se sigue llamando «pescado …»', () => {
    // La mitad de arriba mide la tabla. Ésta mide el MOTOR: se toma un pescado, se
    // lo pone en una celda tapada (oxígeno 0,2, que es lo que la ley 4 lee para
    // decidir residuo carbonoso) a temperatura de fuego, y se lo deja andar. Lo
    // que sale es el cuerpo que la criatura va a tener en la mano, con el nombre
    // que `nameOf` le pone — que es literalmente el `BodyView.name` que
    // `@anima/perceive` publica y que el índice por prefijo leía.
    const phys = buildSeedPhysics()
    const pescado: Body = {
      id: 'pescado',
      form: 'bloque',
      parts: [{ substance: 'pescado', mass: 2.887, q: {} }],
      joints: [],
      state: { temperature: 700 },
    }
    const antes = nameOf(pescado, phys)
    const r = correr(pescado, { celda: { ...CELDA_TAPADA, ambiente: 700 } }, phys, dtDeFrecuencia(HZ_DE_REFERENCIA), 200)
    const despues = nameOf(r.body, r.phys)
    const sustancias = r.body.parts.map((p) => p.substance)
    const tagsReales = r.nuevas.map((s) => `${s.id} ${JSON.stringify(s.tags)}`)

    console.log(
      `\n─── UN PESCADO PASADO DE FUEGO, EN EL MOTOR ───\n` +
        `  antes:   «${antes}»\n` +
        `  después: «${despues}»\n` +
        `  partes:  ${sustancias.join(', ')}\n` +
        `  sustancias que la ley 4 dio de alta: ${tagsReales.length === 0 ? '(ninguna)' : tagsReales.join(' · ')}\n` +
        `  nutrition ${qualityOf(r.body, 'nutrition', r.phys).toFixed(4)} · ` +
        `digestibility ${qualityOf(r.body, 'digestibility', r.phys).toFixed(4)} · ` +
        `calories ${qualityOf(r.body, 'calories', r.phys).toFixed(4)}\n` +
        `  ⇒ el nombre EMPIEZA con «pescado»: ${String(despues.startsWith('pescado '))}\n` +
        `  ⇒ y por eso el índice por PREFIJO contestaba \`carnoso\` sobre esto, o sea que\n` +
        `     \`cumpleCuerpo(holding(tag:carnoso), …)\` decía VERDADERO sobre un carbón.\n` +
        `     CERRADO: la superficie publica \`BodyView.tags = tagsDe(body, phys)\` con la\n` +
        `     Physics viva, así que contesta ["carbonoso"]. La contraprueba con \`cumpleCuerpo\`\n` +
        `     de verdad está en \`plan/tests/el-predicado.test.ts\` («EL TIZÓN»), que es donde\n` +
        `     ese módulo se puede importar. Este bloque queda midiendo lo que NO cambió: la\n` +
        `     regla de bautismo de la ley 4, o sea la razón por la que no se puede leer el nombre.\n`,
    )

    // Lo que se afirma, y es lo único que hace falta para que el hallazgo valga:
    // el motor produjo una sustancia nueva que NO es carnosa, y el cuerpo que la
    // lleva se sigue llamando con el prefijo «pescado ».
    expect(r.nuevas.length).toBeGreaterThan(0)
    for (const s of r.nuevas) expect(s.tags).not.toContain('carnoso')
    expect(despues.startsWith('pescado ')).toBe(true)
    // Y no alimenta: el cuerpo que se sigue llamando carne tiene cero calorías.
    expect(qualityOf(r.body, 'calories', r.phys)).toBe(0)
  })
})

// ═══ (2) EL ARNÉS SÍ ELIGE UNA COSA, Y ES LA QUE DECIDE SI HAY FUEGO ════════

describe('(2) la forma que el dios eligió para GARANTIZAR el chunk, y la que el arnés le pone encima', () => {
  it('CERRADO · el decreto ahora PUBLICA la forma que eligió, y el arnés la lee en vez de re-adivinarla', () => {
    // ─── QUÉ SE ATACA ────────────────────────────────────────────────────────
    //
    // `el-mundo-decretado.ts` dice, y es su defensa central contra «armaste otra
    // escena»: «sustancia, masa y celda salen de `decretoDe`; lo único que el
    // decreto NO dice es la forma, y se infiere con la MISMA regla que
    // `formaDeLoSuelto` de `@anima/oracle` … coinciden en las 30 sustancias».
    //
    // La equivalencia de las dos funciones es cierta y no es el punto. El punto es
    // que hay DOS poblaciones de sueltas en un chunk decretado y no una:
    //
    //   · las de `scatter` (el ruido del bioma), que efectivamente nacen SIN forma
    //     — `Suelta` es `{substance, i, masa}` y nada más—;
    //   · las de `ensureSolvable` (la GARANTÍA de resolubilidad), que nacen CON
    //     forma: `SueltaSembrable` tiene `readonly form: FormId`, y
    //     `resolubilidad.ts:518` la elige de `FORMAS_SEMBRABLES`, que son
    //     exactamente dos —`{vara, 1 kg}` y `{hebra, 0,3 kg}`— y se eligen porque
    //     con ESA forma el rol se llena. La forma no es sabor ahí: es el motivo
    //     por el que la suelta existe.
    //
    // `decretarChunk` (`oracle/src/decreto.ts:389`) las pasa a `Suelta` y **tira
    // el campo `form`**. El arnés lee lo que quedó y vuelve a adivinar. Cuando la
    // adivinanza no coincide con lo que el dios había elegido, el arnés planta
    // otra cosa — y la garantía de que el chunk sea jugable deja de valer sobre el
    // mundo que la criatura de verdad juega.
    //
    // ─── CÓMO SE MIDE SIN PODER LEER EL CAMPO PERDIDO ────────────────────────
    //
    // `FORMAS_SEMBRABLES` tiene DOS entradas y las dos son `vara` o `hebra`. O sea
    // que toda suelta de `sembradas` fue puesta como vara o como hebra, sin
    // excepción posible. Así que cada `sembrada` para la cual el arnés infiere
    // `bloque` es un desacuerdo SEGURO, sin tener que leer el campo. Es una COTA
    // INFERIOR: los desacuerdos vara↔hebra no se ven desde acá.
    const { semillas } = semillasQueSeJuegan(PARTIDAS)
    const filas: string[] = []
    let sembradasTotales = 0
    let conFormaPublicada = 0
    let habriaCambiado = 0
    let sueltasDeRuido = 0
    let ruidoConForma = 0
    const porSustancia = new Map<string, number>()
    for (const semilla of semillas) {
      const o = laOrilla(semilla)
      if (o === undefined) continue
      const acx = Math.floor(o.parada.x / CELDAS_DE_LADO)
      const acy = Math.floor(o.parada.y / CELDAS_DE_LADO)
      let sembradas = 0
      let malas = 0
      for (let dx = -RADIO_EN_CHUNKS; dx <= RADIO_EN_CHUNKS; dx++) {
        for (let dy = -RADIO_EN_CHUNKS; dy <= RADIO_EN_CHUNKS; dy++) {
          const chunk = decretoDe(o.dios, o.phys, acx + dx, acy + dy).chunk
          for (const s of chunk.sembradas) {
            sembradas += 1
            if (s.form !== undefined) conFormaPublicada += 1
            // Lo que la INFERENCIA habría contestado, contra lo que el dios eligió.
            // Sigue siendo una cota inferior cuando `form` falta —los desacuerdos
            // vara↔hebra no se veían—, pero con el campo publicado ya no hace falta
            // acotar nada: se comparan las dos respuestas de frente.
            const inferida: FormId = formaDeLoSuelto(s.substance, o.phys)
            if (s.form !== undefined ? inferida !== s.form : inferida === 'bloque') {
              malas += 1
              porSustancia.set(s.substance, (porSustancia.get(s.substance) ?? 0) + 1)
            }
          }
          // La otra población: lo que dejó `scatter`. Ahí el dios NO eligió forma, y
          // que siga sin traerla es lo correcto —un `FormId` por omisión sería
          // inventar una decisión que nadie tomó—.
          for (const s of chunk.sueltas) {
            if (chunk.sembradas.includes(s)) continue
            sueltasDeRuido += 1
            if (s.form !== undefined) ruidoConForma += 1
          }
        }
      }
      sembradasTotales += sembradas
      habriaCambiado += malas
      filas.push(
        `  ${String(semilla)} · el dios GARANTIZÓ ${String(sembradas).padStart(2)} sueltas · ` +
          `la inferencia le habría cambiado la forma a ${String(malas).padStart(2)}`,
      )
    }
    console.log(
      `\n─── LO QUE EL DIOS SEMBRÓ PARA GARANTIZAR, Y LA FORMA QUE AHORA VIAJA EN EL DATO ───\n` +
        `${filas.join('\n')}\n` +
        `  TOTAL: ${String(sembradasTotales)} garantizadas · ` +
        `${String(conFormaPublicada)} publican su \`form\` en el decreto\n` +
        `  la inferencia (\`formaDeLoSuelto\`) habría discrepado en ${String(habriaCambiado)} de ellas ` +
        `— eso es lo que el arnés le cambiaba antes de que el campo viajara\n` +
        `  por sustancia: ${[...porSustancia].map(([s, n]) => `${s}×${String(n)}`).join(' · ') || '(ninguna)'}\n` +
        `  y la otra población, la de \`scatter\`: ${String(sueltasDeRuido)} sueltas · ` +
        `${String(ruidoConForma)} con forma (tiene que ser 0: ahí el dios no eligió)\n`,
    )
    // Lo que se afirma es la reparación: TODA suelta garantizada publica su forma,
    // y ninguna de las de ruido la inventa. El número de discrepancias va en la
    // salida y no en un `expect`: es la MEDIDA del bug que se cerró, y clavarlo
    // haría rojo el día que el catálogo mueva un umbral, que no es un defecto.
    expect(sembradasTotales).toBeGreaterThan(0)
    expect(conFormaPublicada).toBe(sembradasTotales)
    expect(ruidoConForma).toBe(0)
  }, 900_000)
})

// ═══ (3) EL `source` QUE NO ATÓ UN NOMBRE, PERO SÍ ATÓ UNA MASA ═════════════

describe('(3) el `roleFilters: portable<=0` que estuvo sobre el pozo: el hallazgo y su cierre', () => {
  it('el pozo de cada una de las veinte partidas, con su masa y su `portable`', () => {
    // ─── QUÉ SE ATACA ────────────────────────────────────────────────────────
    //
    // La reparación (a) no ató ningún nombre —verificado leyendo `esquemas.ts` y
    // `regresion.ts`: no hay un `startsWith('pozo:')` ni una comparación contra
    // `name` en ningún lado del camino del `source`— así que el frente 2 del
    // encargo se cierra en falso: NO es `PROTECTED_KINDS` renacido.
    //
    // Lo que sí ató es una MASA: `portable<=0` es `step(8 − mass) <= 0`, o sea
    // «pesa 8 kg o más». La fila lo declara y publica su propio precio («le regala
    // al río las últimas 2 piezas de 45, un 4,4%»). Lo que este bloque mide es si
    // ese 4,4% es el número correcto sobre los pozos que EXISTEN, o si hay pozos
    // que nacen ya por debajo del umbral — en cuyo caso la fila no regala el 4,4%
    // final: prohíbe la pesca entera en esa partida.
    //
    // Y se mide sobre el CUERPO que el mundo materializa, no sobre el `Stock`: lo
    // que el planificador ve es un `BodyView`, y la masa de un banco es
    // `población × masaPorUnidad` (`world/src/dios.ts:435`). Así que se arma la
    // misma escena que juega el banco, se dan cinco ticks para que
    // `materializarPozos` corra, y se le pregunta al cuerpo.
    const { semillas } = semillasQueSeJuegan(PARTIDAS)
    const filas: string[] = []
    let nacenChicos = 0
    let partidas = 0
    let piezasTotales = 0
    let piezasAlcanzables = 0
    let sinUnSoloPozoQueSirva = 0
    for (const semilla of semillas) {
      const o = laOrilla(semilla)
      if (o === undefined) continue
      partidas += 1
      const escena = escenaDe(o, 310)
      const p = new Partida(escena.state)
      for (let i = 0; i < 5; i++) p.tick()
      const w = p.state
      const pozos: string[] = []
      let califican = 0
      let cuantos = 0
      for (const [id, b] of w.bodies) {
        if (!id.startsWith('pozo:')) continue
        cuantos += 1
        const masa = qualityOf(b.body, 'mass', w.phys)
        const port = qualityOf(b.body, 'portable', w.phys)
        pozos.push(`${id} ${masa.toFixed(4)} kg (portable ${port.toFixed(4)})${port > 0 ? '  ← NO CALIFICA' : ''}`)
        if (port > 0) nacenChicos += 1
        else califican += 1
      }
      if (cuantos > 0 && califican === 0) sinUnSoloPozoQueSirva += 1
      const stock = decretoDe(o.dios, o.phys, o.cx, o.cy).pozo?.stock
      const porPieza = stock === undefined ? 0 : unfx(stock.masaPorUnidad)
      const enElPozo = w.bodies.get(`pozo:${String(o.cx)}:${String(o.cy)}`)
      const masaDelDeLaOrilla = enElPozo === undefined ? 0 : qualityOf(enElPozo.body, 'mass', w.phys)
      const piezas = porPieza === 0 ? 0 : Math.floor(masaDelDeLaOrilla / porPieza)
      // Cuántas piezas se pueden sacar ANTES de que el banco caiga por debajo del
      // umbral y el esquema deje de verlo: el banco deja de calificar cuando le
      // quedan menos de `umbral / porPieza` piezas.
      const piso = porPieza === 0 ? 0 : Math.ceil(MASA_QUE_NO_ENTRA_EN_LA_MANO / porPieza)
      const alcanzables = piezas - piso + 1 > 0 ? piezas - piso + 1 : 0
      piezasTotales += piezas
      piezasAlcanzables += alcanzables
      filas.push(
        `  ${String(semilla)} · ${pozos.join(' · ')}\n` +
          `      pieza ${porPieza.toFixed(4)} kg · piezas en el banco de la orilla ${String(piezas)} · ` +
          `alcanzables con el filtro ${String(alcanzables)} · regaladas al río ${String(piezas - alcanzables)}`,
      )
    }
    console.log(
      `\n─── LOS POZOS DE LAS ${String(partidas)} PARTIDAS, CONTRA EL UMBRAL DE \`portable\` (${String(MASA_QUE_NO_ENTRA_EN_LA_MANO)} kg) ───\n` +
        `${filas.join('\n')}\n` +
        `  bancos materializados que quedan por debajo del umbral (el esquema no los ve NUNCA): ${String(nacenChicos)}\n` +
        `  ══ PARTIDAS SIN UN SOLO BANCO QUE EL ESQUEMA PUEDA ELEGIR: ${String(sinUnSoloPozoQueSirva)} de ${String(partidas)} ══\n` +
        `  piezas en total ${String(piezasTotales)} · alcanzables ${String(piezasAlcanzables)} · ` +
        `regaladas ${String(piezasTotales - piezasAlcanzables)} ` +
        `(${(((piezasTotales - piezasAlcanzables) * 100) / Math.max(1, piezasTotales)).toFixed(1)}%)\n`,
    )
    expect(partidas).toBeGreaterThan(0)
  }, 900_000)

  it('HALLAZGO · y el MUNDO sí deja pescar en un banco de 2 kg: el esquema dice que no donde el mundo dice que sí', () => {
    // ─── LA OTRA MITAD DEL HALLAZGO, Y ES LA QUE LO CIERRA ───────────────────
    //
    // Que 36 bancos queden fuera del filtro no prueba nada por sí solo: podría ser
    // que un banco de 2 kg tampoco sirviera para el mundo. Este test lo mide.
    //
    // El mundo decide si algo es un pozo POR IDENTIDAD y no por masa:
    // `stockDe` (`world/src/step.ts:2557-2566`) pregunta `banco.body.id !==
    // idDePozo(cx, cy)` y nada más; el `sin-pozo` de la línea 2604 sale de ahí.
    // Así que un banco liviano es un banco. Acá se comprueba corriendo: la orilla
    // de `20260728n`, cuyo banco pesa 2,2630 kg —o sea `portable = 1` y el
    // `roleFilters` de la fila de la pesca lo descarta—, con una caña de las de
    // `world/tests/hito-5-la-pesca.test.ts`, tirando la misma intención 400 ticks.
    const phys = buildSeedPhysics()
    const dios = crearDios(20260728n)
    const o = laOrilla(20260728n)
    if (o === undefined) throw new Error('la semilla que el banco juega dejó de tener orilla')
    // La caña: una vara de madera con una liana atada de un lado. `union` sin el
    // rol opcional `b` deja la punta suelta, que es lo que da `catch`.
    const vara: Body = { id: 'vara', form: 'vara', parts: [{ substance: 'madera', mass: 1, q: {} }], joints: [], state: {} }
    const hebra: Body = { id: 'h1', form: 'hebra', parts: [{ substance: 'liana', mass: 0.2, q: {} }], joints: [], state: {} }
    const cana = unir(vara, undefined, hebra, phys, 'cana')
    if (cana === undefined) throw new Error('no se pudo atar la caña')

    let w: WorldState = {
      tick: 0,
      hz: HZ_DE_REFERENCIA,
      phys,
      bodies: mapaDeCuerpos([
        { body: cuerpo('ana-cuerpo', 'carne', 2, { stamina: 1000 }, 'bloque'), at: o.parada },
        { body: cana, at: o.parada, heldBy: 'ana' },
      ]),
      actors: mapaDeActores([
        { id: 'ana', body: 'ana-cuerpo', holding: [cana.id], capacity: 3, permits: 'irreversible' },
      ]),
      cells: new Map(),
      nextId: 1,
      dios,
    }
    const banco = idDePozo(o.cx, o.cy)
    let sacados = 0
    const rechazos: Record<string, number> = {}
    let masaInicial = 0
    for (let t = 0; t < 400; t++) {
      if (t === 1) {
        const b = w.bodies.get(banco)
        masaInicial = b === undefined ? 0 : qualityOf(b.body, 'mass', w.phys)
      }
      const i = apply({ by: 'ana', seq: t }, w.phys, 'extraccion', [
        { name: 'gear', body: cana.id },
        { name: 'source', body: banco },
      ])
      const r = stepWorld(w, i === undefined ? [] : [i])
      for (const e of r.events) {
        if (e.k === 'nacio' && e.por === 'rendimiento') sacados += 1
        if (e.k === 'rechazada') rechazos[e.por] = (rechazos[e.por] ?? 0) + 1
      }
      w = r.state
    }
    const b = w.bodies.get(banco)
    const masaFinal = b === undefined ? 0 : qualityOf(b.body, 'mass', w.phys)
    console.log(
      `\n─── EL MUNDO, SOBRE UN BANCO QUE EL ESQUEMA NO MIRA ───\n` +
        `  semilla 20260728 · banco ${banco} · masa al empezar ${masaInicial.toFixed(4)} kg · ` +
        `portable ${b === undefined ? '—' : qualityOf(b.body, 'portable', w.phys).toFixed(4)}\n` +
        `  400 ticks tirando la caña: PIEZAS SACADAS ${String(sacados)}\n` +
        `  rechazos del mundo: ${Object.entries(rechazos).map(([k, v]) => `${k}×${String(v)}`).join(' · ') || '(ninguno)'}\n` +
        `  masa del banco al final ${masaFinal.toFixed(4)} kg\n` +
        `  ⇒ el mundo NO dijo \`sin-pozo\` una sola vez, y sacó pescado.\n` +
        `  ⇒ el \`roleFilters: {source:[portable<=0]}\` de \`esquemas.ts\` le prohíbe a la mente\n` +
        `     elegir este cuerpo como \`source\`, así que en esta partida no hay plan de pesca.\n`,
    )
    // Lo que se afirma, y es todo lo que hace falta: el mundo no rechazó por
    // «sin-pozo» ni una vez sobre un banco que el filtro nuevo descarta.
    expect(rechazos['sin-pozo'] ?? 0).toBe(0)
    expect(sacados).toBeGreaterThan(0)
    expect(masaInicial).toBeLessThan(MASA_QUE_NO_ENTRA_EN_LA_MANO)
  }, 300_000)

  it('CERRADO · la mente ahora SÍ tira la caña en las once que el filtro de masa dejaba mudas', async () => {
    // ─── LA CAUSALIDAD, MEDIDA — Y DESPUÉS LA REPARACIÓN, MEDIDA IGUAL ───────
    //
    // Este test nació midiendo el hallazgo: once de las veinte partidas no tenían
    // un solo banco con `portable <= 0`, y en esas once la mente NO tiraba la caña
    // una sola vez (11 de 11). La afirmación era `sinBancoYSinPesca === sinBanco`.
    //
    // La reparación sacó el `roleFilters: {source:[portable<=0]}` de la fila de la
    // pesca y puso en su lugar `roleNoDeLaMano: ['source']` — que dice lo que el
    // bug realmente era («no se pesca adentro de lo que uno lleva agarrado») sin
    // prohibir ningún banco. Así que lo que este test afirma se DA VUELTA, con la
    // misma medición y sobre las mismas veinte semillas: donde antes no había una
    // sola tirada, ahora tiene que haberlas.
    //
    // Se corre la mente de verdad —`Mente` sobre `Partida`, el bucle de
    // producción— cuatrocientos ticks, y se cuenta si la habilidad de extracción
    // despegó alguna vez. Cuatrocientos y no veinte mil porque en las partidas
    // donde pesca lo hace temprano: el propio banco publica que la caña sale
    // alrededor del tick 35 y el pescado entra a la mano en el 96.
    //
    // La columna `califica` se sigue midiendo con el criterio VIEJO —¿hay algún
    // banco materializado con `portable <= 0`?— a propósito: es la única forma de
    // que las dos corridas se puedan comparar renglón por renglón.
    const { semillas } = semillasQueSeJuegan(PARTIDAS)
    const filas: string[] = []
    let sinBancoYSinPesca = 0
    let sinBanco = 0
    let conBancoYConPesca = 0
    let conBanco = 0
    for (const semilla of semillas) {
      const o = laOrilla(semilla)
      if (o === undefined) continue
      const escena = escenaDe(o, 310)
      const p = new Partida(escena.state)
      const m = new Mente({ actor: 'ana', memoria: new Creencias() })
      let califica = 0
      let despegues = 0
      for (let t = 0; t < 400; t++) {
        if (!p.state.actors.has('ana')) break
        const antes = m.despegues
        m.pensar(p)
        if (m.despegues > antes && (m.ultimoDespegue ?? '').startsWith('aplicar(extraccion')) despegues += 1
        p.tick()
        if (t === 5) {
          for (const [id, b] of p.state.bodies) {
            if (id.startsWith('pozo:') && qualityOf(b.body, 'portable', p.state.phys) <= 0) califica += 1
          }
        }
      }
      if (califica === 0) {
        sinBanco += 1
        if (despegues === 0) sinBancoYSinPesca += 1
      } else {
        conBanco += 1
        if (despegues > 0) conBancoYConPesca += 1
      }
      filas.push(
        `  ${String(semilla)} · bancos pesados (el criterio VIEJO): ${String(califica)} · ` +
          `despegues de \`aplicar(extraccion)\` en 400 ticks: ${String(despegues)}` +
          `${califica === 0 && despegues > 0 ? '   ← ANTES: cero tiradas. AHORA pesca' : ''}`,
      )
    }
    const sinBancoYCONPesca = sinBanco - sinBancoYSinPesca
    console.log(
      `\n─── EL FILTRO DE MASA, SACADO: LA CAÑA QUE AHORA SÍ SE TIRA ───\n${filas.join('\n')}\n` +
        `  sin ningún banco pesado: ${String(sinBanco)} partidas · de ésas, CON tiradas: ${String(sinBancoYCONPesca)} ` +
        `(antes de la reparación: 0)\n` +
        `  con al menos un banco pesado: ${String(conBanco)} partidas · de ésas, CON tiradas: ${String(conBancoYConPesca)}\n`,
    )
    // Lo que se afirma es la implicación DADA VUELTA, que es la reparación: la masa
    // del banco ya no decide si hay pesca. Se pide que TODAS las que el filtro
    // dejaba mudas tiren la caña —no «alguna»—, porque el hallazgo medía 11 de 11 y
    // una reparación que recupere diez de once es una reparación a medias.
    expect(sinBanco).toBeGreaterThan(0)
    expect(sinBancoYCONPesca).toBe(sinBanco)
    expect(sinBancoYSinPesca).toBe(0)
  }, 1_800_000)
})

// ═══ (4) LO QUE LA LEY 8 SE COME, Y NADIE MIRA QUÉ ══════════════════════════

describe('(4) las sueltas que el arnés descarta por celda ocupada', () => {
  it('cuántas se pierden y si alguna era el encendible más liviano de su partida', () => {
    // ─── QUÉ SE ATACA ────────────────────────────────────────────────────────
    //
    // `escenaDe` siembra «la primera de cada celda en el orden canónico del
    // decreto» y descarta la segunda, con este argumento: «es la dirección segura
    // —se pierde materia, no se inventa—». La dirección es segura para el conteo y
    // no lo es para el DIAGNÓSTICO: la columna que este tramo publica como
    // corrección central es «¿hay con qué encender?», y la respuesta se decide con
    // UN cuerpo —el más liviano que cumpla el rol `a` de `friccion`—. Si la que se
    // descarta es justo ésa, el arnés cambia la conclusión del tramo sin que nada
    // lo diga.
    //
    // Acá se reconstruye la MISMA elección de `escenaDe` (la criatura en la
    // `parada`, y después las sueltas en orden canónico, saltando celda ocupada) y
    // se pregunta por las descartadas.
    const { semillas } = semillasQueSeJuegan(PARTIDAS)
    const rolA = ROL_A_DE_FRICCION()
    const filas: string[] = []
    let decretadasTotal = 0
    let perdidasTotal = 0
    let partidasEnQueLaPerdidaEraMasLiviana = 0
    for (const semilla of semillas) {
      const o = laOrilla(semilla)
      if (o === undefined) continue
      const ocupadas = new Set<number>([keyOfCell(o.parada)])
      const acx = Math.floor(o.parada.x / CELDAS_DE_LADO)
      const acy = Math.floor(o.parada.y / CELDAS_DE_LADO)
      let decretadas = 0
      let perdidas = 0
      let mejorSembrada = Number.POSITIVE_INFINITY
      let mejorPerdida = Number.POSITIVE_INFINITY
      for (let dx = -RADIO_EN_CHUNKS; dx <= RADIO_EN_CHUNKS; dx++) {
        for (let dy = -RADIO_EN_CHUNKS; dy <= RADIO_EN_CHUNKS; dy++) {
          const cx = acx + dx
          const cy = acy + dy
          for (const s of decretoDe(o.dios, o.phys, cx, cy).chunk.sueltas) {
            decretadas += 1
            const at = {
              x: cx * CELDAS_DE_LADO + (s.i % CELDAS_DE_LADO),
              y: cy * CELDAS_DE_LADO + Math.floor(s.i / CELDAS_DE_LADO),
            }
            const masa = unfx(s.masa)
            const b = cuerpo('x', s.substance, masa, {}, formaDeLoSuelto(s.substance, o.phys))
            const enciende = cumpleRol(b, rolA, o.phys) && potenciaSiArdiera(b, o.phys) > 0
            if (ocupadas.has(keyOfCell(at))) {
              perdidas += 1
              if (enciende && masa < mejorPerdida) mejorPerdida = masa
              continue
            }
            ocupadas.add(keyOfCell(at))
            if (enciende && masa < mejorSembrada) mejorSembrada = masa
          }
        }
      }
      decretadasTotal += decretadas
      perdidasTotal += perdidas
      const cambio = mejorPerdida < mejorSembrada
      if (cambio) partidasEnQueLaPerdidaEraMasLiviana += 1
      filas.push(
        `  ${String(semilla)} · decretadas ${String(decretadas).padStart(3)} · ` +
          `descartadas ${String(perdidas).padStart(2)} · ` +
          `encendible más liviano SEMBRADO ${mejorSembrada === Number.POSITIVE_INFINITY ? '   —   ' : `${mejorSembrada.toFixed(4)}`} · ` +
          `DESCARTADO ${mejorPerdida === Number.POSITIVE_INFINITY ? '   —   ' : `${mejorPerdida.toFixed(4)}`}` +
          `${cambio ? '   ← EL ARNÉS TIRÓ EL MEJOR' : ''}`,
      )
    }
    console.log(
      `\n─── LO QUE LA LEY 8 SE COME, MIRADO DE CERCA ───\n${filas.join('\n')}\n` +
        `  TOTAL: ${String(decretadasTotal)} decretadas · ${String(perdidasTotal)} descartadas ` +
        `(${((perdidasTotal * 100) / Math.max(1, decretadasTotal)).toFixed(1)}%)\n` +
        `  partidas donde lo descartado era MÁS LIVIANO que lo sembrado: ` +
        `${String(partidasEnQueLaPerdidaEraMasLiviana)}\n`,
    )
    expect(decretadasTotal).toBeGreaterThan(0)
  }, 900_000)
})

// ═══ (5) EL LENTE AL REVÉS: LA ISLA SEMBRADA, Y LA CRIATURA QUE SE VA DE ELLA ═

describe('(5) el mundo decretado se siembra UNA vez y alrededor de la celda de arranque', () => {
  it('HALLAZGO · la criatura camina fuera de lo sembrado, y afuera el mundo no pone nada', async () => {
    // ─── QUÉ COSA HONESTA SIGUE REBOTANDO ────────────────────────────────────
    //
    // Una criatura razonable, con hambre y sin nada a mano que valga la pena, se
    // va a caminar. Es exactamente lo que este tramo midió que la mente hace
    // ahora: el diagnóstico del criterio publica que el bucle nuevo «cae a
    // explorar/guarecerse/juntar, que CAMINAN: −0,08636/tick contra −0,05000».
    //
    // Y ahí choca con la forma del arnés. `escenaDe` siembra las sueltas del
    // decreto **una sola vez, en los 3×3 chunks alrededor de la celda de
    // arranque**, y el mundo no materializa ninguna por su cuenta —el propio banco
    // lo tiene en rojo en su bloque (1)—. O sea que el mundo decretado es una ISLA
    // de 48×48 celdas con materia, rodeada de vacío: los pozos siguen apareciendo
    // donde la criatura vaya (`materializarPozos` la sigue), pero un leño, una
    // corteza o una liana no.
    //
    // Eso muerde justo donde el tramo puso su resultado. Tres de las nueve filas
    // pasaron de EL MUNDO a LA MENTE con el argumento «el mundo SÍ le puso el
    // problema delante en 5 a 7 de las 20 y la mente no lo resolvió». La situación
    // se detecta sobre lo que hay EN LA VISTA, y la vista se vacía en cuanto la
    // criatura sale de la isla. Lo que se mide acá es cuánto de su vida transcurre
    // afuera.
    //
    // Se corren TRES semillas y no veinte, y se dice: son 60.000 ticks de mundo
    // con una mente encima, y el número que hace falta —¿sale o no sale de la
    // isla?— no necesita veinte para contestarse.
    const { semillas } = semillasQueSeJuegan(PARTIDAS)
    const filas: string[] = []
    for (const semilla of semillas.slice(0, 3)) {
      const o = laOrilla(semilla)
      if (o === undefined) continue
      const escena = escenaDe(o, 310)
      const p = new Partida(escena.state)
      const m = new Mente({ actor: 'ana', memoria: new Creencias() })
      // El borde de la isla: los 3×3 chunks alrededor del chunk de la parada.
      const acx = Math.floor(o.parada.x / CELDAS_DE_LADO)
      const acy = Math.floor(o.parada.y / CELDAS_DE_LADO)
      const x0 = (acx - RADIO_EN_CHUNKS) * CELDAS_DE_LADO
      const x1 = (acx + RADIO_EN_CHUNKS + 1) * CELDAS_DE_LADO - 1
      const y0 = (acy - RADIO_EN_CHUNKS) * CELDAS_DE_LADO
      const y1 = (acy + RADIO_EN_CHUNKS + 1) * CELDAS_DE_LADO - 1
      let afuera = 0
      let lejos = 0
      let t = 0
      let murioEn = -1
      for (; t < 20_000; t++) {
        if (p.state.actors.has('ana')) m.pensar(p)
        p.tick()
        const w = p.state
        if (!w.actors.has('ana')) {
          murioEn = t
          break
        }
        const c = w.bodies.get('ana-cuerpo')
        if (c === undefined) continue
        const d = Math.max(Math.abs(c.at.x - o.parada.x), Math.abs(c.at.y - o.parada.y))
        if (d > lejos) lejos = d
        if (c.at.x < x0 || c.at.x > x1 || c.at.y < y0 || c.at.y > y1) afuera += 1
      }
      filas.push(
        `  ${String(semilla)} · ${murioEn < 0 ? `viva a los ${String(t)}` : `murió t=${String(murioEn)}`} · ` +
          `se alejó hasta ${String(lejos)} celdas de la parada · ` +
          `ticks FUERA de los 3×3 sembrados: ${String(afuera)} de ${String(t)} ` +
          `(${((afuera * 100) / Math.max(1, t)).toFixed(1)}%)`,
      )
    }
    console.log(
      `\n─── LA ISLA SEMBRADA Y LO QUE LA CRIATURA HACE CON ELLA ───\n` +
        `  la isla mide ${String((2 * RADIO_EN_CHUNKS + 1) * CELDAS_DE_LADO)}×${String((2 * RADIO_EN_CHUNKS + 1) * CELDAS_DE_LADO)} celdas y se siembra en el tick 0\n` +
        `${filas.join('\n')}\n` +
        `  (afuera hay pozos —\`materializarPozos\` sigue al actor— y NADA MÁS: ni leña, ni corteza, ni liana)\n`,
    )
    expect(filas.length).toBeGreaterThan(0)
  }, 1_800_000)
})
