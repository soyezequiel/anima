# Alcance del MVP

El MVP demuestra **una sola historia de evolución de forma sólida**, no una
plataforma universal.

## Escenario

Mapa 2D de 9×5 con: una mascota, alimento, un árbol que produce alimento
nuevo periódicamente (regla determinista del motor), un muro que corta el
mapa, una rama (herramienta débil), un martillo (herramienta fuerte),
inventario, energía, salud, posiciones y colisiones.

Acciones primitivas iniciales: observar, hablar, esperar, moverse un paso,
recoger, soltar, consumir, usar un objeto sobre otro.

## La historia que se demuestra (implementada y probada)

1. La energía desciende (el motor la decae por tick).
2. La mascota no sabe qué significa; recibe una explicación del usuario o la
   experiencia guiada configurable.
3. Formula la hipótesis "consumir alimento recupera energía" y el objetivo
   estructurado "recuperar energía".
4. Detecta alimento tras el muro; intenta la vía directa; el mundo la bloquea.
5. El controlador de progreso registra los fallos y prohíbe repetir la
   estrategia sin cambios.
6. Define un contrato de habilidad y pide una candidata al proveedor de modelo.
7. La v1 (elige la herramienta más cercana: la rama) se evalúa en mundos
   aislados con varias semillas y **falla** donde la rama queda más cerca que
   el martillo: la rama no daña el muro.
8. El fallo se conserva como caso de regresión reproducible (escenario+semilla).
9. La v2 (elige la herramienta más poderosa) supera escenarios, semillas y
   regresiones, y se promueve a estable. La v1 queda archivada.
10. La mascota ejecuta la habilidad estable en el mundo real: rompe el muro con
    el martillo, alcanza el alimento, lo consume y recupera energía.
11. La hipótesis se confirma con evidencia y se consolida como conocimiento.
12. Ante una nueva hambre, reutiliza la habilidad **sin consultar el modelo**.
13. El usuario puede inspeccionar el historial completo (`pnpm demo`).

## Criterios de aceptación (estado)

- [x] Simulación determinista (propiedad con fast-check + hash de estado).
- [x] La mascota falla y cambia de estrategia.
- [x] Decide crear una skill cuando es necesario y evita crearla cuando no.
- [x] Una skill nueva se prueba automáticamente; una versión defectuosa se
      rechaza; el fallo se convierte en regresión; una versión mejor se promueve.
- [x] La skill aprobada funciona sin volver a consultar al modelo.
- [x] La mascota recuerda el descubrimiento y puede explicarlo brevemente.
- [x] Puede aceptar, posponer o rechazar peticiones (5 clasificaciones).
- [x] Funciona sin claves de IA.
- [x] La demo completa tiene prueba automatizada (headless).
- [x] UI sin reglas del mundo: React + Phaser consumen solo el view model de
      la sesión (`pnpm dev`).
- [x] Prueba E2E con Playwright sobre la UI (`pnpm test:e2e`): historia
      completa, chat intercalado, pausa/velocidad/dev-mode.
- [x] La mascota distingue falta de recurso de falta de capacidad: sin comida
      en el mundo pide ayuda y suspende en vez de fabricar skills inútiles;
      reactiva el objetivo cuando el entorno cambia.
- [x] Persistencia local: la sesión se autoguarda y sobrevive recargas
      (reiniciar y continuar sin cuenta).
- [x] Muerte con informe de legado y sucesión: la generación siguiente hereda
      testimonio (hipótesis, no hechos) y re-evalúa las skills heredadas.

## Fuera del MVP

Multijugador real, mercado de skills, economía, clima, ecosistemas, editor
visual, generación arbitraria de objetos, JS libre generado por IA, múltiples
proveedores, móvil, gráficos elaborados, mundo infinito.
