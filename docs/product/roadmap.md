# Hoja de ruta

Lo que sigue después del MVP (fases 0–9 completas, ver `mvp.md`). Nada de esto
está empezado: es el mapa de dónde crece el producto, no una promesa de orden.

## 1. Profundidad del mundo y de la criatura

Es donde el producto crece de verdad: hoy la arquitectura aguanta mucho más de
lo que el mundo ofrece.

- **Un solo escenario**: todo ocurre en `food-behind-wall` 9×5. Faltan mapas más
  grandes y más entidades con consecuencias propias (talar el árbol, ramas que
  caen, agua, refugio).
- **Más señales internas**: la spec menciona temperatura y dolor; hoy solo hay
  energía y salud. Cada señal nueva es un motivo nuevo para formular hipótesis.
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
- **Multijugador**: el diseño está en `../architecture/future-multiplayer.md` y
  la arquitectura ya lo habilita (intenciones + servidor con el mismo sim-core +
  skills como artefactos re-evaluables). No hay nada implementado.
- **Backend con tablas estructuradas (PostgreSQL)**: hoy es KV sobre
  `node:sqlite`, y alcanza hasta que existan consultas de verdad.
- **Mercado de skills, economía, móvil.**
