





# Ánima II

El remake. Vive acá, al lado del Ánima que anda, hasta que se lo gane.

- Arquitectura: [`docs/architecture/remake-anima-ii.md`](../docs/architecture/remake-anima-ii.md)
- Inventario de ADRs: [`ii/docs/inventario-adrs.md`](docs/inventario-adrs.md)

## Las tres reglas de esta carpeta

**1. Nada de acá importa de `packages/` ni de `apps/`.** Ni un `import` a
`@anima/sim-core`, `@anima/agent-core`, `@anima/skill-runtime`. Portar es
**copiar y adaptar**, no depender. Si dejás la dependencia viva, en tres meses el
remake es un refactor con esteroides y volvés a tener un `agent.ts` de 7.679
líneas con otro nombre.

La excepción, y es una sola: **`apps/api` se conserva y se comparte**. El puente
a Codex con `CODEX_HOME` por pubkey y la identidad Nostr no se reescriben.

**2. Ningún paquete determinista toca el reloj ni el azar del sistema.**
`Math.random`, `Date`, `performance`, `Intl`, `localeCompare` y `Math` trascendente
(`exp`, `pow`, `log`, `**`) están prohibidos por lint en `@anima/physics`,
`@anima/process` y `@anima/world`. `Math.exp` y `Math.pow` **no tienen precisión
especificada en ECMAScript**: dos navegadores pueden devolver el último bit
distinto y el replay diverge en el tick 400. Se reemplazan por tablas y
polinomios propios en punto fijo.

**3. Ningún hito se da por cumplido sin su criterio verificable.** Están escritos
uno por uno en el plan de construcción del documento de arquitectura, y varios
son criterios de **corte**: el Hito 0 puede matar la decisión del sandbox, y el
Hito 5 puede parar el proyecto entero. Están para eso.

## Estado

**Hito 0 CERRADO, Hito 1 construido con la puerta cerrada, Hito 2 con tres de
sus cuatro criterios, y el Hito 4 desbloqueado.**

| | |
|---|---|
| [Inventario de ADRs](docs/inventario-adrs.md) | **86 de 86 triados** · 55 portar, 18 revisar, 10 obsoleto, 3 revertido |
| [Escalera de capacidades](docs/escalera-capacidades.md) | 20 capacidades, 28 borradores contra la API |
| [Huecos medidos](docs/huecos-medidos.md) | 3 pases: 112 → 71 → **64** errores · 5 → 6 → **10** expresables |
| [Decisiones](docs/decisions/) | 6 ADRs propios (II-0001 a II-0006) |

### Hito 0 — el banco · las cuatro piezas medidas, ninguna mató el plan

| Pieza | Criterio | Medido | |
|---|---|---|---|
| [typecheck](docs/hito-0-banco-de-latencia.md) | < 3000 ms en frío | 240 ms | ✔ |
| [barrido térmico](docs/hito-0-barrido-termico.md) | ventana para 10 sustancias | 12/12 | ✔ |
| [combustible](docs/hito-0-combustible.md) | ≤ 2% del tick (ADR II-0005) | **0.39%** | ✔ margen 5.1× |
| [arranque en el navegador](docs/hito-0-arranque-navegador.md) | typecheck tibio ≤ 250 ms | **6 ms** | ✔ margen 30× |

### Hito 1 — `@anima/physics`

Existe y está verde: **548 tests**, typecheck limpio. Punto fijo determinista,
29 cualidades más 4 de celda, 30 sustancias semilla, cuerpos compuestos, los
cuatro procesos aplicables, las doce leyes y `admit()`.

Los tres ejemplos del usuario pasan **sin que aparezcan las palabras «carbón»,
«asar» ni «pescar»**, y el test de emergencia no menciona ninguna sustancia
semilla por nombre.

El Hito 1 devolvió dos correcciones al contrato de tipos, y las dos están
aplicadas ([ADR II-0006](docs/decisions/II-0006-dos-escalas-magnitudes-y-tasas.md)):
**`Fixed` a escala 1000 para las magnitudes y `Rate` a escala 1e6 para las
tasas**, tipos nominales distintos —sumar una tasa a una magnitud no compila, y
eso lo verifica `tsc`— con `aplicar()` como única puerta entre las dos; y el nodo
`{ k: 'substance' }` en `QualityExpr`, con el que `heatCapacity` se declara como
cualquier otra derivada y queda **una sola forma de preguntar si algo se guarda**.

### Hito 2 — `@anima/world` · [`docs/hito-2-el-mundo.md`](docs/hito-2-el-mundo.md)

Existe y está verde: **258 tests** más 5 de verificación que corren aparte
(`pnpm --filter @anima/world verificacion`), typecheck limpio. Grilla en chunks con índice
O(1) por celda, `stepWorld` puro, invariantes por tick, journal append-only,
snapshot por delta y `hashWorld`.

| Criterio | | Medido |
|---|---|---|
| dos mundos gemelos con 10⁵ intenciones → mismo `hashWorld` | ✔ | 100 000 intenciones, 11 checkpoints |
| restaurar a mitad reproduce el final exacto | ✔ | desde la cadena de deltas, no de memoria |
| 5000 cuerpos a menos de 4 ms por tick | ✘ | **8,65 ms** · era 39,8 · el 90% es `paso()` de física |
| el mismo hash en Chrome y en Firefox | ⏳ | falta la página; la precondición está verificada |

El de rendimiento **todavía no se cumple, pero bajó 4,6 veces**: de 39,8 ms a
8,65. El diagnóstico anterior era correcto y está reparado — `leer()` armaba trece
cualidades de golpe y `paso()` lo hacía cinco veces por cuerpo, para que cada ley
usara dos o tres. La lectura es ahora **perezosa y memoizada**, `paso()` no relee
cuando la ley devolvió el mismo cuerpo, y `qualityOf` dejó de construir un `Set`
por llamada: de **77 lecturas de cualidad por cuerpo y por tick quedan 13,6**.

Que no se haya movido ninguna conducta **está verificado desde afuera**: la huella
de `paso()` (3705094564) y el hash de una partida de 2000 ticks
(`61d4b9588a81717d`, con sus once checkpoints) dan **exactamente lo mismo con las
fuentes de física anteriores a la optimización**. La caza de la caché mal
invalidada —23 tests contra las cinco memoizaciones nuevas— encontró **una sola**
diferencia: `tagsDe` se queda con los tags viejos si alguien muta el array de
partes en su lugar, cosa que hoy nadie hace y que ahora tiene barrido propio.

Lo que falta son **2,2×**, y son dos frentes distintos: para el corpus del banco,
la representación del cuerpo (y eso pide su propio ADR); para un mundo
**heterogéneo** —que hoy cuesta ~20 ms y no 8,65— lo que manda es que
`conSustancia` reconstruye la `Physics` entera cada vez que la ley 4 transmuta.
Hoy entran **~2100 cuerpos en 4 ms** (eran ~485), de sobra para el Hito 3 y para
la demo del Hito 5.

El ataque al propio determinismo encontró **un agujero real**: los empates de
`seq` se detectaban al vuelo, así que la primera del par ya había actuado cuando
aparecía la segunda — el mundo dependía del orden de llegada. Reparado. Y el
arnés de invariantes con diez actores encontró tres bugs de bookkeeping espacial
más un invariante mal escrito: pedía apoyo **entre pares** en vez de **una pila
por celda**, o sea que la parrilla del ADR II-0002 no habría pasado su propio
invariante.

```bash
pnpm --filter @anima/world banco   # los números de rendimiento, medidos
```

### La puerta, cerrada · [`docs/la-puerta.md`](docs/la-puerta.md)

Siete adversarios tiraron **132 procesos** contra `admit()` en dos vueltas y
dejaron **72 huecos** marcados con `it.fails()` en `tests/ataque*.test.ts`.
**Están cerrados 62**; los 10 que quedan llevan escrito, cada uno al lado de su
prueba, qué haría falta para cerrarlos.

| | huecos | cerrados | abiertos |
|---|---:|---:|---:|
| 1ª vuelta · 3 adversarios, 62 procesos | 39 | 33 | 6 |
| 2ª vuelta · 4 adversarios, 70 procesos | 33 | 29 | 4 |

La segunda vuelta trajo un adversario nuevo, con el lente al revés: en vez de
buscar lo que la puerta deja pasar, buscó procesos **honestos que la puerta
rebota**. Encontró seis, y el peor era que **`comer` no se podía escribir** —o
sea que la criatura pescaba y no comía—, porque `nutrition` y `stamina` son las
dos conservadas y la regla 1 solo sabía sumar la misma cuenta.

Las causas raíz, y en negrita las dos más profundas:

| Causa | Reparación |
|---|---|
| la regla 2 solo miraba `drive` | `couple` y `transfer` pasan por la regla 2 |
| `transfer` miraba presencia, no cantidad | la cota del rol es el techo de lo que se mueve |
| **intensiva contra extensiva** | se compara `q · masa`; sin cota de masa, se rechaza por indecidible |
| se podía escribir una cualidad derivada | `cualidad-derivada` también sobre procesos |
| se acreditaba sin consumir ni terminar | un `transfer` sin `completion` corre `perTick × ∞` |
| los metadatos no se miraban | id, nombre, radio, compuerta, `trust`, y promesas |
| toda cuenta era por efecto y nunca en total | presupuesto **acumulado**: lo que entra una vez no paga N veces |
| las cotas del rol se tomaban por invariantes | `techoEfectivo` y `pisoParaDireccion` |
| lo que escribe quien propone decidía si la regla miraba | nombres de rol, espacios, unicode, `provenance` y `establishes` dejaron de ser la llave |
| `inverse` no se leía | el techo de un acople inverso es el **espejo** del piso de lo seguido |
| **no había conversión entre dos cuentas conservadas** | un `poweredBy` sobre otra conservada es una conversión, y `comer` entra |

**Y los cuatro procesos semilla siguen entrando sin una sola razón en contra**,
que es la otra mitad del trabajo: una puerta que rechaza todo es trivialmente
segura y completamente inútil. Las dos formas de equivocarse no son simétricas —
dejar pasar de más se endurece después; no dejar construir mata el juego, y lo
mata en silencio.

## Comandos

```bash
pnpm ii:typecheck
```

```bash
pnpm ii:test
```

Y los cuatro bancos del Hito 0, que se pueden volver a correr cuando se quiera —
todos salen 0 si el plan sigue en pie:

```bash
pnpm ii:banco
```

```bash
pnpm ii:combustible
```

```bash
pnpm ii:barrido
```

```bash
pnpm ii:navegador
```

El último levanta una página en <http://localhost:5180> y mide ahí mismo.

`ii:test` corre el **arnés de compilación**: los 28 borradores contra
`skill-api.d.ts` en cada build, con trinquete. La línea base solo puede bajar
sola; para que suba hay que editar `tests/linea-base.json` a mano y decir por
qué. Sin eso, el número deriva en silencio — que es exactamente el bug de
`DSL_REFERENCE` en Ánima I, una referencia mantenida a mano que divergió del
código y nadie se enteró hasta que el modelo no pudo colocar un bloque.

El Ánima I sigue funcionando igual que siempre: `pnpm dev`, `pnpm test`,
`pnpm demo`. Los dos árboles conviven hasta el Hito 5.
