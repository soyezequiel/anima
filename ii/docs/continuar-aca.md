# Continuar acá — traspaso del Hito 5

Este archivo existe para que **otra sesión, en otra cuenta, sin nada de la
conversación anterior**, pueda seguir sin volver a descubrir lo que ya se
descubrió. Lo que estaba en la memoria personal de la cuenta anterior se bajó
acá, porque la memoria es por cuenta y no viaja.

Última actualización: 2026-07-29, commit `75b820f`.

---

## 0 · Lo primero que hay que leer, en este orden

1. Este archivo, entero.
2. [`ii/README.md`](../README.md) — el índice del remake y sus tres reglas.
3. [`docs/architecture/remake-anima-ii.md`](../../docs/architecture/remake-anima-ii.md)
   — la arquitectura. La sección del **Hito 5** (cerca de la línea 1452) es el
   criterio de corte del proyecto.
4. [`ii/docs/decisions/`](decisions/) — **13 ADRs propios**. Los que más pesan hoy:
   II-0001 (encender no es una acción), II-0007 (el tick es un parámetro),
   II-0008 (el tiempo va en segundos), II-0009 (el hambre mata), II-0010 (frotar
   no relaja), II-0011 (arder libera calor), II-0012 (el presupuesto del plan va
   en expansiones), II-0013 (el veneno se cobra al tragar).

---

## 1 · Dónde está el proyecto

**Nueve paquetes, 2315 tests verdes, nueve typechecks limpios, 68 huecos
`it.fails` anotados.** Cuarenta commits por delante de `main`, en la rama
`anima-2`. **Ninguno pusheado** — el usuario pushea solo. Si la sesión nueva es
en otra máquina, hay que pushear antes.

| paquete | qué es | tests |
|---|---|---:|
| `@anima/physics` | materia, 12 leyes, `admit()`, 4 procesos aplicables | 605 |
| `@anima/world` | el árbitro determinista, `stepWorld`, metabolismo, reloj | 489 |
| `@anima/oracle` | el dios perezoso, biomas, pozos, libro calórico | 268 |
| `@anima/skills` | el sandbox y las 15 innatas | 193 |
| `@anima/perceive` | LA COSTURA mundo↔habilidades, `Partida`, `ticksPerdidos` | 107 |
| `@anima/plan` | `SCHEMA_INDEX`, `goalGraph()`, `plan()` anytime | 282 |
| `@anima/mind` | necesidades, creencias β, `opportunities()`, escalera D0–D5 | 258 |
| `@anima/juez` | el detector de secuencias de emergencia, **externo a propósito** | 113 |

Comandos: `pnpm ii:test` · `pnpm ii:typecheck` · bancos con `ANIMA_BANCO=1`.

---

## 2 · El Hito 5, criterio por criterio

Es el **criterio de corte**: si pasa, hay producto aunque el modelo nunca se
conecte; si no pasa, el plan se para acá y se revisa antes de gastar en la fragua.

| criterio | veredicto | número medido |
|---|---|---|
| proveedor apagado | **CUMPLE** | 0 llamadas a la red, 0 dependencias de runtime fuera de `ii/` |
| la cadena de la caña | **CUMPLE** | 7 eslabones; caña en el tick 35, pescado en la mano en el 96 |
| `ticksPerdidos === 0` | **CUMPLE** | 0 en 20.000 ticks, con reloj de pared |
| p99 < 5 ms con 5000 cuerpos | **NO cumple — ACEPTADO por el usuario** | 30,94 ms (6,2×) |
| **sobrevive 20.000 ticks sola** | **NO CUMPLE** | muere en 3627, **0 bocados** |
| emergencia: ≥4 de 10 en 20 partidas | **NO CUMPLE** | 0 de 9, contra 1 de 9 del azar |

### Lo único que falta para el criterio de sobrevivir

Está reducido a una línea, y las dos contrapruebas lo aíslan:

```
gap · missing «emitsPower<410 & emitsPower>=253»
      ningún esquema conocido establece «emitsPower<410»
      (lo más cerca que llega el catálogo es «emitsPower>0»)
```

**La mente sabe LIGAR un fuego, no sabe PEDIR uno de la potencia justa.**

- Con un leño dentro de esa ventana (310,62), el plan **cierra**.
- Con una despensa de cocidos regalada, la misma mente **sobrevive los 20.000**
  con 65 bocados y aliento final 1,4593.

O sea: falta encender, no usar. El planificador necesita poder pedir un fuego con
la potencia acotada por arriba y por abajo, y hoy sólo sabe pedir «que arda».

### Por qué muere ANTES que antes (3627 contra 6194) y NO es un retroceso

Está medido, no argumentado:

- la vieja se quedaba **parada** al lado del pozo: `−0,05000/tick`, que es
  exactamente `COSTO_VIVIR_POR_SEGUNDO / hz`. Pagaba sólo por respirar.
- la nueva consigue el pescado, sube la meta a lo cocido, el plan se corta y cae a
  explorar/juntar/guarecerse, que **caminan**: `−0,08636/tick`, **1,73×**.

El criterio no se mide en ticks aguantados sino **en si comió**, y en las dos
comió cero.

---

## 3 · Cómo se trabaja acá — esto es lo que más importa

El usuario lo dijo así en la primera línea de la sesión anterior, y sostenerlo es
más importante que la velocidad.

- **Ningún hito se cumple sin su criterio verificable, escrito de antemano.** Tres
  criterios se pasaron y **no se ablandaron por cuenta propia**: se midieron, se
  presentaron las salidas y decidió el usuario. Si otro se pasa, hacer lo mismo.
- **Un hueco abierto se marca con `it.fails()` y el porqué MEDIDO al lado.** Nunca
  se debilita un test para dar verde. Hoy hay 68 anotados.
- **Los adversarios son la mitad del trabajo**, y hace falta uno **con el lente al
  revés**: el que busca cosas HONESTAS que el sistema rebota. Ese lente encontró
  que `comer` no se podía escribir — o sea que la criatura pescaba y no comía.
- **Verificá vos lo que reportan los agentes.** Ver la sección 5: van **catorce**
  números corregidos, y dos de ellos eran conclusiones enteras que estaban mal.
- **Un test de rendimiento adentro de la suite normal es un test flaky, y un test
  flaky es peor que ninguno: enseña a ignorar el rojo.** El patrón decidido es
  `const MIDIENDO_EN_SERIO = process.env['ANIMA_BANCO'] === '1'`: se imprime
  siempre, se afirma sólo midiendo en serio. Ver `world/tests/banco-el-tick.test.ts:165`.
  Y cuando se puede, mejor todavía: **afirmar el mecanismo en vez del reloj**
  (que la segunda mirada devuelva los mismos objetos prueba la caché sin
  cronómetro, y no depende de cuántos núcleos haya libres).
- **Se trabaja con workflows de agentes en paralelo sobre archivos disjuntos.** Se
  commitea cuando un tramo está verde y verificado, **sin pushear**.

---

## 4 · Decisiones tomadas — no volver a preguntarlas

- **El modelo escribe habilidades y nada más** (ADR II-0001): no toca física,
  motor, UI ni persistencia.
- **El tick es un parámetro de RENDIMIENTO y las tasas de las leyes son de
  RITMO** (ADR II-0007). Nunca se arregla uno moviendo el otro.
- **El tiempo del mundo va en segundos, no en ticks** (ADR II-0008): cocinar tarda
  lo mismo a 10, 20, 25, 50 o 100 Hz.
- **El presupuesto de `plan()` va en expansiones, no en milisegundos** (ADR
  II-0012). Es el mismo movimiento por tercera vez: lo que es RITMO va en unidades
  del mundo, lo que es RENDIMIENTO en unidades de la máquina.
- **El veneno se cobra al tragar** (ADR II-0013), decidido por el usuario.
- **El p99 que falla por 6,2× está ACEPTADO.** Queda `it.fails` como aspiración y
  hay una guarda verde en 45 ms: aceptar un número no es dejar de vigilarlo.
- **La UI va DESPUÉS del Hito 5.** Se preguntó y el usuario eligió terminar el
  criterio de corte primero.

---

## 5 · Los catorce números corregidos, y la regla que dejó cada uno

Esto es lo más caro de la sesión anterior y lo que más fácil se pierde. **Dos
fueron conclusiones enteras que estaban mal y que ya habían viajado a
documentos.**

1. **«El fuego no se propaga»** — falso. La cuenta era correcta sobre piezas
   SUELTAS: la corteza más grande que un bioma siembra (0,5 kg) entrega 175,32 °C
   contra los 300 que pide la madera. Pero **dos cortezas atadas** pesan 1 kg y
   entregan **335,64**; el leño llegó a 933,83 °C en el mundo. Medido en
   `world/tests/el-fuego-no-se-propaga.test.ts`.
   → **REGLA: medir el catálogo no es medir el mundo.** Antes de aceptar «el mundo
   no permite X», probá X con `unir`, con varias piezas y con las quince innatas
   encadenadas. Y antes de cambiar el mundo para desbloquear algo, medí si ya está
   desbloqueado.
2. **«Pescó 199 veces y se murió de hambre»** — pescó UNA. El contador leía
   **despegues** de la habilidad, no aterrizajes: 199 despegues, 1 aterrizaje, 197
   rechazos. → **REGLA: no midas el proxy, medí la cosa.**
3. **«El mundo no permite fuego: el encendible más liviano pesa 1,0000 kg»** —
   era el arnés, que plantaba `cuerpo('vara', 'madera', 1)` a mano. Veinte
   semillas distintas dando el mismo número al cuarto decimal no es un sorteo. El
   dios decreta: **13 de 20 semillas con vara encendible, la más liviana 0,0610 kg**
   (el techo es 0,7132). Medido en `juez/tests/lo-que-el-mundo-si-siembra.test.ts`.
4. **«El azar firma 3 de 9»** — firma **1**. Las tres se midieron sobre una escena
   propia del control (10 sueltas de una tabla a mano, 4 peces regalados, mundo
   5×5 sin dios), donde las nueve daban situación 20/20. Eso no es la firma de un
   sorteo: es la de una escena inventada.
5. **«1 de 66 formas re-adivinadas»** — eran **54 de 66**: el número del adversario
   era cota inferior porque sólo veía los desacuerdos hacia `bloque`.
6. **«Faltan 5 ticks para los 20.000»** — encuadre engañoso: 1000 de tanque son
   exactamente 1000 segundos de vida a 1,0/s, o sea que había sobrevivido lo que
   traía puesto **sin comer nada**.
7. **Un ADR que exageraba**: II-0009 inventó «comer crudo negativo y cocinar
   positivo» mientras calibraba una constante, y resultó **un conjunto vacío**
   (0,495/s contra 0,766/s, los bordes se cruzan).
   → **REGLA: cuando un criterio falla, volvé al texto que lo pidió y no al
   documento intermedio que lo reformuló.** Un ADR que calibra una constante
   tiende a escribir, para justificarla, una promesa más ambiciosa que el criterio.
8. Y otros siete de menor porte: el techo de la fricción (29,4 → ~50 °C), «11.000
   de stamina, imposible» (la yesca de 0,2 kg cuesta 141 y entra), el efecto de un
   campo opcional sobre el hash, la atribución de un hash movido, «+3037 en la
   peor» (era la mejor), «60 s por kilo», y un encuadre de duty-cycle del 18%.

**Y una que me hice a mí mismo**, que vale igual: comparé un número contra
`ROL_A_DE_FRICCION`, que es una **función** que devuelve un `Role`, no un número.
Dio cero encendibles con 264 varas de madera a la vista.

---

## 6 · Qué está abierto, en orden de importancia

1. **El `gap` del `emitsPower`** (sección 2). Es lo único entre la criatura y
   comer, y por lo tanto entre el proyecto y su criterio de corte.
2. **La emergencia mide 0 de 9**, pero la columna `situación` se movió: hay tres
   filas con **7/20, 7/20 y 5/20** — el mundo le puso el problema delante y la
   mente no lo resolvió ni una vez. Eso ya es una señal y no un cero de medición.
   Las otras seis siguen sin situación.
3. **El umbral hay que rediscutirlo con el usuario.** El criterio publicado dice
   «≥4 de las 10» y la lista tiene **9** entradas, de las cuales el azar firma 1
   → el piso hay que cruzarlo sobre 8. Nadie aprobó «4 de 8» ni «4 de 9»:
   **no lo ajustes por tu cuenta**, presentá el número crudo.
4. **Cocinar no es un proceso** y el planificador lo sufre: `ConstructionSchema.via`
   es un `ProcessId` y sólo hay cuatro procesos. Secar (ley 11), carbonizar (ley 4)
   y cocinar (ley 5) tienen todos la forma «poné esto acá y esperá». Hay una
   variante por ley empezada en `@anima/plan`; mirá qué quedó.
5. **68 `it.fails`**, repartidos: mind 18, world 16, physics 13, juez 7, perceive 6,
   plan 6, oracle 1, skills 1. Cada uno tiene su porqué medido al lado.
6. **`explorar` sigue caminando un ciclo cerrado de 8 celdas** — la 1 de 15 innatas
   que no logra su contrato.

---

## 7 · Lo práctico

- Rama `anima-2`, **40 commits por delante de `main`, sin pushear**.
- El árbol está limpio. El último commit es `75b820f`.
- **Ánima I sigue vivo al lado** (`packages/`, `apps/`) y anda: 455 tests verdes.
  Los últimos tres commits son de ahí (el tacho, el martillo eterno, el 400 de
  Codex) y no tienen nada que ver con el remake.
- La regla 1 de `ii/`: **nada de `ii/` importa de `packages/` ni de `apps/`**. La
  única excepción es `apps/api`, que se comparte.

### El prompt para arrancar la sesión nueva

> Seguimos con Ánima II, el remake que vive en `ii/` del repo `F:\proyectos\Anima`
> (el Ánima I original sigue andando al lado, en `packages/` y `apps/`).
> Leé `ii/docs/continuar-aca.md` entero antes de hacer nada: es el traspaso, y trae
> el estado, el método, las decisiones tomadas y los catorce números que ya se
> corrigieron. Después seguí por donde dice la sección 6.
> Usá workflows con agentes en paralelo sobre archivos disjuntos. Commiteá cuando
> un tramo esté verde y verificado, sin pushear.
