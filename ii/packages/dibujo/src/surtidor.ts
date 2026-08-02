// ─── EL SURTIDOR: el que junta las dos puntas ───────────────────────────────
//
// El repositorio sabe qué falta. El encargo sabe qué pedir. El depósito sabe
// guardar. Nadie los une, y esto los une.
//
// ─── ACÁ SÍ HAY `await`, Y HAY QUE DECIR POR QUÉ NO ES UNA EXCEPCIÓN ───────
//
// La regla 2 de `ii/` dice que **el tick no tiene un solo `await`**, y protege al
// TICK: una espera adentro del tick hace que la partida dependa de cuánto tardó
// la red, y con eso el replay muere.
//
// Surtir no pasa por el tick. Es la misma frontera que usaron el Hito 6, el
// tramo H de la fragua y `@anima/store`: **el paquete de adentro describe, el de
// afuera espera**. Y el reparto está a la vista en la firma —`glifoDe` es
// síncrono y no conoce esta función; esta función no dibuja nada—.
//
// Dicho de la forma que importa: **si el surtidor no corre nunca, el juego se ve
// igual que hoy**. Sólo que sin los dibujos del modelo.
//
// ─── LAS CUATRO REGLAS ─────────────────────────────────────────────────────
//
//   1. **el depósito primero, el modelo después.** Preguntar cuesta un viaje;
//      dibujar cuesta un modelo. Si otro jugador ya dibujó esa pieza, no hay
//      nada que inventar — y ése es el punto entero de compartir el depósito;
//   2. **de a poco.** Hay un tope por vuelta, porque `loQueFalta` de un mapa
//      recién abierto son decenas de claves y mandarlas todas juntas es gastar
//      el presupuesto del modelo en cosas que quizá no se vuelvan a ver;
//   3. **lo que falla no rompe nada.** Sin depósito, se le pide al modelo. Sin
//      modelo, se dibuja procedural. Las claves que fallaron quedan pedidas y se
//      reintentan en la vuelta siguiente;
//   4. **lo que entra, se sube.** Un dibujo que pasó la puerta acá le sirve a
//      cualquiera, y no subirlo sería hacer que el próximo jugador lo pague de
//      nuevo.

import type { Physics } from '@anima/physics'

import { loQueHayQuePedir, recibir } from './pedido.js'
import type { ClaveDeSprite, Sprite, Sprites } from './sprite.js'

/** Quien sabe dibujar. Devuelve el texto crudo del modelo, sin interpretar. */
export interface Proveedor {
  dibujar: (prompt: string, clave: ClaveDeSprite) => Promise<string>
}

/**
 * El depósito compartido, visto desde el cliente. Los tres métodos pueden
 * fallar y el surtidor lo espera: un depósito caído no puede apagar el juego.
 */
export interface DepositoRemoto {
  bajarTodo: () => Promise<readonly Sprite[]>
  bajarUno: (clave: ClaveDeSprite) => Promise<Sprite | undefined>
  subir: (s: Sprite) => Promise<void>
}

export interface Resultado {
  /** Los que ya estaban en el depósito: salieron gratis. */
  readonly delDeposito: readonly ClaveDeSprite[]
  /** Los que dibujó el modelo en esta vuelta. */
  readonly delModelo: readonly ClaveDeSprite[]
  /** Los que se pidieron y no entraron, con el motivo. Se reintentan solos. */
  readonly rechazados: readonly { readonly clave: ClaveDeSprite; readonly porque: string }[]
  /** Lo que quedó sin intentar por el tope de la vuelta. */
  readonly enEspera: number
}

export interface ComoSurtir {
  readonly phys: Physics
  readonly proveedor?: Proveedor
  readonly deposito?: DepositoRemoto
  /** Cuántos dibujos nuevos se le piden al modelo por vuelta. */
  readonly tope?: number
}

/**
 * TRAERSE EL CATÁLOGO ENTERO, una vez al abrir.
 *
 * Es la llamada que hace que el jugador número dos vea los dibujos del jugador
 * número uno sin pedirle nada a ningún modelo. Si el depósito no contesta, no
 * pasa nada: se juega con lo procedural.
 */
export async function cargarDeposito(sprites: Sprites, deposito: DepositoRemoto): Promise<number> {
  let entraron = 0
  try {
    for (const s of await deposito.bajarTodo()) {
      // Por la puerta igual, aunque venga del depósito: es dato externo y la
      // puerta es lo único que garantiza que se pueda dibujar.
      if (sprites.guardar(s.clave, s.lado, s).ok) entraron++
    }
  } catch {
    // Un depósito caído no puede apagar el juego. Ver la regla 3.
  }
  return entraron
}

/** Una vuelta de surtido. Se llama fuera del tick, cuando haya un rato. */
export async function surtir(sprites: Sprites, como: ComoSurtir): Promise<Resultado> {
  const tope = como.tope ?? 4
  const delDeposito: ClaveDeSprite[] = []
  const delModelo: ClaveDeSprite[] = []
  const rechazados: { clave: ClaveDeSprite; porque: string }[] = []

  const pendientes = loQueHayQuePedir(sprites, como.phys)
  let pedidosAlModelo = 0

  for (const encargo of pendientes) {
    // ─── 1. El depósito primero: preguntar es más barato que dibujar ──────
    if (como.deposito !== undefined) {
      try {
        const s = await como.deposito.bajarUno(encargo.clave)
        if (s !== undefined && sprites.guardar(s.clave, s.lado, s).ok) {
          delDeposito.push(encargo.clave)
          continue
        }
      } catch {
        // Sigue de largo: si el depósito no está, se le pide al modelo.
      }
    }

    // ─── 2. El modelo, de a poco ──────────────────────────────────────────
    if (como.proveedor === undefined) continue
    if (pedidosAlModelo >= tope) continue
    pedidosAlModelo++

    let texto: string
    try {
      texto = await como.proveedor.dibujar(encargo.prompt, encargo.clave)
    } catch (e) {
      rechazados.push({ clave: encargo.clave, porque: e instanceof Error ? e.message : 'el proveedor falló' })
      continue
    }

    const v = recibir(sprites, encargo.clave, encargo.lado, texto)
    if (!v.ok) {
      // La clave sigue pedida, así que se reintenta en la vuelta siguiente. Un
      // modelo que falla una vez no es un modelo que falla siempre.
      rechazados.push({ clave: encargo.clave, porque: v.porque })
      continue
    }
    delModelo.push(encargo.clave)

    // ─── 3. Lo que entró, se sube: que el próximo no lo pague de nuevo ────
    if (como.deposito !== undefined) {
      try {
        await como.deposito.subir(v.sprite)
      } catch {
        // Que no se pueda compartir no invalida el dibujo: acá ya está.
      }
    }
  }

  return {
    delDeposito,
    delModelo,
    rechazados,
    enEspera: Math.max(0, pendientes.length - delDeposito.length - pedidosAlModelo),
  }
}
