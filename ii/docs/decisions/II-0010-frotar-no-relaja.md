# ADR II-0010 — Frotar no relaja: una ley no pelea contra una mano

Fecha: 2026-07-27 · Estado: aceptado · Cierra el hueco 1 del
[ADR II-0008](II-0008-el-tiempo-del-mundo-se-mide-en-segundos.md)
(`world/tests/el-tiempo-no-depende-del-tick.test.ts`, «SIGUE ABIERTO · frotar
tendría que llevar la vara de 15 a 375 °C, y no llega») y desbloquea la
calibración del [ADR II-0009](II-0009-el-hambre-se-mide-en-segundos-y-mata.md),
que eligió `COSTO_VIVIR_POR_SEGUNDO = 1,0` para que **comer crudo dé neto
negativo y cocinar positivo** — y para cocinar hay que poder encender.

## Contexto

**Hoy no se puede encender nada en Ánima II.** No es una constante mal elegida:
son dos piezas escritas por separado que nadie compuso.

### La pieza que empuja

`FRICCION` (`physics/src/process.ts:196`) es un `drive` sobre `temperature`,
`toward: 400`, `porSegundo: 120`, pagado con `stamina` a eficiencia 0,35. Su
comentario dice, con todas las letras:

> TRES SEGUNDOS llevan la madera de 15 a 375 °C —120 grados por segundo— y se
> comen 48 de `stamina`.

Y la cuenta cierra exacta: `15 + 120 × 3 = 375`. **El proceso está calibrado
suponiendo que nada lo relaja.**

### La pieza que relaja

La ley 1 (`physics/src/leyes.ts`, `leyTermica`) mueve la temperatura hacia el
equilibrio **proporcional al hueco**:

```
t = T + (objetivo − T) · min(1, (H_PERDIDA_POR_SEGUNDO · dt) / heatCapacity)
```

`stepWorld` aplica primero las intenciones y después los sistemas, así que las
dos corren en el mismo tick, en ese orden. O sea que es un método de PARTICIÓN
de operadores, y el resultado no es «tarda un poco más»: es un **punto fijo**.

```
T* = ambiente + (porSegundo / H_PERDIDA_POR_SEGUNDO) · heatCapacity − porSegundo/hz
   = 15 + 12 · heatCapacity − 120/hz
```

Medido a 20 Hz, frotando sin parar 600 segundos de mundo, al aire
(`packages/world`, con el tanque de `stamina` idealizado a infinito para que el
techo sea térmico y no económico):

| cuerpo | meseta medida | punto de ignición |
|---|---|---|
| madera 2 kg | **49,80 °C** | 300 |
| corteza 2 kg | **54,60 °C** | 250 |
| hoja 2 kg | **87,59 °C** | 180 |

Ninguna del catálogo llega, y no le falta poco: le falta un factor de seis. Para
que una madera llegara a 375 haría falta `heatCapacity ≥ 30`, o sea una vara de
17,6 kg — que además **no se puede ni levantar**, porque `friccion` pide
`arrangement: held` y `portable` topa en 8 kg. El techo no está lejos: está
afuera.

*(La hoja da 87,59 y no los 87,60 exactos de la fórmula porque entra en su
ventana de cocción a los 40 °C: la ley 5 le evapora agua, la masa baja y con ella
`heatCapacity`, o sea que el techo se le mueve mientras la frotan. El punto no
cambia: 87 contra 180. Las cinco mesetas y las tres sustancias están medidas en
`physics/tests/el-empuje-no-se-relaja.test.ts`, en el test CARNADA, que es
además lo que se cae si alguien revierte la reparación.)*

### Y nada arranca caliente

`emitsPower = step(temperature ≥ ignitionPoint) × fuelEnergy × mass × 16,7`, y
ningún bioma del dios siembra temperatura. La única fuente primordial de calor
del mundo es `friccion`, y `friccion` no llega.

Sin fuego se caen **tres de las diez secuencias de emergencia del Hito 5**, y la
calibración del ADR II-0009 —que hace que la diferencia entre vivir y morirse
sea cocinar— describe un mundo que no existe: la criatura se muere siempre.

## Decisión

### 1. Mientras un `drive` está activo, ninguna ley RELAJA esa cualidad en contra del empuje

Es una regla sobre una CLASE de ley, no un caso de la ley 1.

```ts
/** Un empuje sostenido sobre este cuerpo, en este paso. */
export interface Empuje {
  readonly q: QualityId
  readonly rumbo: 1 | -1
}

/** ¿Hay un empuje sostenido sobre `q` que va al revés que este `delta`? */
function pelea(e: Entorno, q: QualityId, delta: number): boolean
```

Hoy pasan por `pelea` las dos leyes que relajan: la **1** (`temperature`
hacia el ambiente o hacia la fuente) y la **11** (`moisture` hacia la celda y
hacia lo que el calor deja). Cualquier ley de relajación que se escriba mañana
tiene que pasar por ahí, y es una línea en el sitio.

### 2. Se suspende la RELAJACIÓN, y sólo EN CONTRA

Dos recortes, y los dos importan:

- **No se suspende la ley, se suspende el signo.** Si el entorno empuja para el
  MISMO lado que la mano —un cuerpo que alguien frota adentro del fuego— la ley 1
  lo sigue calentando. Suspender la ley entera dejaría frío al que está en la
  fogata, que es absurdo.
- **No se suspende ninguna ley que TRANSFORME la materia.** La 3 piroliza y
  quema, la 4 transmuta, la 5 cocina, la 6 pudre, todas enteras y sin mirar los
  empujes. Es exactamente lo que hace que **la vara que se frota prenda** cuando
  pasa su punto de ignición, que es todo el objetivo de este ADR.

La línea entre las dos clases no es de comodidad: **relajar es el tirón del mundo
hacia donde las cosas quedan cuando nadie hace nada**, y «nadie hace nada» es
precisamente lo que deja de ser cierto mientras alguien frota. Transformar no es
un tirón de vuelta: es una consecuencia, y suspenderla sería apagar el fuego con
la mano que lo está haciendo.

### 3. La física se entera por el `Entorno`, que ya es «lo que le pasa al cuerpo desde afuera»

```ts
export interface Entorno {
  celda: Celda
  fuente?: Fuente
  empujes?: readonly Empuje[]   // ← esto
}
```

`aplicarEfectos` (`world/src/step.ts`) anota el empuje en el borrador del tick
cuando un `drive` **movió de verdad** la cualidad; `entornoDe` se lo pasa a
`paso()` una fase después. El canal es de una sola dirección: las intenciones
escriben, los sistemas leen, y muere con el borrador.

Se anota lo que se movió y no lo que se quiso mover: un `drive` sin con qué
pagar sale por su `break` sin anotar nada, y la ley 1 relaja normal. **La mano
que no puede no suspende nada.**

## Por qué así y no de otra forma

### Las tres salidas al problema del fuego

- **Sembrar fuego con el oráculo** —que algún bioma decrete brasas—. Descartada:
  mueve el problema de lugar. La criatura pasaría a depender de encontrar fuego en
  vez de hacerlo, `friccion` seguiría sin servir para nada, y el ADR II-0001
  («encender no es una acción, es una consecuencia») quedaría cierto por decreto
  del dios y no por la física. Además no cierra el hueco: la brasa decretada
  también se apaga.
- **Recalibrar `porSegundo` de 120 a ~1676** (14×), para que el punto fijo caiga
  arriba de 375. Descartada por tres motivos. (i) Es la constante equivocada: el
  120 está bien, lo que está mal es que la ley se lo coma; con 1676 el comentario
  de `FRICCION` pasa a mentir al revés —«120 grados por segundo» sería falso—.
  (ii) El punto fijo **depende de `heatCapacity` y de `hz`**, así que un solo
  número no puede servir para las treinta sustancias ni para las cinco
  frecuencias: la meseta se corre un 40% entre 10 y 50 Hz, medido. (iii) Obliga a
  rehacer el barrido térmico del Hito 0 y con él la ventana de cocción de las doce
  sustancias.
- **Frotar no relaja** ← ésta. Es el cambio más chico, no toca ninguna constante
  de calibración, no reabre el barrido, y **hace que el código cumpla su propia
  especificación escrita** en vez de reescribirla.

### Las tres formas del alcance

- **Suspender la ley 1 entera sobre el cuerpo frotado.** Descartada: un cuerpo
  frotado adentro del fuego dejaría de calentarse.
- **Suspender la cualidad, en los dos sentidos** (`temperature` congelada
  mientras dure el empuje). Descartada por lo mismo, y peor: el cuerpo tampoco
  podría recibir calor de la fuente, así que frotar sería una forma de aislar.
- **Suspender sólo el sentido contrario** ← ésta. El signo es lo único que hace
  falta para distinguir los dos casos, y no hay que inventar ninguna categoría
  nueva para escribirlo.

### Las cuatro formas del canal

- **Un parámetro más en `paso(body, entorno, phys, dt, empujes)`.** Descartada:
  cinco parámetros posicionales, y obliga a `correr`, al barrido, a los tests y a
  todo llamador a pasar algo que casi siempre es `undefined`, para decir lo mismo.
- **Un campo en `Body.state`.** Descartada, y es la peor: entraría en
  `hashWorldState`, en `hashPhysics` no pero sí en la ranura del snapshot, y
  alguien tendría que acordarse de borrarlo en cada tick. Un estado que hay que
  acordarse de limpiar es la mitad de los modos de falla de una caché. Y miente
  sobre la materia: que una mano te esté frotando no es una propiedad tuya.
- **Dar vuelta el tick: primero las leyes, después las intenciones.** Descartada:
  `step.ts` documenta por qué el orden es ése —«la criatura actúa sobre el mundo
  que vio»— y además no arregla nada: el punto fijo es el mismo con el término
  `−120/hz` cambiado de signo.
- **Un campo opcional en `Entorno`** ← ésta. `Entorno` ya es exactamente eso: lo
  que le pasa al cuerpo desde afuera durante ESTE paso, que hoy son la celda y la
  fuente. Una mano que frota es de la misma familia.

**No rompe la pureza**: `paso(cuerpo, entorno, phys, dt)` sigue siendo una
función del cuerpo y del entorno, y `empujes` es parte del entorno. Mismos
argumentos, mismos bits.

**No rompe el determinismo**: los empujes salen de las intenciones, que
`stepWorld` ya ordena total por `(by, seq)`, y `pelea` sólo pregunta si hay
alguno con ese `q` y ese rumbo — no depende del orden de la lista. Dos actores
que frotan el mismo palo anotan un solo empuje (`anotarEmpuje` es idempotente por
`(cuerpo, cualidad, rumbo)`); si empujaran en sentidos opuestos quedan los dos y
la ley no se mueve para ninguno de los dos lados, que es la lectura literal de la
regla y la única que no depende de quién llegó primero.

### Regla general y no caso de la ley 1

Porque **el problema no es de la temperatura**: es de la partición de
operadores. Un `drive` sobre `moisture` —mojar un cuero para ablandarlo, que es
la clase de cosa que el modelo va a escribir— tiene exactamente el mismo bug con
la ley 11, y encontrarlo costaría exactamente lo mismo: seis meses y una
criatura que se muere sin que nadie sepa por qué.

La alternativa —«la ley 1 pregunta si hay fricción»— es un caso, no una regla:
mete el nombre de un proceso adentro del motor de las leyes, que es lo único que
`leyes.ts` promete no tener (su encabezado: «los únicos nombres propios de este
archivo son los de las leyes»), y no ayuda a la segunda ley que lo necesite.

El costo de la generalidad es una llamada por ley de relajación. Es barato.

## Consecuencias

### Lo que se cumple, medido

- **La vara llega a 375 °C en 3,00 s** a 10, 20 y 25 Hz, y a 3,02 y 3,01 a 50 y
  100 Hz — un tick de cuantización, que es el piso de cualquier instrumento. Es
  exactamente lo que el comentario de `FRICCION` promete desde que se escribió.
- **El costo es EXTENSIVO y ésa es toda la técnica.** `heatCapacity` es
  `mass × specificHeat`, así que el precio de encender es
  `heatCapacity × ΔT / 0,35` y depende de la masa:

  | cuerpo | ΔT hasta su ignición | costo de `stamina` |
  |---|---|---|
  | hoja seca 0,2 kg | 165 | **141,4** |
  | madera 0,2 kg | 285 | **276,9** |
  | madera 1 kg | 285 | **1384,3** |
  | madera 2 kg | 285 | **2768,6** |

  Contra un tanque de arranque de 500 y un techo de catálogo de 1000: **se
  enciende con yesca, no con leños**. Medido en el mundo, con el costo de vivir
  incluido: llevar una madera de 0,2 kg a 375 °C sale 352,71; una de 0,55 kg,
  964,71; **una de 0,6 kg ya no se puede** — la criatura se queda sin fuerzas
  antes.
- **Los 48 de `stamina` del comentario de `FRICCION` no son reproducibles.** Con
  la cuenta que el mundo cobra hoy, 48 corresponden a una vara de 27 gramos. El
  número es anterior a que `heatCapacity` entrara en el precio y se corrige en el
  comentario; el que queda escrito es el medido.
- **La cadena ENCIENDE.** Con una criatura frotando dos varas de madera de 0,5 kg,
  una yesca de hoja seca tapándolas y un leño de 1 kg apoyado encima, medido a
  20 Hz en un mundo sin ninguna violación de invariante:

  | | segundo de mundo |
  |---|---|
  | la vara pasa sus 300 °C y prende | 2,40 |
  | la yesca pasa sus 180 °C y prende | 2,70 |
  | el leño pasa sus 300 °C y prende | 2,95 |

  Y el pescado sobre la parrilla sube de `digestibility` 0,380 a **0,513**. Está
  en `world/tests/el-fuego.test.ts`.

### El eslabón que NO cierra, con su número

**El fuego no sobrevive a la mano que lo hizo.** A los 3,55 s la criatura se queda
sin `stamina`, deja de frotar, y en un tick todo vuelve a 15 °C. La causa no es
este ADR y no la arregla este ADR: **un cuerpo que arde no es fuente de calor de
sí mismo** (`entornoDe` se saltea `f.id === c.body.id`, y tiene que hacerlo o un
cuerpo se calentaría solo), así que la ley 1 lo relaja hacia el ambiente como a
cualquier otro. Medido, al aire, a 20 Hz, sin nadie que lo sostenga:

| cuerpo a 700 °C | cae por debajo de su ignición a los |
|---|---|
| madera 0,2 kg | **0,05 s** (un tick) |
| madera 1 kg | 0,15 s |
| madera 3 kg | 0,45 s |
| madera 8 kg (el máximo portable) | 1,20 s |
| carbón 2,5 kg | 0,15 s |

O sea: **soltar la brasa es apagarla**, y el pescado se cocina sólo mientras
alguien frota — llega a `digestibility` 0,513 y ahí se queda, contra el 0,85 con
el que el banco hermano llama «cocido» a un filete. Lo que falta es que el fuego tenga dónde vivir —que la combustión
escriba la temperatura de la celda, que es lo único del mundo que no relaja, o
que un cuerpo encendido se sostenga a su propia temperatura de llama—, y eso es
otro ADR: toca la ley 3, toca `CellState` y hay que volver a correr el barrido.
Queda abierto con `it.fails` en `world/tests/el-fuego.test.ts`.

### Lo que se mueve y lo que no

- **`paso()` sobre un `Entorno` sin `empujes` es bit a bit el de antes.**
  `pelea` sale en su primera línea. Verificado: la huella de conducta de
  `@anima/physics` sigue en **3705094564**, `pnpm ii:barrido` sigue dando 12/12
  sustancias con ventana y **5 óptimos distintos**, y ninguna de las huellas del
  mundo se movió. Lo único que cambia de conducta es el cuerpo que alguien está
  frotando, que es exactamente lo que este ADR vino a cambiar.
- **Y por eso `pelea` es un PREDICADO y no una función que recorta el `delta`.**
  La primera versión devolvía el número, y eso obligaba a escribir la ley 11 como
  `moisture + f(haciaLaCelda − secado)` en vez de
  `moisture + haciaLaCelda − secado`. En IEEE-754 la asociatividad no vale: la
  huella de conducta se movió a **139010573** sin que ninguna conducta hubiera
  cambiado. Con un predicado, la rama que no suspende conserva la expresión letra
  por letra. Queda anotado porque es un error que se comete una sola vez y sólo
  si hay una huella que lo cace.
- **La huella del mundo SÍ se mueve, y sólo para el que frota.** El bloque
  «documentado · la meseta de frotar se corre EXACTAMENTE un paso del drive» de
  `el-tiempo-no-depende-del-tick.test.ts` deja de tener sentido: **ya no hay
  meseta**. Se reescribe conservando el número viejo al lado del nuevo, como hizo
  el ADR II-0009 con el hueco 3, porque un hueco que se cierra sin dejar rastro
  se puede volver a abrir sin que nadie lo note.
- **Aparece un diente de sierra cuando el `drive` satura.** Al llegar a
  `toward` (400) el empuje vale 0, no se anota nada, la ley 1 relaja a fondo
  —`acople = min(1, …)` vale 1 para todo cuerpo liviano— y la temperatura se
  desploma; el tick siguiente el `drive` la vuelve a subir. Es CORRECTO que
  cueste: mantener no puede ser gratis, o frotar sería una batería. Pero el
  período del diente lo fija `toward` y no ninguna decisión, y conviene que quede
  anotado.
- **`Empuje` no entra en ningún hash.** Vive en el borrador del tick y en el
  `Entorno`, que se arma y se tira. Dos mundos idénticos donde en uno alguien está
  frotando difieren en el `Actor.doing`, que ya entraba, y en la temperatura
  resultante — no en un campo nuevo.
- **No hay fuentes nuevos en ninguno de los dos paquetes**, así que las cotas de
  los guardianes de la regla 2 (`world/tests/ataque-determinismo.test.ts` y
  `physics`) no se tocan.
- **La innata `frotar` pasa a lograr su contrato.** Era una de las dos que no lo
  lograban contra el mundo real («el calor se va más rápido de lo que entra»), y
  `perceive/tests/las-quince.test.ts` pasa de 13/15 a **14/15**: la única que
  sigue sin lograrlo es `explorar`. Ese archivo tiene la lista exacta en un
  `toEqual` y hay que sacarle la fila de `frotar`.

### La carnada, revertida a mano y verificada

Se reemplazó el cuerpo de `pelea` por `return false` —la reparación revertida—
y se corrieron los dos archivos. Caen **4 tests de `@anima/physics`** (llegar a
375, no suspender de más, que la vara prenda, y la generalidad sobre la ley 11) y
**10 de `@anima/world`** (las cinco frecuencias, el precio, los tres eslabones de
la cadena, la meseta, y el hueco 1 cerrado). Los que NO caen son los correctos:
el test que clava la meseta vieja, el que verifica que un `Entorno` sin `empujes`
no cambió un bit, y el del diente de sierra.
