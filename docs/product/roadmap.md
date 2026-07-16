# Hoja de ruta

Lo que sigue después del MVP (fases 0–9 completas, ver `mvp.md`). Es el mapa
de dónde crece el producto, no una promesa de orden.

## 0. Crafteo (en curso)

El objetivo: *"construí una fogata con esos troncos"* → *"me falta algo con
qué encenderla"*, con objetos que Ánima pueda inventar sin que estén
pre-codeados. En cuatro pasos, cada uno mostrable por sí solo:

1. **Frío + árbol talable → troncos** — hecho (ADR 0015): temperatura,
   fuentes de calor, drops declarativos, causa de muerte `hypothermia`.
2. **Recetas + primitiva `craft`** — hecho (ADR 0017): recetas como dato del
   mundo, `craft` y `canCraft` en la DSL, la orden «construí una fogata» con
   su negativa por ingrediente faltante, el frío como motivo interno, y
   `temperatureIncreased`/`craftedKind` en el evaluador. Pendiente: que junte
   los ingredientes sola, y encender el frío en el mundo jugable.
3. **Arquetipos propuestos por el modelo** — Ánima compone objetos nuevos con
   componentes existentes, validados y evaluados como las skills; placeholder
   gráfico: cuadrado con el nombre (ya implementado).
4. **Comportamientos nuevos** — DSL de reglas o JS enjaulado (ADR 0014),
   solo si los componentes existentes no alcanzan.

## 1. Profundidad del mundo y de la criatura

Es donde el producto crece de verdad: hoy la arquitectura aguanta mucho más de
lo que el mundo ofrece.

- **Un solo escenario**: todo ocurre en `food-behind-wall` 9×5. Faltan mapas más
  grandes y más entidades con consecuencias propias (agua, refugio, ramas que
  caen).
- **Más señales internas**: la spec menciona temperatura y dolor; la
  temperatura ya existe en el motor (ADR 0015), falta el dolor. Cada señal
  nueva es un motivo nuevo para formular hipótesis.
- **Percepción real**: hoy es solo por rango (ver ADR 0005). Faltan línea de
  visión y memoria de lugares que ya no se ven.
- **Relación emocional**: nombre editable, preferencias, rasgos de personalidad,
  rituales, recuerdos del usuario. Hoy está lo mínimo (color y generaciones). Es
  la capa que hace que la criatura se sienta individual y no un caso de prueba.
- **Experiencia guiada más rica y perfiles emergentes** (exploradora,
  constructora…): hoy no tienen con qué expresarse, por lo chico del mundo.

## 2. Extensiones post-MVP

- **IA Dios**: traducir descripciones del usuario ("un glorb es un mineral azul
  que…") a componentes validados, con previsualización. Los componentes ya son
  datos declarativos; falta el pipeline de traducción, los esquemas y la UI.
  Para comportamientos genuinamente nuevos, JS enjaulado (ADR 0014).
- **Multijugador**: el diseño está en `../architecture/future-multiplayer.md` y
  la arquitectura ya lo habilita (intenciones + servidor con el mismo sim-core +
  skills como artefactos re-evaluables). No hay nada implementado.
- **Backend con tablas estructuradas (PostgreSQL)**: hoy es KV sobre
  `node:sqlite`, y alcanza hasta que existan consultas de verdad.
- **Mercado de skills, economía, móvil.**
