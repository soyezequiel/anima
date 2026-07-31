# Inventario de ADRs — qué sobrevive al remake

Los 86 ADRs de Ánima I, uno por uno, con su destino en Ánima II.

**Por qué existe este archivo.** El riesgo 5 del [documento de
arquitectura](../../docs/architecture/remake-anima-ii.md) dice que el inventario
de ADRs es una tarea sin dueño, sin hito y sin criterio de cierre — y que las
tres propuestas iban a redescubrir 86 decisiones a los golpes. Éste es su dueño.

## Estados

| Estado | Qué significa | Cuántos |
|---|---|---|
| `portar` | El comportamiento tiene que existir en Ánima II. Va con hito asignado | **55** |
| `revisar` | Sigue vigente pero la forma cambia con la arquitectura nueva | **18** |
| `obsoleto` | Existía para mitigar algo que el remake elimina de raíz | **10** |
| `revertido` | El remake decide lo contrario, a propósito | **3** |
| `pendiente` | Sin triar | **0** |

**86 de 86 triados.** Las primeras 27 salieron del documento de arquitectura, que
las nombra de forma explícita. Las otras 59 se triaron leyendo cada ADR completo.

Contra la lectura ingenua de que un remake tira todo: **55 de 86 se portan**.
El comportamiento ganado peleando contra un LLM real es casi todo el valor del
proyecto viejo, y sobrevive.

## Los ADRs propios de Ánima II

Diecinueve, en [`decisions/`](decisions/). Los cinco últimos salieron del
[Gate 5→6](gate-5-6-objetos-emergentes.md) y son los que hay que leer antes de
tocar planos, catálogo o UI:

| ADR | Título | Dónde pega |
|---|---|---|
| [II-0015](decisions/II-0015-el-plano-no-es-el-esquema-de-construccion.md) | El plano no es el esquema de construcción, y ninguno de los dos es la habilidad | Gate 5→6 · H7 · H8 · H9 |
| [II-0016](decisions/II-0016-un-dispositivo-desplegado-retiene-sobre-un-stock.md) | Un dispositivo desplegado retiene sobre un stock, y la captura es estado | Gate 5→6 · revalida H2, H3, H4 |
| [II-0017](decisions/II-0017-el-descriptor-visual-no-es-fisica.md) | El descriptor visual es una vista derivada, no física | Gate 5→6 · H12A · H12C |
| [II-0018](decisions/II-0018-el-catalogo-es-core-mas-overlay-por-sesion.md) | El catálogo es core inmutable más overlay por sesión | Gate 5→6 · H8 · H10 · H11 |
| [II-0019](decisions/II-0019-el-gate-5-6-no-reabre-el-hito-5.md) | Los objetos emergentes son una puerta entre el Hito 5 y el 6 | el orden del plan entero |
| [II-0020](decisions/II-0020-la-captura-vive-en-una-tabla-del-mundo.md) | La captura vive en una tabla del mundo, y el pozo entrega ahí por un tercer `into` | Gate 5→6 · revalida H2, H3 · refina II-0016 |
| [II-0021](decisions/II-0021-el-overlay-de-una-partida-solo-crece.md) | El overlay de una partida sólo crece: revocar es entre partidas | Gate 5→6 · H7 · H10 · refina II-0018 |
| [II-0022](decisions/II-0022-place-despliega-un-cuerpo-no-construye-un-plano.md) | `place` despliega un cuerpo ya armado, y no construye un plano | Gate 5→6 · revalida H2, H4 · sale de una medición |
| [II-0023](decisions/II-0023-armar-una-obra-es-la-tercera-clase-de-esquema.md) | Armar una obra es la tercera clase de esquema, y su paso corre una habilidad | Gate 5→6 punto 3 · toca `@anima/plan` y `@anima/mind` · sale de una medición |

## Reparto por hito

**Los ADRs de Ánima I que el Gate 5→6 vuelve a poner sobre la mesa** —no cambian
de estado ni de hito, pero hay que releerlos antes de escribir el registry, y por
eso están juntos acá—:

| ADR | Por qué lo toca el gate |
|---|---|
| 0018 | Ánima inventa recetas y el mundo decide si son posibles: es el eje del caso de aceptación |
| 0024 | describir no es poder — la propuesta pasa por la misma puerta que la de la criatura |
| 0027 | `revertido`: crear una interacción nueva es escribir una ley, y eso es el Hito 13, no el gate |
| 0031 | lo complejo se deriva de lo simple, por encadenado sobre `establishes` y con costo derivado |
| 0032 | lo grande es una obra: `place` y el plano como esquema declarado. Hoy `place` está rechazada |
| 0034 | obras por tandas y colocación **idempotente**: es el punto 5 del criterio del gate |
| 0049 | la obra tiene un sitio — y por eso el `BlueprintDefinition` **no** lo lleva adentro |
| 0056 | el catálogo de sus obras, dibujado y derivado del mundo: engancha con el descriptor visual |
| 0059 | terminar el programa no es terminar la obra: una obra sin materia se **suspende** |
| 0063 | `revertido`: el glifo procedural sale en el acto y la glosa bonita es cola cero |
| 0076 | el catálogo sobrevive al mundo: es la capa «biblioteca adoptada» |
| 0080 | los mapas son pruebas de aceptación: el vocabulario del planteo **no puede nombrar la solución** |
| 0086 | catálogo de lo que sabe hacer + plan efímero: la forma que `PlannerCatalogView` tiene que respetar |

| Hito | ADRs | Cuántos |
|---|---|---|
| H1 | 0015, 0018, 0020, 0037 | 4 |
| H10 | 0009, 0021, 0033, 0047, 0075, 0076, 0084 | 7 |
| H2 | 0077 | 1 |
| H3 | 0024, 0026 | 2 |
| H4 | 0002, 0014, 0028, 0032, 0034, 0035, 0038, 0049, 0055, 0070 | 10 |
| H5 | 0004, 0005, 0008, 0017, 0025, 0031, 0046, 0048, 0052, 0053, 0054, 0057, 0058, 0059, 0061, 0062, 0065, 0066, 0067, 0069, 0071, 0083, 0086 | 23 |
| H6 | 0007, 0013, 0019, 0022, 0068, 0073, 0078, 0079, 0081, 0082, 0085 | 11 |
| H7 | 0012, 0016, 0030, 0050, 0080 | 5 |
| H8 | 0006, 0010, 0011, 0023, 0029, 0036, 0044, 0051, 0060 | 9 |
| H9 | 0056 | 1 |

## Tabla

| ADR | Título | Estado | Hito | Qué comportamiento tiene que existir en Ánima II |
|---|---|---|---|---|
| [0001](../../docs/decisions/0001-estructura-monorepo.md) | Ajustes a la estructura sugerida del monorepo | `obsoleto` | — | El mapa de capas del remake ya decide sus paquetes uno por uno; `world-schema`, `sim-core` y `shared` no existen, y dónde vive el esquema del mundo deja de ser una pregunta cuando el mundo es materia con cualidades y no una tabla de tipos. |
| [0002](../../docs/decisions/0002-paquetes-source-first.md) | Paquetes source-first sin paso de build | `revisar` | H4 | Source-first sigue, pero deja de ser «sin build»: `skill-api.d.ts` se emite con `tsc --declaration` del código real y ese archivo emitido ES el prompt — nunca una referencia copiada a mano que después diverja. |
| [0003](../../docs/decisions/0003-dsl-declarativa.md) | DSL declarativa validada, no JavaScript generado | `revertido` | — | La decisión que el remake da vuelta: habilidades en TS aislado, no DSL cerrada |
| [0004](../../docs/decisions/0004-e2e-diferido.md) | Playwright diferido a la Fase 6; la historia E2E corre en Vitest | `portar` | H5 | La historia entera se prueba headless sobre mundo, mente y ejecutor reales, sin un solo mock interno; el E2E de navegador sigue diferido, y ahora sin fecha, porque el remake no tiene hito de UI. |
| [0005](../../docs/decisions/0005-percepcion-en-sim-core.md) | Percepción construida en sim-core; distancia Manhattan | `portar` | H5 | Contrato de percepción. El agente nunca ve `WorldState`. No negociable |
| [0006](../../docs/decisions/0006-mock-imperfecto-y-evidencia.md) | Mock imperfecto por diseño y evidencia inicial de hipótesis | `portar` | H8 | Un proveedor determinista que propone mal la primera vez y jamás finge comprensión: sin él el ciclo fallar→rechazar→corregir→promover no se puede probar sin cuenta de IA, y la imperfección es el default, no un modo de demostración. |
| [0007](../../docs/decisions/0007-ui-sesion-singleton.md) | Capa de sesión en la web: singleton, view model y configs separadas | `revisar` | H6 | Una sola sesión por carga de página, creada fuera de React y parametrizada por la URL, y una UI que jamás duplica reglas del mundo; pero el `GameView` inmutable por tick muere: lo que cruza la frontera del worker son `WorldDelta[]`. |
| [0008](../../docs/decisions/0008-mundo-habitable-y-recursos.md) | Mundo habitable y distinción recurso-vs-capacidad | `portar` | H5 | Que falte un insumo no es que falte una habilidad: con recurso ausente no se forja nada — se busca, se pide y se suspende, con cero consultas — y el objetivo revive solo cuando el entorno cambia. `plan()` necesita ese tercer desenlace además de `plan` y `gap`. |
| [0009](../../docs/decisions/0009-persistencia-local-y-legado.md) | Persistencia local, informes de legado y sucesión | `portar` | H10 | La heredera recibe testimonio, no hechos: el saber entra como creencia de confianza acotada y las habilidades como candidatas que vuelven a ganarse la vara en su propio mundo; y la actividad en vuelo no se guarda — al despertar retoma sus metas, no su músculo a mitad de paso. |
| [0010](../../docs/decisions/0010-backend-nostr-bal.md) | Backend con identidad Nostr: BAL + NIP-07, desafío firmado y KV por usuario | `portar` | H8 | La identidad se prueba, no se declara: desafío de un solo uso, pubkey derivada del evento firmado y verificado, y un KV por usuario que espeja el store local, así el legado viaja a la nube sin que ningún consumidor se entere. |
| [0011](../../docs/decisions/0011-proveedor-codex.md) | Proveedor real de IA: cuenta de Codex (ChatGPT) vía CLI local | `portar` | H8 | Proveedor Codex con `CODEX_HOME` por pubkey. `apps/api` se conserva |
| [0012](../../docs/decisions/0012-vigilancia-real-y-evidencia.md) | Vigilancia en uso real, evidencia semántica y muerte por heridas | `portar` | H7 | Regresiones de mundo real con snapshot: obligatorias, no opcionales |
| [0013](../../docs/decisions/0013-prioridad-de-interpretacion.md) | El modelo real interpreta el chat; el parser es el fallback | `portar` | H6 | Prioridad entre intérpretes. Faltaba en las tres propuestas |
| [0014](../../docs/decisions/0014-js-permitido-con-jaula.md) | Se permite JS generado por IA (con jaula), cambio de spec | `revisar` | H4 | El remake se apoya en esta línea, no la contradice: JS con jaula |
| [0015](../../docs/decisions/0015-frio-arbol-talable-y-drops.md) | Frío, árbol talable y drops declarativos | `revisar` | H1 | El frío mata y la muerte tiene causa nombrada en el legado; pero `heatSource`, `hazard` y `drops` mueren como componentes: el calor es la ley térmica sobre un cuerpo que arde, y lo que cae al romper sale de `split` con la masa conservada, no de una lista de arquetipos. |
| [0016](../../docs/decisions/0016-aprender-lo-que-el-cuidador-ensena.md) | Aprender lo que el cuidador enseña | `portar` | H7 | `validateSuccessCriteria`: la única puerta para criterios no confiables |
| [0017](../../docs/decisions/0017-el-frio-como-motivo-y-el-crafteo.md) | El frío como motivo y el crafteo | `portar` | H5 | El frío nace del cuerpo y despierta su objetivo aunque el modelo nunca conteste, y le gana al hambre porque congelarse mata más rápido; la fogata se busca, no se decreta, y una habilidad de abrigo nunca se juzga en un mundo templado. |
| [0018](../../docs/decisions/0018-anima-inventa-recetas.md) | Ánima inventa recetas, y el mundo decide si son posibles | `revisar` | H1 | La tensión se resuelve por conservación numérica, no cerrando la puerta |
| [0019](../../docs/decisions/0019-querer-no-es-poder.md) | Querer no es poder: el juicio de valores lo piensa ella | `portar` | H6 | Hechos → valores. Solo `will_not` consulta al modelo, y después del mundo |
| [0020](../../docs/decisions/0020-craftear-es-intentar.md) | Craftear es intentar: los desenlaces son del mundo | `portar` | H1 | Tener los insumos da derecho al intento, no al producto: el desenlace lo tira el dado del MUNDO, que viaja en el snapshot — deja de ser predecible sin dejar de ser reproducible — y los pesos jamás los escribe quien propone, porque un peso es infalsificable. |
| [0021](../../docs/decisions/0021-identidad-y-personalidad-derivada.md) | Identidad con nombre y personalidad derivada de la historia | `portar` | H10 | La personalidad se deriva de lo vivido con una función pura y se muestra junto con la evidencia que la sostiene: el modelo le pone voz y nunca la define, el azar no participa, y el nombre lo pone el cuidador y sobrevive a la muerte como recuerdo. |
| [0022](../../docs/decisions/0022-pedirle-lo-que-no-sabe.md) | Pedirle lo que no sabe es pedirle una idea | `portar` | H6 | Pedirle algo que todavía no sabe hacer produce un contrato, no una negativa: el intérprete clasifica la intención sin filtrar por lo que ya sabe, la idea conserva el nombre que usó el cuidador, y el crédito se gasta por problema mientras el rechazo dura para siempre. |
| [0023](../../docs/decisions/0023-revision-con-memoria.md) | La revisión con memoria: corregir sabiendo qué se intentó | `portar` | H8 | Corregir con evidencia: la candidata parte de la MEJOR versión previa y no de la última, ve mundo por mundo dónde falló y qué enfoques ya se probaron, y repetir una idea vieja no gasta crédito — vuelve como reproche. |
| [0024](../../docs/decisions/0024-ia-dios-describe-objetos.md) | IA Dios: el cuidador describe, el mundo decide, y nada entra sin un sí | `revisar` | H3 | Describir no es poder, ni siquiera para el cuidador: pasa por la misma puerta que la criatura, el oráculo le pone forma y nombre y jamás los números, y lo permanente sigue pidiendo un sí explícito — pero sin tarjeta de receta ni cupo global de invenciones. |
| [0025](../../docs/decisions/0025-linea-de-vision-memoria-de-lugares-y-dolor-como-motivo.md) | Línea de visión, memoria de lugares y el dolor como motivo | `portar` | H5 | Ver exige línea despejada y lo que no ve lo recuerda: `ctx.recall()` se alimenta solo de la percepción y del propio cuerpo, se desmiente al llegar y no encontrar, y el dolor que el reflejo no resuelve se vuelve un objetivo que le gana a todo lo demás. |
| [0026](../../docs/decisions/0026-ramas-agua-y-refugio.md) | Ramas que caen, agua y refugio | `revisar` | H3 | Negarse a talar la fuente de comida tiene que tener salida: los insumos se reponen solos con tope, el terreno obliga a rodear sin cerrar ningún camino, y hay una respuesta al frío que no calienta — solo deja de perder. Las tres dejan de ser componentes: son stocks, `wet` y la ley térmica. |
| [0027](../../docs/decisions/0027-interacciones-inventadas.md) | Interacciones inventadas: Ánima propone, la física filtra, la IA Dios juzga | `revertido` | — | El modelo ya no inventa reglas del mundo: `stance` sobrevive como `arrangement` y el objetivo-por-rasgos como roles sobre cualidades, pero crear una interacción nueva es escribir una ley, y el alcance decidido lo deja fuera (diferido al Hito 12). |
| [0028](../../docs/decisions/0028-buscar-antes-de-rendirse.md) | Buscar antes de rendirse: `explore`/`sees` y pedidos que recorren el mapa | `portar` | H4 | Explorar es determinista y barato: celda vecina menos visitada, sin dado, con la condición evaluada antes del primer paso para no gastar un tick si ya lo ve; y un «no hay» solo vale después de haber buscado, nunca por ceguera de rango. |
| [0029](../../docs/decisions/0029-codigo-generado-y-agentes-autores.md) | Código generado y agentes autores: dónde va JS, quién escribe, quién decide | `revisar` | H8 | Código generado y agentes autores: releer contra el alcance decidido |
| [0030](../../docs/decisions/0030-el-criterio-no-lo-escribe-quien-propone.md) | El criterio no lo escribe quien propone la skill | `portar` | H7 | El criterio lo escribe el planificador (el `gap`). Íntegro, sin el trámite |
| [0031](../../docs/decisions/0031-el-arbol-de-crafteo.md) | El árbol de crafteo: lo complejo se hace de lo simple | `revisar` | H5 | Lo complejo se sigue derivando de lo simple, pero por encadenado hacia atrás sobre `establishes`, no por árbol de recetas; el costo se deriva, nunca se declara |
| [0032](../../docs/decisions/0032-lo-grande-es-una-obra.md) | Lo grande no es un objeto, es una obra | `revisar` | H4 | Una casa no es una entidad: son cuerpos colocados donde van. `put` reemplaza al spawn del bloque-casa y el plano se vuelve esquema de construcción declarado |
| [0033](../../docs/decisions/0033-recuerdos-de-lo-que-hizo.md) | Recuerdos de lo que hizo: nacen del mundo y se cuentan solos | `portar` | H10 | Los hechos propios nacen del `SimEvent` del mundo y nunca los escribe el modelo; se cuentan por repetición y se compactan sin borrar |
| [0034](../../docs/decisions/0034-obras-por-tandas-y-soltar-a-conciencia.md) | Obras por tandas y soltar a conciencia | `portar` | H4 | Colocación idempotente. Faltaba en las tres propuestas |
| [0035](../../docs/decisions/0035-obras-grandes-caminando.md) | Obras grandes: caminar mientras construye | `portar` | H4 | Colocar lejos es caminar hasta el lado de la celda y poner ahí, nunca pararse encima: `goTo(celda,{within:1})` tiene que excluir la distancia 0 |
| [0036](../../docs/decisions/0036-inventar-desde-el-propio-fracaso.md) | Inventar desde el propio fracaso | `portar` | H8 | Inventar desde el hambre bloqueada. Faltaba en las tres propuestas |
| [0037](../../docs/decisions/0037-la-materia-no-desaparece.md) | La materia no desaparece | `revisar` | H1 | Romper devuelve la materia que costó, y ahora sin juez: `split` sobre juntas más `mass` conservada hacen la cuenta que hacía la IA Dios |
| [0038](../../docs/decisions/0038-gps-hacia-el-recurso.md) | El GPS hacia el recurso: `gpsTo` | `portar` | H4 | Ir a donde hay X con tres rumbos por certeza —vista, recuerdo, exploración— y el recuerdo que se desmiente al llegar y no ver |
| [0039](../../docs/decisions/0039-el-mundo-no-espera.md) | El mundo no espera: pensamiento en vuelo y medición de consultas | `obsoleto` | — | Parche sobre `think(): Promise` dentro del tick. Muere con la firma |
| [0040](../../docs/decisions/0040-pensar-cuesta-ticks-no-segundos.md) | Pensar cuesta ticks, no segundos: presupuesto biológico del pensamiento en vuelo | `obsoleto` | — | Ídem 0039 |
| [0041](../../docs/decisions/0041-el-fuego-quema-por-dentro-no-por-cerca.md) | El fuego quema por dentro, no por cerca | `obsoleto` | — | Lo mata el campo térmico continuo: calor y daño dejan de ser dos radios decretados que se contradicen y pasan a ser un gradiente |
| [0042](../../docs/decisions/0042-una-receta-tambien-tiene-que-tener-sentido.md) | Una receta también tiene que tener sentido | `obsoleto` | — | Lo mata `admit()`: «¿esto sale de esto en un paso?» pasa de consulta al modelo a conservación y envolvente por tag en 0.2 ms |
| [0043](../../docs/decisions/0043-la-practica-en-segundo-plano.md) | La práctica en segundo plano: el ciclo de habilidades sale del think | `obsoleto` | — | Ídem 0039. Su intención revive en el carril de mejora |
| [0044](../../docs/decisions/0044-matar-el-arranque-en-frio.md) | Matar el arranque en frío: sesión persistente contra `codex app-server` | `portar` | H8 | 1733 ms de spawn medidos. El aprendizaje sobrevive como warm-up |
| [0045](../../docs/decisions/0045-la-espera-se-cuenta-no-se-disimula.md) | La espera se cuenta, no se disimula: sueños, progreso y reloj mientras piensa | `obsoleto` | — | Ídem 0039 |
| [0046](../../docs/decisions/0046-un-motivo-que-se-agrava-despierta.md) | Un motivo que se agrava despierta lo que se abandonó | `portar` | H5 | Un motivo que empeora reabre lo prohibido: la veda de `progress.ts` tras dos fallos caduca cuando el cuerpo está peor, sin esperar al cuidador |
| [0047](../../docs/decisions/0047-la-herencia-lleva-la-leccion.md) | La herencia lleva la lección, no solo el saber | `portar` | H10 | La heredera nace sabiendo de qué murió su antecesora y qué dejó a medias, como memoria y como regresión — nunca como objetivo propio |
| [0048](../../docs/decisions/0048-el-cuerpo-en-rojo-le-gana-a-la-palabra.md) | El cuerpo en rojo le gana a la palabra | `portar` | H5 | El cuerpo en rojo interrumpe la actividad en curso: D1 no puede ganarle al hambre, y solo se suelta el encargo del cuidador, jamás lo que la salva |
| [0049](../../docs/decisions/0049-la-obra-tiene-un-sitio.md) | La obra tiene un sitio, y se ve antes de existir | `portar` | H4 | La obra tiene sitio elegido antes de empezar y guardado en `ctx.memory`: retomarla es seguir la misma, y solo promete no pisar lo que ella puede ver |
| [0050](../../docs/decisions/0050-lo-mejor-que-tengo-mientras-sigo-puliendo.md) | Lo mejor que tengo mientras sigo puliendo | `portar` | H7 | Lo mejor MEDIDO se usa mientras se sigue puliendo — no lo último intentado, y nunca lo que viola un invariante del mundo |
| [0051](../../docs/decisions/0051-aprender-mas-rapido-sin-bajar-la-vara.md) | Aprender más rápido sin bajar la vara | `portar` | H8 | K candidatas por viaje y corte por meseta: se deja de pulir cuando dos seguidas no mejoran estrictamente, sin tocar la vara del juez |
| [0052](../../docs/decisions/0052-lo-que-le-falta-se-ve.md) | Lo que le falta se ve, no se adivina | `portar` | H5 | Lo que le falta se ve: el diagnóstico del rol faltante |
| [0053](../../docs/decisions/0053-el-encargo-se-descompone-en-pasos.md) | El encargo se descompone en pasos que se ven | `portar` | H5 | `goalGraph` con orden parcial. Faltaba en las tres propuestas |
| [0054](../../docs/decisions/0054-lo-que-no-ve-lo-busca.md) | Lo que no ve, lo busca | `portar` | H5 | No ver no es el final del camino: antes de rendirse explora hacia lo menos visitado hasta ver — y el aviso al cuidador va primero, la caminata después |
| [0055](../../docs/decisions/0055-una-habilidad-hecha-de-habilidades.md) | Una habilidad hecha de habilidades | `revisar` | H4 | Componer sigue vivo pero `Ctx` hoy no tiene con qué llamar a otra habilidad; hay que conservar resolución tardía por nombre y que la vara de una pieza sea su madre |
| [0056](../../docs/decisions/0056-el-catalogo-de-sus-obras.md) | El catálogo de sus obras | `revisar` | H9 | Lo que sabe levantar se ve dibujado y derivado del mundo, no de una lista guardada; sin hito de UI, cuelga de donde la biblioteca se vuelve consultable |
| [0057](../../docs/decisions/0057-lugar-para-los-ingredientes.md) | Lugar para los ingredientes, y esperar lo que sí aparece | `portar` | H5 | Planificar cuenta las manos: hace falta lugar para UNA pieza entera, no una ranura; y lo que espera es materia que de verdad aparece, no la pieza que se fabrica |
| [0058](../../docs/decisions/0058-la-cosecha-baja-y-no-se-come-lo-hecho.md) | La cosecha baja, y no se come lo hecho | `portar` | H5 | `isMadeFrom`: nunca romper algo hecho de lo que buscás |
| [0059](../../docs/decisions/0059-terminar-el-programa-no-es-terminar-la-obra.md) | Terminar el programa no es terminar la obra | `portar` | H5 | Que el generador termine no cierra el objetivo: lo cierra el predicado del mundo, y una obra con celdas sin colocar se SUSPENDE esperando materia en vez de darse por cumplida o por fallada. |
| [0060](../../docs/decisions/0060-el-renglon-del-ciclo-no-sobrevive-al-ciclo.md) | El renglón del ciclo no sobrevive al ciclo | `revisar` | H8 | El relato del aprendizaje cuenta solo el ciclo en vuelo y se limpia también cuando termina bien; con fragua y carril de mejora corriendo en workers distintos, cada renglón tiene que decir de qué ciclo es o dos relojes se muestran como uno. |
| [0061](../../docs/decisions/0061-modo-creativo.md) | Modo creativo | `revisar` | H5 | Sigue haciendo falta un modo para observar sin cronómetro, pero rellenar stamina y nutrition es aporte del dios: pasa por el ledger con presupuesto propio y marcado, o el invariante económico lo lee como bomba de materia. |
| [0062](../../docs/decisions/0062-el-cuerpo-satisfecho-suelta-su-objetivo.md) | El cuerpo satisfecho suelta su objetivo | `portar` | H5 | Una necesidad que dejó de doler cierra su objetivo la haya calmado quien la haya calmado, con histéresis; y no se corta la actividad en vuelo, porque el final de la actividad es donde se actualiza la creencia β. |
| [0063](../../docs/decisions/0063-dibujar-lo-que-tiene-delante.md) | Dibujar lo que tiene delante | `revertido` | — | El remake da vuelta el orden a propósito: nunca se le quita un tick al cuerpo para dibujar. El glifo procedural de sustancia+forma sale en el acto y la glosa bonita es cola de prioridad cero. |
| [0064](../../docs/decisions/0064-la-intencion-de-dibujar-tambien-se-guarda.md) | La intención de dibujar también se guarda | `obsoleto` | — | Muere con 0063: no hay cola de dibujos pendientes que perder porque siempre hay glifo, y lo que falta bautizar se deriva del mundo (sustancias sin lexema), no de un estado en memoria. |
| [0065](../../docs/decisions/0065-el-encargo-sale-a-buscar-lo-que-le-falta.md) | El encargo sale a buscar lo que le falta | `portar` | H5 | El encargo sale a buscar lo que le falta |
| [0066](../../docs/decisions/0066-cuando-falta-camino-se-abre-paso.md) | Cuando lo que falta es camino, se abre paso | `portar` | H5 | Antes de declarar falta de materia hay que distinguir «no hay» de «hay y no llego»: si un sólido rompible esconde mundo sin pisar, abrirse paso es un rodeo que ni cumple ni fracasa el encargo — y hoy romper no existe entre los cuatro procesos aplicables. |
| [0067](../../docs/decisions/0067-el-tope-de-abrirse-paso-y-lo-que-no-se-puede.md) | El tope de abrirse paso, y decir lo que no se puede | `portar` | H5 | Se busca la materia BASE y no las piezas del plano; los éxitos inútiles se topean (progress.ts cuenta fracasos y esto no lo es); y «no veo de dónde sacar X» se dice en primera persona sin dejar de mirar. |
| [0068](../../docs/decisions/0068-lo-que-no-puede-conseguir-lo-pide.md) | Lo que no puede conseguir, lo pide | `portar` | H6 | Cuando el plan no cierra, pide por el canal de habla la materia base con cantidad DERIVADA, descontando lo que ya lleva, y no repite el pedido hasta que la lista cambie; y todo dato que gobierne una decisión futura viaja en el guardado. |
| [0069](../../docs/decisions/0069-una-sola-tarjeta-y-el-arbol-a-demanda.md) | Una sola tarjeta, y el árbol a demanda | `revisar` | H5 | «Por qué está trabada» tiene que ser navegable y no deducible: árbol expandido a demanda por nivel con la cuenta multiplicada por la rama entera — pero derivado del encadenado hacia atrás sobre `establishes`/SCHEMA_INDEX, no de recetas. |
| [0070](../../docs/decisions/0070-el-tamano-de-la-mochila-es-del-cuidador.md) | El tamaño de la mochila es del cuidador | `revisar` | H4 | El tope de manos tiene que existir, verse («lleva 4/6») y ser una perilla del cuidador que sobrevive a la muerte; pero sale de la física —masa cargada contra `portable` y stamina— y no de un `capacity` clavado en el escenario. |
| [0071](../../docs/decisions/0071-el-sitio-de-una-obra-tiene-que-ser-alcanzable.md) | El sitio de una obra tiene que ser alcanzable | `portar` | H5 | Un sitio se valida con el MISMO caminante que después va a caminar, la aproximación se comprueba paso a paso, y «no encuentro dónde levantarla» es una respuesta legítima en vez de plantarla donde esté parada. |
| [0072](../../docs/decisions/0072-el-juez-tambien-pregunta-si-es-una-cosa.md) | El juez también pregunta si es una cosa | `obsoleto` | — | Lo elimina que los cuerpos no tengan `kind` y que el modelo ya no proponga tipos ni recetas: no hay dónde acuñar una «cocina» de un bloque, y `admit()` reemplaza al juez de recetas entero. |
| [0073](../../docs/decisions/0073-lo-que-escribe-se-lee-de-un-vistazo.md) | Lo que escribe se lee de un vistazo | `portar` | H6 | No se repite sola: un mensaje idéntico al último, sin que el cuidador haya hablado en el medio, no sale — y la guarda vive en el cuello único por donde pasa todo lo que dice, para no ensuciar también su memoria ni el prefijo cacheado que viaja al modelo. |
| [0074](../../docs/decisions/0074-al-ladrillo-no-se-le-pregunta-si-es-una-casa.md) | Al ladrillo no se le pregunta si es una casa | `obsoleto` | — | Muere con 0072: no hay juez por receta ni piezas pasando sueltas por él. Lo que sobrevive ya está en el juez de habilidades — una sub-habilidad se acredita solo si la que la llama la EJECUTÓ. |
| [0075](../../docs/decisions/0075-lo-que-se-aprende-tambien-se-puede-olvidar.md) | Lo que se aprende también se puede olvidar | `portar` | H10 | El cuidador puede olvidar: `planPrune` muestra el arrastre transitivo entero antes de tocar nada y `applyPrune` ejecuta lo ya mostrado, así cancelar no deshace nada. Lo intocable ya no es `PROTECTED_KINDS` sino lo sellado por testigo en el ledger. |
| [0076](../../docs/decisions/0076-el-catalogo-es-del-cuidador.md) | El catálogo es del cuidador | `portar` | H10 | Lo aprendido sobrevive al MUNDO y no solo a la muerte: catálogo fuera de la partida que solo suma, con «empezar de cero» como gesto del momento, y toda conducta que llega de afuera vuelve a provisional y se re-rinde en su mundo. |
| [0077](../../docs/decisions/0077-lo-que-construye-cambia-por-donde-se-camina.md) | Lo que construye puede cambiar por dónde se camina | `portar` | H2 | `footing` es una cualidad derivada y no un puente: la única fuente de verdad sobre qué se pisa la consulta, el invariante de solapamiento la exceptúa y la percepción la expone — inventar tiene que poder cambiar por dónde se camina. |
| [0078](../../docs/decisions/0078-el-encargo-se-dice-como-se-habla.md) | El encargo se dice como se habla | `portar` | H6 | Un mensaje con tres verbos son tres encargos hermanos en fila, no uno: cada parte espera a que la anterior CIERRE (no a que triunfe), se decide sobre todas al recibirlas, y se contesta una sola vez. |
| [0079](../../docs/decisions/0079-un-veto-sabe-de-que-forma-hablaba.md) | Un veto sabe de qué forma hablaba | `portar` | H6 | El veto tiene forma. Faltaba en las tres propuestas |
| [0080](../../docs/decisions/0080-los-mapas-son-pruebas-de-aceptacion.md) | Los mapas son pruebas de aceptación, no niveles | `portar` | H7 | Una prueba de aceptación son condiciones verificables contra el mundo cuyo vocabulario NO puede nombrar la solución; el planteo entra por el chat normal, lo que ella dice no cuenta, y cada intento deja traza — el mapa cableado celda por celda pasa a ser semilla más dios. |
| [0081](../../docs/decisions/0081-el-lenguaje-se-ancla-en-el-espacio.md) | El lenguaje se ancla en el espacio | `portar` | H6 | El modelo elige una relación medible y una referencia por tipo, nunca coordenadas; un grounder determinista la resuelve y CONGELA la geometría al aceptar («el otro lado» no se recalcula mientras camina), y el objetivo cierra contra la posición real. |
| [0082](../../docs/decisions/0082-las-referencias-conservan-identidad.md) | Las referencias conservan identidad | `portar` | H6 | Referencias con identidad → `binds` diferidos en `GoalNode` |
| [0083](../../docs/decisions/0083-los-objetivos-son-predicados-del-mundo.md) | Los objetivos son predicados del mundo | `portar` | H5 | Objetivos como predicados del mundo |
| [0084](../../docs/decisions/0084-metacognicion-y-registro-epistemologico.md) | Metacognición y registro epistemológico común | `portar` | H10 | Metacognición y registro epistemológico |
| [0085](../../docs/decisions/0085-el-tiempo-y-las-condiciones-envuelven-al-encargo.md) | El tiempo y las condiciones envuelven al encargo | `portar` | H6 | `GoalTemporal`: `startWhen` / `until` / plazo |
| [0086](../../docs/decisions/0086-lo-que-sabe-hacer-es-un-catalogo-y-el-plan-es-de-ahora.md) | Lo que sabe hacer es un catálogo, y el plan es de ahora | `revisar` | H5 | Catálogo único de lo que sabe hacer, plan efímero que se rearma con percepción fresca, y cada paso declarando cómo se comprueba (con `verify: null` como respuesta honesta) — pero el catálogo es `Process` + SCHEMA_INDEX + primitivas de `Ctx`, no un `Capability` que compila a DSL, y el sí del cuidador ya no arranca: promueve. |
