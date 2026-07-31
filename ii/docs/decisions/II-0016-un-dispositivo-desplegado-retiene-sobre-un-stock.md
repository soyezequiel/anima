# II-0016 — Un dispositivo desplegado retiene sobre un stock, y la captura es estado, no geometría

**Estado:** aceptado · **Decide:** el usuario, sobre el
[Gate 5→6](../gate-5-6-objetos-emergentes.md) · **Fecha:** 2026-07-31

## El problema

El caso de aceptación pide que la criatura **deje** la trampa, **se aleje**,
**vuelva** y **retire la captura**. Nada del mundo actual hace eso, y la razón es
más profunda que «falta implementarlo»:

- **todo lo que pasa, pasa porque alguien lo pidió.** Los procesos avanzan a
  partir de una intención `apply` de un actor. Un dispositivo que trabaja mientras
  su dueña camina a otro lado no tiene quién lo pida;
- **lo que sale de un stock va a las manos o al piso.**
  `Yield.drawFromStock` admite `into: 'hands' | 'ground-adjacent'`
  (`physics/src/process.ts:75`). No hay un tercer destino;
- **`extraccion` no declara `actor`** (`physics/src/process.ts:365`): sus roles
  son `gear` y `source`. O sea que la mitad difícil no es sacar el actor de la
  ecuación — es tener dónde poner lo sacado;
- **la contención física no existe.** El `arrangement` `inside` se evalúa como
  `covering !== undefined || heldBy === actor` (`world/src/step.ts:2381`). Es una
  relación declarada, no un volumen.

La tentación es modelar la trampa como una jaula: un contenedor con aberturas por
las que un pez entra y no sale. Eso es un motor de geometría, y el propio
documento de arquitectura ya descartó `apertureArea` por ser exactamente eso.

## La decisión

**Un dispositivo desplegado es un cuerpo con estado en el mundo, asociado a un
`Stock`, que retiene lo capturado como estado autoritativo almacenado.**

Cinco piezas de estado, y las cinco entran en el hash del mundo:

| campo | qué es |
|---|---|
| **desplegado** | el cuerpo dejó de ser carga y pasó a ser dispositivo activo |
| **stock asociado** | contra qué pozo trabaja |
| **próximo intento** | cuándo vuelve a tirar, en segundos de mundo |
| **captura almacenada** | lo retenido, con su masa y su sustancia |
| **orden entre dispositivos** | canónico, para resolver la competencia sobre el mismo stock |

Y cuatro reglas:

1. **La captura NO es contención geométrica.** No hay adentro, no hay abertura,
   no hay volumen. Hay un pozo que entregó masa y un dispositivo que la tiene.
2. **Los peces no se mueven** en esta versión. El movimiento de fauna es el Hito
   16 y la primera trampa no depende de él.
3. **La física genérica la escriben humanos** (despliegue, retención, interacción
   con stocks). Ánima inventa el plano, los materiales, la construcción y el uso.
4. **Ningún nombre especial.** No puede existir un `kind`, receta, skill ni caso
   especial llamado `fish-trap`, `trampa-para-peces` ni equivalente en
   producción. Lo que existe es una affordance genérica de retención pasiva, y
   cualquier cuerpo que la cumpla la ejerce.

## Lo que se descartó, y por qué

- **Contención geométrica con aberturas.** Pide volumen, contorno y paso por
  tamaño: es el Hito 14 entero, y la primera trampa no lo necesita.
- **Peces como cuerpos con conducta.** Es el Hito 16. Poner fauna móvil antes
  ataría el caso de aceptación a un sistema que todavía no tiene ley de daño ni
  corriente.
- **Un `kind: 'trap'` con la lógica adentro.** Es `PROTECTED_KINDS` renacido, y
  el remake existe en parte para matarlo.
- **Que la trampa sea un actor que emite intenciones.** Convertiría cada objeto
  desplegado en un agente y arrastraría el presupuesto del sandbox a algo que no
  piensa. El dispositivo no decide: le llega el turno.

## Consecuencias, y todas son revalidaciones

- **Hito 2:** `WorldState`, hashes, snapshots y replay tienen que cerrar con los
  cinco campos nuevos, con **orden determinista entre dispositivos** y **consumo
  reproducible de RNG**. Y sigue valiendo sin excepción: **mirar, pensar o
  renderizar nunca consume RNG.**
- **Hito 3:** un dispositivo que saca sin actor tiene la forma exacta de una bomba
  de materia. El presupuesto calórico por chunk (riesgo 4) y la reposición del
  stock se revalidan con extracción autónoma encima, y la **competencia entre
  dispositivos sobre el mismo stock** pasa a ser un caso del banco.
- **Hito 4:** la percepción de un dispositivo sale de **datos autoritativos**, no
  de una lectura geométrica.
- **`admit()`** tiene que seguir siendo la puerta: el destino nuevo de
  `drawFromStock` pasa por ahí, o la conservación deja de cobrarse.

## Enlaces

- [Gate 5→6](../gate-5-6-objetos-emergentes.md)
- [ADR II-0013](II-0013-el-veneno-se-cobra-al-tragar.md) — la otra vez que un efecto sin dueño pedía dueño
- ADR 0026 de Ánima I — los insumos se reponen solos con tope
- ADR 0034 de Ánima I — obras por tandas y soltar a conciencia
