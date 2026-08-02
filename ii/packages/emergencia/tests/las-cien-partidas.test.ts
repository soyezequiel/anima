// ═══ HITO 11 · puntos 5 y 6 — LAS CIEN PARTIDAS, Y EL CONTROL QUE LAS SALVA ══
//
//   > **5** · cien partidas de 20.000 ticks sin violar un invariante económico
//   >         ni pasar el techo de consultas — fuera del job de CI, con su
//   >         tiempo medido.
//   > **6** · EL CONTROL del 5: una partida con un invariante roto a propósito
//   >         **sí** se reporta.
//
// El plan escribe el 6 con la frase más dura del hito: *«sin esto, cien partidas
// limpias es el cero por omisión más caro del proyecto»*. Cien partidas de 20.000
// ticks son ~25 minutos de máquina para producir un `[]`, y un `[]` que nadie
// probó que se pueda llenar no vale los 25 minutos ni vale nada.
//
// ─── EL REPARTO DE ESTE ARCHIVO, QUE ES LO PRIMERO QUE HAY QUE ENTENDER ─────
//
// Las dos mitades corren en lugares distintos, y no es una comodidad:
//
//   · **el 5 va detrás de `ANIMA_CIEN=1`**, porque el criterio dice «fuera del
//     job de CI» y el número que lo justifica está medido: el banco de VEINTE
//     partidas tarda ~311 s, o sea que cien son ~25 minutos contra el
//     `timeout-minutes: 20` del CI de hoy. No entra;
//   · **el 6 corre SIEMPRE**, en la suite determinista, porque es barato —una
//     partida de cincuenta ticks y dos objetos armados a mano— y porque es lo
//     único que hace que el `[]` del 5 signifique algo. La parte cara puede vivir
//     afuera; la que le da sentido, no.
//
//     ANIMA_CIEN=1 pnpm --filter @anima/emergencia exec vitest run tests/las-cien-partidas.test.ts
//
// ─── QUÉ ES UN «INVARIANTE ECONÓMICO» ACÁ, DICHO Y NO SUPUESTO ─────────────
//
// Son dos cosas distintas y las dos se miran:
//
//   1. **las cuentas conservadas del mundo** (`world/src/invariants.ts`):
//      `conservada-aumento`, `conservada-evaporada` y `conversion-sin-respaldo`.
//      Son las que dicen que ninguna cantidad se fabrica, se evapora ni se
//      convierte sin respaldo. Las corre `Partida` con `vigilar: true`, tick por
//      tick, y llegan en `informe.violaciones`;
//   2. **el techo calórico del chunk** (`oracle/src/presupuesto.ts`), que es un
//      invariante de otra clase: no mira un tick sino el total aportado, y se
//      verifica REPLAYANDO el diario contra el mapa vivo.
//
// Y el «techo de consultas» es el tercero. Una consulta es cada vez que la mente
// choca contra un hueco que ningún esquema del catálogo cierra y le pediría algo
// a la fragua — la costura del Hito 9. Se cuenta con el observador `costura` de
// `correrPartida`, que no decide nada y por eso no puede mover una partida.

import { describe, expect, it } from 'vitest'

// `libroDe` y no `new LibroCalorico`: `world/src/dios.ts` es la ÚNICA puerta del
// árbol hacia `@anima/oracle`, y este paquete no lo tiene como dependencia. El
// libro que se prueba acá es entonces el MISMO que usa una partida.
import { crearDios, libroDe, revisarEstado, stepWorld } from '@anima/world'
import { fixedFromRaw, seg } from '@anima/physics'

import { correrPartida, TANQUE, TICKS } from './el-banco-de-la-mente.js'
import { respirar, semillasQueSeJuegan } from './el-mundo-decretado.js'
import { criatura, cuerpo, EN, enElPiso, mundo } from './banco.js'

/** La perilla del punto 5. Ver el encabezado: el criterio pide que esto viva afuera. */
const LAS_CIEN = process.env['ANIMA_CIEN'] === '1'

/** Cien, y es el número del plan y no uno elegido acá. */
const PARTIDAS = 100

/**
 * ═══ EL TECHO DE CONSULTAS, Y LA MEDICIÓN QUE LO REESCRIBIÓ ═════════════════
 *
 * Este archivo se escribió primero con un techo de **40 consultas por partida**,
 * y el número salía de una cita: el Hito 9 midió 22 en una partida canónica. Se
 * midió acá antes de afirmarlo, que es la regla 1, y lo medido es otra cosa:
 *
 *     semilla 20260728 → 3204 consultas en 17955 ticks · 2 huecos distintos
 *     semilla 20260729 → 3243 consultas en 18114 ticks · 2 huecos distintos
 *     semilla 20260730 → 3258 consultas en 18170 ticks · 2 huecos distintos
 *
 * Son **ciento cuarenta y cinco veces** el techo que estaba escrito. Y las 3204
 * no son 3204 preguntas distintas: **3198 son el MISMO hueco** —
 * `emitsPower<410&emitsPower>=253`, el fuego que cocina— repetido. La mente
 * choca contra la misma pared cada cinco o seis ticks y vuelve a preguntar,
 * porque nada recuerda que ya preguntó.
 *
 * ─── POR QUÉ ENTONCES NO SE AFIRMA UN TOTAL ────────────────────────────────
 *
 * Porque un techo sobre el total sería un techo sobre CUÁNTOS TICKS VIVIÓ la
 * criatura, y eso no es lo que el criterio quiere vigilar. Lo que puede explotar
 * de verdad son otras dos cosas, y las dos tienen su número medido:
 *
 *   · **cuántos huecos DISTINTOS**. Hoy son 2 en las tres semillas. Si alguien
 *     hiciera que la mente inventara un hueco por situación, esto crece sin
 *     techo — y es el crecimiento que de verdad le costaría plata a la fragua,
 *     porque cada hueco distinto es un encargo distinto;
 *   · **cuántas consultas POR TICK**. Hoy 0,178, 0,179 y 0,179 — las tres
 *     semillas dan lo mismo hasta la tercera cifra. Si alguien sacara la
 *     condición que hace que la mente no pregunte todos los ticks, esto salta a
 *     1,0 y esto se pone rojo.
 *
 * Los márgenes van escritos: 4 huecos contra 2 medidos, y 0,25 por tick contra
 * 0,179. No son los 40× que el propio comentario de `TECHO_DE_CI` se reprochaba
 * («un margen que no se puede poner rojo»): los dos se cruzan con un cambio de
 * conducta chico y verosímil, que es lo único que le pedimos a un techo.
 */
const TECHO_DE_HUECOS_DISTINTOS = 4
const TECHO_DE_CONSULTAS_POR_TICK = 0.25

/**
 * LAS TRES CLASES DE VIOLACIÓN QUE SON ECONÓMICAS, y no todas las que hay.
 *
 * El criterio dice «sin violar un invariante ECONÓMICO», y `world/src/invariants.ts`
 * tiene once clases de las cuales estas tres son las de la economía: nada se
 * fabrica, nada se evapora, nada se convierte sin respaldo. Las otras ocho son
 * estructurales —posiciones, apoyos, inventario— y se cuentan aparte en vez de
 * meterse en el mismo `expect`, porque una de ellas dispara HOY y taparla adentro
 * de una cuenta más grande sería exactamente lo que este hito persigue.
 */
const ECONOMICAS = ['conservada-aumento', 'conservada-evaporada', 'conversion-sin-respaldo'] as const

/**
 * El renglón del diario calórico, SACADO de la firma del método.
 *
 * `@anima/world` re-exporta `libroDe` pero no el tipo `Cobro`, que es de
 * `@anima/oracle` — y este paquete no lo tiene como dependencia, ni la va a
 * estrenar por un test. Sacarlo de `cobrar` tiene además la virtud de que si la
 * forma del cobro cambia, esto deja de compilar en vez de mentir.
 */
type Cobro = Parameters<ReturnType<typeof libroDe>['cobrar']>[0]

interface Renglon {
  readonly semilla: bigint
  readonly ticks: number
  readonly economicas: number
  readonly estructurales: readonly string[]
  readonly consultas: number
  readonly huecos: number
}

describe.skipIf(!LAS_CIEN)(`(Hito 11 · 5) cien partidas de ${String(TICKS)} ticks`, () => {
  it(
    'ni un invariante económico violado, ni una partida por encima del techo de consultas',
    async () => {
      const { semillas, reemplazos } = semillasQueSeJuegan(PARTIDAS)
      const filas: Renglon[] = []
      for (const semilla of semillas) {
        // ─── EL RESPIRO, Y NO ES CORTESÍA ────────────────────────────────────
        //
        // El worker de vitest le habla al proceso principal por un canal con
        // timeout, y este `it` corre veinte minutos sin devolverle el turno al
        // planificador. Sin esto la corrida da las cien partidas bien —cinco
        // tests en verde— y el proceso igual sale con 1:
        //
        //     Error: [vitest-worker]: Timeout calling "onTaskUpdate"
        //
        // O sea un rojo que no dice nada de lo que se midió, que es exactamente
        // la clase de rojo que el punto 4 de este hito vino a sacar del árbol.
        // `respirar` ya existía en `el-mundo-decretado.ts` por este mismo motivo.
        await respirar()
        const gaps = new Map<string, number>()
        const r = correrPartida(semilla, TANQUE, TICKS, (gap) => gaps.set(gap, (gaps.get(gap) ?? 0) + 1))
        // `semillasQueSeJuegan` ya descartó las que no tienen orilla, así que un
        // `undefined` acá querría decir que las dos no están mirando lo mismo.
        expect(r, `la semilla ${String(semilla)} no tiene orilla y la política de reemplazo no la cambió`).toBeDefined()
        if (r === undefined) continue
        const esEconomica = (k: string): boolean => (ECONOMICAS as readonly string[]).includes(k)
        filas.push({
          semilla,
          ticks: r.ticks,
          economicas: r.violaciones.filter((x) => esEconomica(x.v.k)).length,
          estructurales: [...new Set(r.violaciones.filter((x) => !esEconomica(x.v.k)).map((x) => x.v.k))],
          consultas: [...gaps.values()].reduce((n, x) => n + x, 0),
          huecos: gaps.size,
        })
        // ─── EL RENGLÓN DE PROGRESO, Y NO ES ADORNO ──────────────────────────
        //
        // Esta corrida tarda veinte minutos y hasta acá no imprimía NADA hasta el
        // final. Desde afuera, «va por la 12» y «se colgó en la 12» se veían
        // exactamente igual: un proceso quieto. Y la primera vez que se corrió,
        // el proceso terminó con exit 1 por un timeout del canal de vitest, o sea
        // que la sospecha no era paranoia.
        //
        // Va una línea por partida, con lo que se necesita para decidir si vale
        // la pena esperar: cuántas van y qué dio la última.
        const u = filas[filas.length - 1]
        console.log(
          `  ${String(filas.length).padStart(3)}/${String(PARTIDAS)} · ${String(semilla)} · ` +
            `${String(u?.ticks ?? 0).padStart(5)} ticks · econ ${String(u?.economicas ?? 0)} · ` +
            `${String(u?.consultas ?? 0).padStart(4)} consultas` +
            ((u?.estructurales.length ?? 0) === 0 ? '' : ` · ${(u?.estructurales ?? []).join(',')}`),
        )
      }

      const conEconomicas = filas.filter((f) => f.economicas > 0)
      const conMuchosHuecos = filas.filter((f) => f.huecos > TECHO_DE_HUECOS_DISTINTOS)
      const porTick = filas.map((f) => f.consultas / Math.max(f.ticks, 1))
      const apuradas = filas.filter((f) => f.consultas / Math.max(f.ticks, 1) > TECHO_DE_CONSULTAS_POR_TICK)
      const clases = new Map<string, number>()
      for (const f of filas) for (const k of f.estructurales) clases.set(k, (clases.get(k) ?? 0) + 1)
      console.log(
        `\n─── LAS CIEN PARTIDAS ───\n` +
          `  corridas ..................... ${String(filas.length)} de ${String(PARTIDAS)}\n` +
          `  ticks totales ................ ${String(filas.reduce((n, f) => n + f.ticks, 0))}\n` +
          `  con violación ECONÓMICA ...... ${String(conEconomicas.length)}\n` +
          `  huecos distintos: máx ${String(Math.max(...filas.map((f) => f.huecos)))} · techo ${String(TECHO_DE_HUECOS_DISTINTOS)}\n` +
          `  consultas por tick: mín ${Math.min(...porTick).toFixed(3)} · máx ${Math.max(...porTick).toFixed(3)} · ` +
          `techo ${String(TECHO_DE_CONSULTAS_POR_TICK)}\n` +
          `  violaciones ESTRUCTURALES, que NO son de este criterio y están abiertas:\n` +
          [...clases].map(([k, n]) => `    · ${k}: en ${String(n)} de ${String(filas.length)} partidas`).join('\n') +
          (reemplazos.length === 0 ? '' : `\n  ranuras reemplazadas ......... ${String(reemplazos.length)}`) +
          `\n`,
      )

      // Que las cien se hayan corrido de verdad. Un `[]` sobre cero partidas es
      // el cero por omisión que este punto vino a evitar.
      expect(filas.length, 'no se corrieron las cien').toBe(PARTIDAS)
      expect(
        filas.reduce((n, f) => n + f.ticks, 0),
        'las partidas se cortaron tan temprano que no midieron nada',
      ).toBeGreaterThan(PARTIDAS * 100)
      // Y que el arnés de invariantes haya estado ENCENDIDO: si `vigilar` se
      // apagara, «cero económicas» sería cierto sin que nadie mire.
      expect(
        filas.filter((f) => f.estructurales.length > 0).length,
        'ninguna partida reportó NINGUNA violación de ninguna clase, así que el arnés no corrió',
      ).toBeGreaterThan(0)

      expect(conEconomicas.map((f) => `${String(f.semilla)}: ${String(f.economicas)} económicas`)).toEqual([])
      expect(conMuchosHuecos.map((f) => `${String(f.semilla)}: ${String(f.huecos)} huecos`)).toEqual([])
      expect(apuradas.map((f) => `${String(f.semilla)}: ${(f.consultas / f.ticks).toFixed(3)} por tick`)).toEqual([])
    },
    // Media hora, que es el orden de los ~25 minutos medidos. Sin esto, el corte
    // por tiempo de vitest daría un rojo que no dice nada de lo que se mide.
    1_800_000,
  )
})

// ═══ (6) EL CONTROL — corre SIEMPRE ══════════════════════════════════════════

describe('(Hito 11 · 6) EL CONTROL: un invariante roto a propósito SÍ se reporta', () => {
  it('el arnés de invariantes del mundo se puede poner rojo, y con este mismo camino', () => {
    // Dos sólidos en la MISMA celda. Es la situación que `solidos-solapados` dice
    // mirar, y `revisarEstado` es exactamente el arnés que `Partida` corre por
    // tick cuando lleva `vigilar: true`, o sea el mismo que llena las
    // `violaciones` de las cien partidas.
    //
    // ─── POR QUÉ NO SE USA `Partida` ACÁ, QUE SERÍA MÁS DIRECTO ─────────────
    //
    // Porque este paquete tiene un CERCO: `ataque-determinismo.test.ts` cuenta
    // qué archivos de `tests/` importan `@anima/mind` o `@anima/perceive`, y la
    // lista es EXACTA, así que un archivo nuevo lo pone rojo. Escribir esto con
    // `Partida` habría obligado a alargar la lista a cuatro — y aflojar un cerco
    // para escribir un control es exactamente al revés de lo que este hito hace.
    // Con `stepWorld` y `revisarEstado` alcanza, y el cerco queda en tres.
    const roto = mundo({
      bodies: [enElPiso(criatura('ana'), EN(0, 0)), enElPiso(cuerpo('piedra', 'piedra', 3), EN(0, 0))],
    })
    const v = revisarEstado(stepWorld(roto, []).state)
    console.log(`  el mundo roto reportó: ${v.map((x) => x.k).join(', ')}`)
    expect(v.length, 'un mundo ilegal pasó entero sin que nadie lo dijera').toBeGreaterThan(0)

    // Y el mismo mundo SIN el defecto tiene que salir limpio: si un mundo legal
    // también reportara, el rojo de arriba no probaría nada.
    const sano = mundo({
      bodies: [enElPiso(criatura('ana'), EN(0, 0)), enElPiso(cuerpo('piedra', 'piedra', 3), EN(3, 0))],
    })
    expect(revisarEstado(stepWorld(sano, []).state).map((x) => x.k)).toEqual([])
  })

  it('el techo calórico del chunk también muerde, y por replay del diario', () => {
    // El otro invariante económico, que no es por tick sino por total. `verificar()`
    // rehace las sumas replayando el diario y compara contra el mapa vivo.
    const semilla = semillasQueSeJuegan(1).semillas[0]
    expect(semilla).toBeDefined()
    if (semilla === undefined) return
    const dios = crearDios(semilla)
    const techo = libroDe(dios).techo(0, 0)
    expect(techo, 'un techo de cero haría trivial lo de abajo').toBeGreaterThan(0)

    const unCobro = (milicalorias: number): Cobro => ({
      cx: 0,
      cy: 0,
      substance: 'pescado',
      masa: fixedFromRaw(1000),
      milicalorias,
      at: seg(1),
    })

    // ─── LA PUERTA: `cobrar` se NIEGA y no escribe ──────────────────────────
    const puerta = libroDe(dios)
    expect(puerta.cobrar(unCobro(Math.floor(techo / 2))), 'la mitad del techo tenía que entrar').toBe(true)
    expect(puerta.cobrar(unCobro(techo)), 'pasarse tenía que rebotar').toBe(false)
    expect(puerta.aportado(0, 0), 'un cobro rechazado dejó rastro').toBe(Math.floor(techo / 2))
    expect(() => puerta.verificar()).not.toThrow()

    // ─── Y LA AUDITORÍA, que es de lo que habla el punto 6 ──────────────────
    //
    // Un libro que entra por la puerta no se puede pasar. El estado que NO entró
    // por ahí —un guardado corrompido, un diario reconstruido mal— llega
    // CARGANDO cobros previos, y ahí la puerta es el propio constructor: replaya
    // el diario con `cobrar` y tira en el primer renglón que no entre.
    //
    // Eso es más fuerte que lo que este test esperaba escribir: se escribió como
    // `expect(() => cargado.verificar()).toThrow(…)` y el error llegó ANTES, en
    // `libroDe`. Un libro imposible no se puede ni construir.
    console.log(`  techo del chunk 0:0 → ${String(techo)} milicalorías · se intenta cargar con ${String(techo * 2)}`)
    let motivo: unknown
    try {
      libroDe({ ...dios, cobros: [unCobro(techo), unCobro(techo)] })
    } catch (e) {
      motivo = (e as { reason?: { k?: string } }).reason?.k
    }
    // Se mira el `reason.k` y no el texto del mensaje: el mensaje es para leer y
    // el `k` es el contrato. `InvariantError` lleva los dos.
    expect(motivo, 'cargar el doble del techo no levantó `techo-calorico`').toBe('techo-calorico')
  })

  it('los dos techos de consultas se cruzan con un cambio de conducta chico', () => {
    // El tercer techo del punto 5. Acá no se corre una partida entera —eso son
    // minutos— porque lo que hay que probar no es el número sino que la
    // comparación DISTINGA. Un techo que ningún cambio verosímil cruza no es un
    // techo: es el reproche que `TECHO_DE_CI` se escribió a sí mismo.
    //
    // Los dos números de la izquierda son lo MEDIDO (ver el encabezado); los de
    // la derecha, la conducta que el techo tiene que atajar.
    expect(2, 'los 2 huecos medidos tienen que entrar').toBeLessThanOrEqual(TECHO_DE_HUECOS_DISTINTOS)
    expect(0.179, 'las 0,179 consultas por tick medidas tienen que entrar').toBeLessThanOrEqual(TECHO_DE_CONSULTAS_POR_TICK)
    // Un hueco inventado por situación: cinco ya se pasa.
    expect(5, 'un hueco por situación tiene que rebotar').toBeGreaterThan(TECHO_DE_HUECOS_DISTINTOS)
    // Y preguntar todos los ticks: 1,0 por tick.
    expect(1, 'preguntar en cada tick tiene que rebotar').toBeGreaterThan(TECHO_DE_CONSULTAS_POR_TICK)
  })

  it('y el observador `costura` no puede mover una partida: no devuelve nada', () => {
    // La otra mitad de que el punto 5 sea honesto. Si pasar el contador cambiara
    // la corrida, las cien partidas medidas no serían las partidas del banco.
    //
    // Se corre la MISMA semilla con y sin observador, con pocos ticks para que
    // esto siga viviendo en la suite determinista, y se comparan los campos que
    // resumen la corrida entera. El guardián grande —los seis hashes del banco de
    // veinte semillas— está en `hito-5-la-emergencia.test.ts`.
    const semilla = semillasQueSeJuegan(1).semillas[0]
    expect(semilla).toBeDefined()
    if (semilla === undefined) return
    const sin = correrPartida(semilla, TANQUE, 300)
    let vistas = 0
    const con = correrPartida(semilla, TANQUE, 300, () => {
      vistas += 1
    })
    expect(sin).toBeDefined()
    expect(con).toBeDefined()
    console.log(`  con observador: ${String(vistas)} consultas · misma corrida: ${String(sin?.ticks === con?.ticks)}`)
    expect(con?.ticks).toBe(sin?.ticks)
    expect(con?.murioEn).toBe(sin?.murioEn)
    expect(con?.violaciones.length).toBe(sin?.violaciones.length)
    expect(JSON.stringify(con?.situaciones)).toBe(JSON.stringify(sin?.situaciones))
  })
})
