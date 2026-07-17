# ADR 0027 — Interacciones inventadas: Ánima propone, la física filtra, la IA Dios juzga

Fecha: 2026-07-17 · Estado: aceptada · Extiende la puerta del ADR 0018 y el rol de juez del ADR 0019

## Contexto

El mundo tiene objetos —del código y de las recetas inventadas (ADR 0018/0024)—
pero un catálogo cerrado de cosas que hacer con ellos: recoger, soltar, comer,
golpear con herramienta, craftear. «Juntá agua con el balde», «subite a la
silla» o «metete abajo del refugio» morían en `unsupported` o en una habilidad
de movimiento que no manipulaba nada.

El pedido nuevo es que Ánima pueda **crear interacciones en tiempo de
ejecución** — con objetos hardcodeados y con objetos inventados por igual —,
que cada interacción se **guarde y se reuse** (validar una vez, usar para
siempre), y que exista un guardián que impida abusar del poder de crear: la
física no sabe que el agua no se lleva en las manos.

## Decisión

**Tres puertas, en orden, y ningún atajo entre ellas.**

1. **La `Interaction` es una regla del mundo, hermana de `Recipe`.** Dato puro
   en `world.interactions`: viaja en los snapshots, se percibe
   (`perception.interactions`) y un mundo restaurado la sigue admitiendo.
   Declara:
   - `stance` — la forma espacial: `beside` (al lado, la adyacencia de
     siempre), `on-top` / `underneath` (terminar en la celda del objeto; en el
     motor 2D son la misma condición y la diferencia es de dibujo, que el
     evento conserva) y `held` (el objetivo va en el inventario).
   - `target` — por tipo **o por rasgos** (`{ wet: true }`): hablar de rasgos
     es lo que hace que la interacción sirva igual para lo hardcodeado y para
     lo que un modelo invente mañana con otro nombre.
   - `requires.heldKind` — qué hay que llevar (el balde para el agua).
   - `effects` — catálogo cerrado de DOS efectos: `transform-target` y
     `transform-held`. **Las interacciones cambian objetos, nunca cuerpos**:
     ni energía, ni calor, ni comida. Cada transformación es 1→1 y sin
     `drops`: no se crea materia, ni ahora ni al romperse. Sin efectos solo
     valen las posturas (estar encima ES el hecho).

2. **La primera puerta es determinista: `validateInteraction`.** Espejo de
   `validateRecipe`, con las MISMAS cotas de componentes
   (`INVENTED_COMPONENT_BOUNDS`, compartidas a propósito: dos tablas
   divergirían y una sería la rendija). Tope `MAX_INTERACTIONS = 16`, ids
   únicos, nada se transforma en `pet`/`food`/`tree`, la mascota no es un
   objetivo. `step.ts` la vuelve a aplicar en `proposeInteraction`: no existe
   camino a `world.interactions` que se la salte. Y en la ejecución hay una
   guardia que la puerta no puede dar (ve tipos declarados, no entidades):
   los cuerpos vivos, el agua y lo protegido no se transforman jamás.

3. **La segunda puerta es la IA Dios: `interaction.judge`.** Un momento
   cognitivo nuevo cuyo prompt NO es la mente de la mascota sino la lógica del
   mundo, con el mismo contrato que `judge.destruction`: un `judgement` con
   veredicto y motivo. Juzga COHERENCIA, no física: «llevar agua en las manos»
   es expresable (transformar lo sostenido es legal) y aun así muere aquí,
   porque el agua se escurre. Dos puertas, dos naturalezas: zod guarda la
   materia, el Dios guarda el sentido — y el poder de crear interacciones no
   anda suelto sin él: si el juez falla o no está, nada entra.

4. **El reuso es la regla, inventar es la excepción.** Ante un pedido
   (`interact-entity`, categoría nueva de la interpretación), Ánima busca
   primero en `perception.interactions` — por id (`verbo-objeto`) o por verbo
   más objetivo compatible. Encontrarla no cuesta **ninguna** consulta;
   solo crearla costó (una propuesta + un juicio). El crédito de inventar es
   el mismo de las recetas (`MAX_RECIPE_ATTEMPTS` por objetivo), y los
   rechazos viajan al siguiente intento para corregir en vez de insistir.

5. **El veto del Dios también se aprende.** Queda como hecho en su memoria
   («mi mundo no permite juntar-water: el agua se escurre…»), persiste con
   ella y viaja en el legado: lo vetado no se re-inventa — pedirlo de nuevo
   recibe el motivo recordado, sin gastar consultas. Es la contracara exacta
   del reuso: lo aceptado nunca se re-inventa, lo vetado tampoco.

6. **Ejecutar es física de siempre.** La DSL gana `interact`, el programa
   junta lo requerido como junta ingredientes, y el mundo vuelve a comprobar
   postura, objetivo y requisitos en cada uso: saber la interacción no exime
   de estar donde hay que estar. Para `on-top`/`underneath` alcanza LLEGAR a
   una celda adyacente: subirse (o meterse debajo) es parte del acto, y el
   mundo mueve a la mascota a la celda del objeto al resolverlo. Sin esto,
   `on-top` sobre cualquier sólido sería imposible por definición — el
   movimiento nunca deja pisar sólidos — y «subite a la silla», el ejemplo que
   motiva este ADR, no existiría; la cama sólida que Ánima inventó lo probó en
   una corrida real. El agua es la excepción: no sostiene a nadie
   (`target-not-mountable`). En el dibujo, encima/debajo son un desvío
   vertical y el orden de profundidad entre mascota y objeto — el eje z que
   la grilla no tiene, contado por el render sin inventar reglas.

7. **Sin claves de IA, degrada honesto (ADR 0006).** El mock ni propone ni
   juzga: fingir lógica con reglas es exactamente el agujero que este ADR
   cierra.

## Consecuencias

- Ánima puede darle usos nuevos a cualquier objeto — del código o inventado —
  sin que ningún uso entre al mundo por declaración: modelo propone, física
  filtra, Dios juzga, mundo guarda.
- Una interacción validada es permanente y gratis de reusar; el costo de
  creación es 1 consulta de propuesta + 1 de juicio, con tope por objetivo.
- Los guardados viejos no cambian: `restoreSnapshot` normaliza
  `interactions: []`, y las nuevas entran a los mundos donde se inventen.
- El catálogo de la UI muestra las interacciones aprendidas (postura,
  objetivo, requisito) junto a los objetos, con su origen a la vista.

## Lo que queda deliberadamente afuera

- **Empujar** (mover el objetivo una celda), **a distancia** (con línea de
  visión) y **estados sostenidos** (sentada EN la silla como estado que dura,
  con efectos por tick) son posturas/efectos futuros: entran como una línea
  del esquema y una decisión aparte, no hoy.
- **Contenedores de verdad** (`container` con capacidad y contenido) no
  existen: el balde lleno es una transformación (`balde` → `balde-con-agua`),
  que alcanza para que la historia del agua tenga respuesta buena además de
  veto. Si algún día el contenido importa (verter, vaciar, mezclar), ese es
  otro ADR.
- **Efectos sobre el cuerpo, nunca.** Ni esta versión ni las próximas: una
  interacción que dé calor o energía es el fuego sin pedernal, y esa puerta
  ya la cerró el ADR 0018.
- **La mascota no dispara invenciones por necesidad propia** (todavía): el
  disparador es el pedido del cuidador (`interact-entity`). Que el frío o el
  hambre le hagan inventar interacciones —como ya inventa recetas— es una
  extensión natural, pero pide sus propias estrategias y su propio ADR.
