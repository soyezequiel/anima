# ADR 0023 — La revisión con memoria: corregir sabiendo qué se intentó

Fecha: 2026-07-16 · Estado: aceptada · Enmienda el ciclo del ADR 0003/0006

## Contexto

El ciclo cerrado de desarrollo de habilidades (contrato → candidata → pruebas →
análisis → corrección) tenía la mitad del bucle a ciegas. Una corrida real
(reporte semilla 5, tick 106) lo mostró: cuatro versiones de
`alcanzar-alimento-bloqueado`, y la v4 volvió a proponer en esencia la misma
idea que la v2 — mismo 50% de éxito, mismos fallos. El ciclo se agotó sin
converger y la mascota pidió ayuda.

No era (solo) un problema del modelo: era lo que le dábamos para corregir. La
petición `skill.revise` viajaba con tres datos — el ÚLTIMO programa, las
observaciones de fallo agregadas, y el número de intento. El revisor no conocía:

- **el objetivo** (el problema y los criterios de éxito solo viajaban en la
  propuesta inicial; la revisión corregía sin saber hacia qué),
- **dónde falló** (el 50% de éxito no decía QUÉ mundos pasaban y cuáles no:
  la diferencia entre `open-field` y `food-behind-wall` es la causa raíz, y
  estaba medida pero no se enviaba),
- **qué ya se intentó** (sin historia, repetir un enfoque fallido no tiene
  costo ni vergüenza),
- **la trayectoria** (si una revisión empeoraba, la siguiente partía de la
  versión peor: el ciclo podía degradarse en cadena).

Y dos reglas del bucle empeoraban lo anterior: una propuesta idéntica a la
inmediatamente anterior MATABA el ciclo entero (en lugar de devolverse como
feedback, como ya hacían los programas inválidos), y el crédito de 4 versiones
era poco para un ciclo que ahora sí tiene con qué corregir.

## Decisión

1. **`skill.revise` viaja con toda la evidencia.** El problema original, los
   criterios (la vara no cambia entre versiones), el contexto observado, el
   resultado mundo por mundo de la versión base (`caseResults`), la historia
   completa de versiones intentadas con su tasa de éxito y su justificación
   (`history`), y el crédito total (`maxAttempts`): administrar los intentos
   también es razonar. El prompt de Codex pide explícitamente comparar los
   mundos que pasan con los que fallan y cambiar de estrategia si la
   trayectoria se estancó.

2. **Se corrige desde la MEJOR versión, no desde la última.** El ciclo
   recuerda cada versión evaluada y elige como base la de mayor tasa de éxito
   (ante empate, la más reciente: incorporó más feedback). Una revisión que
   empeoró no se vuelve la base de nada. La vara de promoción también es la
   mejor versión: superar solo a la última permitiría promover una v3 peor que
   la v2.

3. **Repetir no es corregir, pero tampoco es morir.** Una propuesta idéntica a
   CUALQUIER versión ya probada (no solo la última) se rechaza sin gastar el
   intento y vuelve al modelo como feedback, igual que los programas
   inválidos. Solo insistir tres veces demuestra que no va a corregir y corta
   el ciclo.

4. **Más crédito: `maxVersionsPerDev` pasa de 4 a 8.** Con revisión a ciegas,
   más intentos eran más de lo mismo; con revisión informada, cada intento
   extra tiene con qué ser distinto.

5. **La versión es única y monótona por nombre.** `addExperimental` numeraba
   `padre + 1`; con ramificación desde la mejor versión, dos hijas de la misma
   base colisionaban como «v2». Ahora la versión es `max(versiones del mismo
   nombre) + 1`, y `parentVersionId` conserva el linaje real (de quién deriva),
   que ya no coincide necesariamente con la versión anterior.

## Consecuencias

- El generador sigue sin ser juez: nada de esto toca al evaluador ni a la
  puerta de validación. Cambia solo la CALIDAD de la evidencia que recibe el
  generador y la administración del crédito.
- Los proveedores deterministas (mock, scripted) no necesitan los campos
  nuevos: los ignoran. El mock conserva su arco de dos versiones (ADR 0006).
- Queda pendiente lo que este ADR no arregla: la vara mide 3 semillas fijas
  con veredicto binario, y con el crafteo variable (ADR 0020) eso lee suerte
  como capacidad. Es la brecha 2 del reporte y merece su propio cambio.
