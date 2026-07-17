# ADR 0028 — Buscar antes de rendirse: `explore`/`sees` y pedidos que recorren el mapa

Fecha: 2026-07-17 · Estado: aceptada · Complementa la memoria de lugares y la línea de visión (ADR 0025)

## Contexto

La percepción tiene rango y línea de visión, y eso está bien: es lo que hace
que el mundo tenga incógnitas. Lo que estaba mal era la reacción a la
incógnita. Ante «trae una rama» con la rama fuera del rango, la mascota
respondía «No sé dónde encontrar rama» (la negativa) o, si el pedido entraba,
`findEntities` devolvía vacío y el programa abortaba en el acto con
`no-candidates` → «no encuentro el objeto». Nunca daba un paso para averiguarlo.
Una corrida real lo mostró dos veces: «recorre el mapa completo en busca de mas
ramas» falló, y juntar ingredientes para la cama dependió de que el cuidador
hiciera de GPS.

La memoria de lugares (ADR 0025) cubre solo lo YA visto, y las habilidades de
recorrido que la mascota aprende (`recorrido-mapa`) son conductas sueltas que
ningún programa de pedido usa como paso previo.

## Decisión

1. **La DSL gana una condición y una operación, ambas deterministas.**
   - `{"type":"sees","query":…}` — percibe (a la vista o en la mano) algo que
     cumple la misma query de `findEntities`.
   - `{"op":"explore","maxSteps":1..50,"until"?:COND}` — un paso por tick hacia
     la celda vecina **menos visitada**, esquivando por percepción los sólidos
     y el agua (el mismo lookahead de `moveToward`) y penalizando las celdas
     que el mundo rechazó (bordes, sólidos fuera de la vista). El `until` se
     evalúa **antes** de cada paso, incluido el primero: si ya lo ve, explorar
     no cuesta ni un tick. Es determinista — sin RNG — y cubre el espacio en
     vez de oscilar.

2. **Los programas de pedidos buscan antes de dar el «no hay» por cierto.**
   `fetch-item`, `consume-item`, `destroy-entity` (herramienta y objetivo),
   `interact-entity` (requisito y objetivo) y los ingredientes de `craft-item`
   anteponen `explore … until sees` a cada `findEntities`. Si el mapa entero
   no lo tiene, el abort `no-candidates` sigue ocurriendo — pero ahora es
   verdad buscada, no ceguera de rango.

3. **La negativa cambia de voz.** «Trae X» con X fuera de la vista ya no es
   `needs_information` («No sé dónde encontrar X»): se acepta anunciando la
   búsqueda — «No veo X desde aquí: voy a recorrer el mapa para buscarlo». Si
   la búsqueda fracasa, el cierre honesto («no encuentro el objeto») ya existía.

4. **Las necesidades del cuerpo NO exploran.** `gatherAndCraftProgram` solo
   antepone la búsqueda con `searchFirst: true`, que activan los pedidos del
   cuidador. El fuego del frío sigue fallando rápido por `no-candidates`:
   esa señal es «falta el RECURSO → pedir ayuda» (ADR 0008), y vagar 50 ticks
   congelándose sería peor que preguntar. Si algún día el frío merece salir a
   buscar troncos, es una decisión aparte sobre esa señal, no un default.

## Consecuencias

- «Trae una rama» funciona aunque la rama esté en la otra punta del mapa, y
  «recorré el mapa buscando X» deja de necesitar una habilidad aprendida para
  el caso de uso más común.
- El modelo puede usar `explore`/`sees` en las habilidades que propone (la
  referencia de la DSL en los prompts lo documenta): «buscar hasta ver» deja
  de programarse como zigzags de `moveStep` frágiles ante cualquier muro.
- Los guardados viejos no cambian: son ops nuevas, ningún programa existente
  las usa y `validateSkillProgram` las admite desde ahora.
- Costo acotado: `maxSteps ≤ 50` por búsqueda, dentro del presupuesto de
  intents de siempre (300).
