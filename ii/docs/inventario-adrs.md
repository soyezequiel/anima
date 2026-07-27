# Inventario de ADRs — qué sobrevive al remake

Los 86 ADRs de Ánima I, uno por uno, con su destino en Ánima II.

**Por qué existe este archivo.** El riesgo 5 del [documento de
arquitectura](../../docs/architecture/remake-anima-ii.md) dice que el inventario
de ADRs es una tarea sin dueño, sin hito y sin criterio de cierre — y que las
tres propuestas iban a redescubrir 86 decisiones a los golpes. Éste es su dueño.
**No se empieza el Hito 1 hasta que no quede ninguna fila en `pendiente`.**

## Estados

| Estado | Qué significa |
|---|---|
| `portar` | El comportamiento tiene que existir en Ánima II. Va con hito asignado |
| `revisar` | Sigue vigente pero la forma cambia. Hay que releer el ADR y decidir |
| `obsoleto` | Existía para mitigar algo que el remake elimina de raíz |
| `revertido` | El remake decide lo contrario, a propósito |
| `pendiente` | **Sin triar todavía** |

**Estado: 27 de 86 triados** — únicamente los que el documento de
arquitectura nombra de forma explícita. Las 59 filas restantes están sin
leer, y son el trabajo real de este archivo. Ninguna se marcó por corazonada.

| ADR | Título | Estado | Hito | Nota |
|---|---|---|---|---|
| [0001](../../docs/decisions/0001-estructura-monorepo.md) | Ajustes a la estructura sugerida del monorepo | `pendiente` |  |  |
| [0002](../../docs/decisions/0002-paquetes-source-first.md) | Paquetes source-first sin paso de build | `pendiente` |  |  |
| [0003](../../docs/decisions/0003-dsl-declarativa.md) | DSL declarativa validada, no JavaScript generado | `revertido` | — | La decisión que el remake da vuelta: habilidades en TS aislado, no DSL cerrada |
| [0004](../../docs/decisions/0004-e2e-diferido.md) | Playwright diferido a la Fase 6; la historia E2E corre en Vitest | `pendiente` |  |  |
| [0005](../../docs/decisions/0005-percepcion-en-sim-core.md) | Percepción construida en sim-core; distancia Manhattan | `portar` | H5 | Contrato de percepción. El agente nunca ve `WorldState`. No negociable |
| [0006](../../docs/decisions/0006-mock-imperfecto-y-evidencia.md) | Mock imperfecto por diseño y evidencia inicial de hipótesis | `pendiente` |  |  |
| [0007](../../docs/decisions/0007-ui-sesion-singleton.md) | Capa de sesión en la web: singleton, view model y configs separadas | `pendiente` |  |  |
| [0008](../../docs/decisions/0008-mundo-habitable-y-recursos.md) | Mundo habitable y distinción recurso-vs-capacidad | `pendiente` |  |  |
| [0009](../../docs/decisions/0009-persistencia-local-y-legado.md) | Persistencia local, informes de legado y sucesión | `pendiente` |  |  |
| [0010](../../docs/decisions/0010-backend-nostr-bal.md) | Backend con identidad Nostr: BAL + NIP-07, desafío firmado y KV por usuario | `pendiente` |  |  |
| [0011](../../docs/decisions/0011-proveedor-codex.md) | Proveedor real de IA: cuenta de Codex (ChatGPT) vía CLI local | `portar` | H8 | Proveedor Codex con `CODEX_HOME` por pubkey. `apps/api` se conserva |
| [0012](../../docs/decisions/0012-vigilancia-real-y-evidencia.md) | Vigilancia en uso real, evidencia semántica y muerte por heridas | `portar` | H7 | Regresiones de mundo real con snapshot: obligatorias, no opcionales |
| [0013](../../docs/decisions/0013-prioridad-de-interpretacion.md) | El modelo real interpreta el chat; el parser es el fallback | `portar` | H6 | Prioridad entre intérpretes. Faltaba en las tres propuestas |
| [0014](../../docs/decisions/0014-js-permitido-con-jaula.md) | Se permite JS generado por IA (con jaula), cambio de spec | `revisar` | H4 | El remake se apoya en esta línea, no la contradice: JS con jaula |
| [0015](../../docs/decisions/0015-frio-arbol-talable-y-drops.md) | Frío, árbol talable y drops declarativos | `pendiente` |  |  |
| [0016](../../docs/decisions/0016-aprender-lo-que-el-cuidador-ensena.md) | Aprender lo que el cuidador enseña | `portar` | H7 | `validateSuccessCriteria`: la única puerta para criterios no confiables |
| [0017](../../docs/decisions/0017-el-frio-como-motivo-y-el-crafteo.md) | El frío como motivo y el crafteo | `pendiente` |  |  |
| [0018](../../docs/decisions/0018-anima-inventa-recetas.md) | Ánima inventa recetas, y el mundo decide si son posibles | `revisar` | H1 | La tensión se resuelve por conservación numérica, no cerrando la puerta |
| [0019](../../docs/decisions/0019-querer-no-es-poder.md) | Querer no es poder: el juicio de valores lo piensa ella | `portar` | H6 | Hechos → valores. Solo `will_not` consulta al modelo, y después del mundo |
| [0020](../../docs/decisions/0020-craftear-es-intentar.md) | Craftear es intentar: los desenlaces son del mundo | `pendiente` |  |  |
| [0021](../../docs/decisions/0021-identidad-y-personalidad-derivada.md) | Identidad con nombre y personalidad derivada de la historia | `pendiente` |  |  |
| [0022](../../docs/decisions/0022-pedirle-lo-que-no-sabe.md) | Pedirle lo que no sabe es pedirle una idea | `pendiente` |  |  |
| [0023](../../docs/decisions/0023-revision-con-memoria.md) | La revisión con memoria: corregir sabiendo qué se intentó | `pendiente` |  |  |
| [0024](../../docs/decisions/0024-ia-dios-describe-objetos.md) | IA Dios: el cuidador describe, el mundo decide, y nada entra sin un sí | `pendiente` |  |  |
| [0025](../../docs/decisions/0025-linea-de-vision-memoria-de-lugares-y-dolor-como-motivo.md) | Línea de visión, memoria de lugares y el dolor como motivo | `pendiente` |  |  |
| [0026](../../docs/decisions/0026-ramas-agua-y-refugio.md) | Ramas que caen, agua y refugio | `pendiente` |  |  |
| [0027](../../docs/decisions/0027-interacciones-inventadas.md) | Interacciones inventadas: Ánima propone, la física filtra, la IA Dios juzga | `pendiente` |  |  |
| [0028](../../docs/decisions/0028-buscar-antes-de-rendirse.md) | Buscar antes de rendirse: `explore`/`sees` y pedidos que recorren el mapa | `pendiente` |  |  |
| [0029](../../docs/decisions/0029-codigo-generado-y-agentes-autores.md) | Código generado y agentes autores: dónde va JS, quién escribe, quién decide | `revisar` | H8 | Código generado y agentes autores: releer contra el alcance decidido |
| [0030](../../docs/decisions/0030-el-criterio-no-lo-escribe-quien-propone.md) | El criterio no lo escribe quien propone la skill | `portar` | H7 | El criterio lo escribe el planificador (el `gap`). Íntegro, sin el trámite |
| [0031](../../docs/decisions/0031-el-arbol-de-crafteo.md) | El árbol de crafteo: lo complejo se hace de lo simple | `pendiente` |  |  |
| [0032](../../docs/decisions/0032-lo-grande-es-una-obra.md) | Lo grande no es un objeto, es una obra | `pendiente` |  |  |
| [0033](../../docs/decisions/0033-recuerdos-de-lo-que-hizo.md) | Recuerdos de lo que hizo: nacen del mundo y se cuentan solos | `pendiente` |  |  |
| [0034](../../docs/decisions/0034-obras-por-tandas-y-soltar-a-conciencia.md) | Obras por tandas y soltar a conciencia | `portar` | H4 | Colocación idempotente. Faltaba en las tres propuestas |
| [0035](../../docs/decisions/0035-obras-grandes-caminando.md) | Obras grandes: caminar mientras construye | `pendiente` |  |  |
| [0036](../../docs/decisions/0036-inventar-desde-el-propio-fracaso.md) | Inventar desde el propio fracaso | `portar` | H8 | Inventar desde el hambre bloqueada. Faltaba en las tres propuestas |
| [0037](../../docs/decisions/0037-la-materia-no-desaparece.md) | La materia no desaparece | `pendiente` |  |  |
| [0038](../../docs/decisions/0038-gps-hacia-el-recurso.md) | El GPS hacia el recurso: `gpsTo` | `pendiente` |  |  |
| [0039](../../docs/decisions/0039-el-mundo-no-espera.md) | El mundo no espera: pensamiento en vuelo y medición de consultas | `obsoleto` | — | Parche sobre `think(): Promise` dentro del tick. Muere con la firma |
| [0040](../../docs/decisions/0040-pensar-cuesta-ticks-no-segundos.md) | Pensar cuesta ticks, no segundos: presupuesto biológico del pensamiento en vuelo | `obsoleto` | — | Ídem 0039 |
| [0041](../../docs/decisions/0041-el-fuego-quema-por-dentro-no-por-cerca.md) | El fuego quema por dentro, no por cerca | `pendiente` |  |  |
| [0042](../../docs/decisions/0042-una-receta-tambien-tiene-que-tener-sentido.md) | Una receta también tiene que tener sentido | `pendiente` |  |  |
| [0043](../../docs/decisions/0043-la-practica-en-segundo-plano.md) | La práctica en segundo plano: el ciclo de habilidades sale del think | `obsoleto` | — | Ídem 0039. Su intención revive en el carril de mejora |
| [0044](../../docs/decisions/0044-matar-el-arranque-en-frio.md) | Matar el arranque en frío: sesión persistente contra `codex app-server` | `portar` | H8 | 1733 ms de spawn medidos. El aprendizaje sobrevive como warm-up |
| [0045](../../docs/decisions/0045-la-espera-se-cuenta-no-se-disimula.md) | La espera se cuenta, no se disimula: sueños, progreso y reloj mientras piensa | `obsoleto` | — | Ídem 0039 |
| [0046](../../docs/decisions/0046-un-motivo-que-se-agrava-despierta.md) | Un motivo que se agrava despierta lo que se abandonó | `pendiente` |  |  |
| [0047](../../docs/decisions/0047-la-herencia-lleva-la-leccion.md) | La herencia lleva la lección, no solo el saber | `pendiente` |  |  |
| [0048](../../docs/decisions/0048-el-cuerpo-en-rojo-le-gana-a-la-palabra.md) | El cuerpo en rojo le gana a la palabra | `pendiente` |  |  |
| [0049](../../docs/decisions/0049-la-obra-tiene-un-sitio.md) | La obra tiene un sitio, y se ve antes de existir | `pendiente` |  |  |
| [0050](../../docs/decisions/0050-lo-mejor-que-tengo-mientras-sigo-puliendo.md) | Lo mejor que tengo mientras sigo puliendo | `pendiente` |  |  |
| [0051](../../docs/decisions/0051-aprender-mas-rapido-sin-bajar-la-vara.md) | Aprender más rápido sin bajar la vara | `pendiente` |  |  |
| [0052](../../docs/decisions/0052-lo-que-le-falta-se-ve.md) | Lo que le falta se ve, no se adivina | `portar` | H5 | Lo que le falta se ve: el diagnóstico del rol faltante |
| [0053](../../docs/decisions/0053-el-encargo-se-descompone-en-pasos.md) | El encargo se descompone en pasos que se ven | `portar` | H5 | `goalGraph` con orden parcial. Faltaba en las tres propuestas |
| [0054](../../docs/decisions/0054-lo-que-no-ve-lo-busca.md) | Lo que no ve, lo busca | `pendiente` |  |  |
| [0055](../../docs/decisions/0055-una-habilidad-hecha-de-habilidades.md) | Una habilidad hecha de habilidades | `pendiente` |  |  |
| [0056](../../docs/decisions/0056-el-catalogo-de-sus-obras.md) | El catálogo de sus obras | `pendiente` |  |  |
| [0057](../../docs/decisions/0057-lugar-para-los-ingredientes.md) | Lugar para los ingredientes, y esperar lo que sí aparece | `pendiente` |  |  |
| [0058](../../docs/decisions/0058-la-cosecha-baja-y-no-se-come-lo-hecho.md) | La cosecha baja, y no se come lo hecho | `portar` | H5 | `isMadeFrom`: nunca romper algo hecho de lo que buscás |
| [0059](../../docs/decisions/0059-terminar-el-programa-no-es-terminar-la-obra.md) | Terminar el programa no es terminar la obra | `pendiente` |  |  |
| [0060](../../docs/decisions/0060-el-renglon-del-ciclo-no-sobrevive-al-ciclo.md) | El renglón del ciclo no sobrevive al ciclo | `pendiente` |  |  |
| [0061](../../docs/decisions/0061-modo-creativo.md) | Modo creativo | `pendiente` |  |  |
| [0062](../../docs/decisions/0062-el-cuerpo-satisfecho-suelta-su-objetivo.md) | El cuerpo satisfecho suelta su objetivo | `pendiente` |  |  |
| [0063](../../docs/decisions/0063-dibujar-lo-que-tiene-delante.md) | Dibujar lo que tiene delante | `pendiente` |  |  |
| [0064](../../docs/decisions/0064-la-intencion-de-dibujar-tambien-se-guarda.md) | La intención de dibujar también se guarda | `pendiente` |  |  |
| [0065](../../docs/decisions/0065-el-encargo-sale-a-buscar-lo-que-le-falta.md) | El encargo sale a buscar lo que le falta | `portar` | H5 | El encargo sale a buscar lo que le falta |
| [0066](../../docs/decisions/0066-cuando-falta-camino-se-abre-paso.md) | Cuando lo que falta es camino, se abre paso | `pendiente` |  |  |
| [0067](../../docs/decisions/0067-el-tope-de-abrirse-paso-y-lo-que-no-se-puede.md) | El tope de abrirse paso, y decir lo que no se puede | `pendiente` |  |  |
| [0068](../../docs/decisions/0068-lo-que-no-puede-conseguir-lo-pide.md) | Lo que no puede conseguir, lo pide | `pendiente` |  |  |
| [0069](../../docs/decisions/0069-una-sola-tarjeta-y-el-arbol-a-demanda.md) | Una sola tarjeta, y el árbol a demanda | `pendiente` |  |  |
| [0070](../../docs/decisions/0070-el-tamano-de-la-mochila-es-del-cuidador.md) | El tamaño de la mochila es del cuidador | `pendiente` |  |  |
| [0071](../../docs/decisions/0071-el-sitio-de-una-obra-tiene-que-ser-alcanzable.md) | El sitio de una obra tiene que ser alcanzable | `pendiente` |  |  |
| [0072](../../docs/decisions/0072-el-juez-tambien-pregunta-si-es-una-cosa.md) | El juez también pregunta si es una cosa | `pendiente` |  |  |
| [0073](../../docs/decisions/0073-lo-que-escribe-se-lee-de-un-vistazo.md) | Lo que escribe se lee de un vistazo | `pendiente` |  |  |
| [0074](../../docs/decisions/0074-al-ladrillo-no-se-le-pregunta-si-es-una-casa.md) | Al ladrillo no se le pregunta si es una casa | `pendiente` |  |  |
| [0075](../../docs/decisions/0075-lo-que-se-aprende-tambien-se-puede-olvidar.md) | Lo que se aprende también se puede olvidar | `pendiente` |  |  |
| [0076](../../docs/decisions/0076-el-catalogo-es-del-cuidador.md) | El catálogo es del cuidador | `pendiente` |  |  |
| [0077](../../docs/decisions/0077-lo-que-construye-cambia-por-donde-se-camina.md) | Lo que construye puede cambiar por dónde se camina | `pendiente` |  |  |
| [0078](../../docs/decisions/0078-el-encargo-se-dice-como-se-habla.md) | El encargo se dice como se habla | `pendiente` |  |  |
| [0079](../../docs/decisions/0079-un-veto-sabe-de-que-forma-hablaba.md) | Un veto sabe de qué forma hablaba | `portar` | H6 | El veto tiene forma. Faltaba en las tres propuestas |
| [0080](../../docs/decisions/0080-los-mapas-son-pruebas-de-aceptacion.md) | Los mapas son pruebas de aceptación, no niveles | `pendiente` |  |  |
| [0081](../../docs/decisions/0081-el-lenguaje-se-ancla-en-el-espacio.md) | El lenguaje se ancla en el espacio | `pendiente` |  |  |
| [0082](../../docs/decisions/0082-las-referencias-conservan-identidad.md) | Las referencias conservan identidad | `portar` | H6 | Referencias con identidad → `binds` diferidos en `GoalNode` |
| [0083](../../docs/decisions/0083-los-objetivos-son-predicados-del-mundo.md) | Los objetivos son predicados del mundo | `portar` | H5 | Objetivos como predicados del mundo |
| [0084](../../docs/decisions/0084-metacognicion-y-registro-epistemologico.md) | Metacognición y registro epistemológico común | `portar` | H10 | Metacognición y registro epistemológico |
| [0085](../../docs/decisions/0085-el-tiempo-y-las-condiciones-envuelven-al-encargo.md) | El tiempo y las condiciones envuelven al encargo | `portar` | H6 | `GoalTemporal`: `startWhen` / `until` / plazo |
| [0086](../../docs/decisions/0086-lo-que-sabe-hacer-es-un-catalogo-y-el-plan-es-de-ahora.md) | Lo que sabe hacer es un catálogo, y el plan es de ahora | `pendiente` |  |  |
