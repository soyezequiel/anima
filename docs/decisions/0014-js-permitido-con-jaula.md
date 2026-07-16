# ADR 0014 — Se permite JS generado por IA (con jaula), cambio de spec

Fecha: 2026-07-16 · Estado: aceptada · Modifica la spec original

## Contexto

La spec original prohibía "JS libre generado por IA": todo comportamiento
nuevo debía expresarse en DSLs cerradas (skills hoy; reglas de mundo mañana).
La prohibición protegía tres cosas: el determinismo de la simulación, la
seguridad (código arbitrario ejecutándose en el navegador/servidor) y la
evaluabilidad (el evaluador puede razonar sobre una DSL, no sobre JS
arbitrario).

Al diseñar el crafteo de objetos no pre-codeados (una fogata que Ánima
inventa), apareció el límite real de las DSLs: un componente que ningún
sistema del motor lee es inerte. Los *arquetipos* (qué componentes tiene un
objeto) son datos y no necesitan JS; los *comportamientos* nuevos (que el
fuego se propague, que el agua apague) sí necesitan código en alguna parte.

## Decisión

El dueño del proyecto decidió permitir JS generado por IA. La spec cambia:
"JS libre generado por IA" deja de estar en la lista de exclusiones
permanentes y pasa a ser una capacidad futura **con jaula**. Las condiciones
no son negociables, porque protegen invariantes de los que depende todo lo
demás (evaluador, regresiones, snapshots, multijugador futuro):

1. **Determinismo**: el código generado no puede acceder a `Date`, `Math.random`,
   red, DOM ni estado fuera del mundo. Mismo estado + misma semilla ⇒ mismo
   resultado, siempre. Sin esto, las regresiones y los snapshots mueren.
2. **Sandbox**: se ejecuta en un intérprete aislado con presupuesto de pasos
   (mismo espíritu que los budgets de la DSL de skills), nunca con `eval`
   ni `Function` sobre el contexto real.
3. **Contrato estrecho**: recibe una vista del mundo y devuelve efectos
   declarativos que el motor valida y aplica — el mismo principio de siempre:
   el mundo decide las consecuencias, el código solo las propone.
4. **Evaluación previa**: como las skills, un comportamiento generado se
   prueba en mundos aislados antes de tocar el mundo real.

## Orden de preferencia (sigue vigente)

Que el JS esté permitido no lo vuelve la primera opción:

1. Componentes existentes combinados (arquetipos como datos) — gratis.
2. DSL de reglas cerrada, si el patrón se repite — barata de evaluar.
3. JS enjaulado — solo cuando lo anterior no alcanza.

## Consecuencias

- El pipeline de "IA Dios" (roadmap) puede prometer objetos con
  comportamientos genuinamente nuevos, no solo recombinaciones.
- Hay que elegir/construir el intérprete aislado antes de la primera línea
  generada. Candidatos a estudiar cuando llegue: intérprete JS embebido con
  presupuestos (tipo QuickJS-wasm o un mini-intérprete propio sobre AST).
- La representación gráfica de objetos nuevos usa mientras tanto un
  placeholder: un cuadrado con el nombre del objeto (ya implementado en la
  escena Phaser). El arte definitivo es un problema aparte y posterior.
