# ADR 0082 — Las referencias conservan identidad

Fecha: 2026-07-21 · Estado: aceptada

## Contexto

Ánima distinguía tipos, no individuos. «Traé el otro tronco», «ese muro» y «el
martillo que dejaste» podían terminar sobre cualquier entidad del mismo tipo.
Aunque el modelo entendiera bien la frase, el programa volvía a buscar por
`kind` y descartaba esa distinción al actuar.

## Decisión

La interpretación produce un `targetSelector` semántico: tipo, carácter
definido, referencia discursiva y relación espacial opcional. El modelo no
elige IDs.

Antes de aceptar el encargo, un resolutor determinista cruza ese selector con:

- entidades visibles y sostenidas;
- lugares recordados;
- el último individuo mencionado o manipulado;
- los individuos creados por la propia mascota.

Si hay una coincidencia inequívoca, el objetivo guarda su `targetEntityId`. Si
no existe o empata, Ánima pide precisión. La DSL admite consultar por ese ID y
todos los pasos posteriores persiguen la misma identidad; la desaparición del
objeto no autoriza sustituirlo por otro del mismo tipo.

La memoria discursiva se persiste junto con el resto del agente. El LLM se usa
en tiempo de ejecución para comprender expresiones abiertas, pero la elección
de la entidad y la verificación siguen siendo código determinista.

## Consecuencias

La solución sirve para recoger, consumir, colocar, interactuar y destruir, no
solo para una frase o un tipo de objeto. Los pedidos indefinidos («traé un
tronco») conservan la búsqueda anterior por tipo. Las referencias específicas
son más seguras: ante duda preguntan y nunca cambian de individuo en silencio.
