# II-0017 — El descriptor visual es una vista derivada, no física, y nunca inventa lo que la física no modela

**Estado:** aceptado · **Decide:** el usuario, sobre el
[Gate 5→6](../gate-5-6-objetos-emergentes.md) · **Fecha:** 2026-07-31

## El problema

Con objetos emergentes, **la mayoría de lo que hay en el mapa no va a tener
sprite**. Un plano que la criatura inventó ayer no tiene arte, no tiene ícono y no
tiene nombre canónico. Y la UI (Hito 12) tiene como requisito que **los cuerpos,
objetos, obras y dispositivos del área visible aparezcan en el mapa**.

Las dos salidas fáciles rompen cosas distintas:

- **dibujar lo que no se sabe** —inventarle una forma, una orientación, una
  abertura— hace que la pantalla afirme geometría que la física no tiene, y
  entonces el jugador ve una jaula donde el mundo tiene un estado;
- **no dibujar hasta tener arte** deja el mapa vacío justo donde está lo que la
  criatura inventó, que es todo el producto.

Hay un tercer problema, que es el que decide la forma del tipo: **si el
descriptor entra en el hash junto con textos, nombres y cosmética, dos clientes
con distinto idioma dejan de coincidir** y el E2E no puede comparar nada.

## La decisión

**El descriptor visual es una vista DERIVADA del estado, determinista, y separada
de la física.**

Se deriva de, y de nada más:

```
forma · materiales · partes · juntas · progreso · estado desplegado · captura almacenada
```

Y cumple:

```
mismo snapshot + misma versión del descriptor + mismos datos estructurales
    → mismo renderDescriptorHash
```

**Quedan FUERA del hash**, sin excepción: textos localizados, nombres narrativos,
skins, íconos generados, raster, hover, selección, animaciones y cosmética.

Tres reglas más:

1. **La representación inicial es procedural y esquemática.** No hace falta arte
   para que un objeto exista en el mapa.
2. **El fallback es obligatorio.** Todo objeto tiene descriptor, siempre. Un
   objeto sin sprite específico se dibuja igual.
3. **No inventa** posiciones internas, orientaciones, aberturas ni contención que
   la física no modele. Lo que no está en el estado no se dibuja.

**Las skins con IA quedan post-1.0 y nunca pueden bloquear el render.**

## Lo que se descartó, y por qué

- **Descriptor calculado por el renderer, sin hash.** Barato, y deja el E2E sin
  árbitro: no habría forma de afirmar que dos corridas dibujan lo mismo.
- **Meter el nombre en el hash.** El nombre es narrativo y localizable; entrarlo
  haría que cambiar una traducción rompiera una comparación de determinismo.
- **Que el descriptor lea la física directamente en el frame.** Lo prohíbe la
  regla de arriba: **renderizar nunca consume RNG** ni le quita un tick al
  cuerpo. Es el ADR 0063 de Ánima I dado vuelta a propósito —el glifo procedural
  sale en el acto, la glosa bonita es cola de prioridad cero— y esta decisión lo
  extiende a objetos que nadie diseñó.

## Consecuencias

- **Hito 12A** produce el view model con `renderDescriptorHash` y fallback
  procedural.
- **Hito 12C** muestra los siete casos del objeto emergente (sin sprite, obra
  incompleta, terminado, desplegado, con captura, catálogo, y la misma
  representación coherente en mapa, inventario y catálogo).
- **El E2E** compara `worldHash`, `registryDigest` y `renderDescriptorHash`: tres
  hashes, tres capas, y ninguno tapa al otro.
- **El gate** exige el descriptor (punto 11) aunque la UI no exista todavía: es
  dato derivado del estado, y se puede afirmar sin dibujar un píxel.

## Enlaces

- [Gate 5→6](../gate-5-6-objetos-emergentes.md)
- ADR 0063 de Ánima I — dibujar lo que tiene delante (`revertido`: el orden se da vuelta)
- ADR 0056 de Ánima I — el catálogo de sus obras
