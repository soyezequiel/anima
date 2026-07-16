# ADR 0013 — El modelo real interpreta el chat; el parser es el fallback

Fecha: 2026-07-16 · Estado: aceptada · Reemplaza el orden fijado en la Fase 5

## Contexto

`parseUserMessage` (regex) nació en la Fase 5, cuando era el único intérprete
posible: no había modelo. Conservó prioridad absoluta incluso después de que
la Fase 9 añadiera `interpret.command`, un intérprete de verdad. Una sonda
sobre frases realistas encontró que su cobertura por regex es demasiado frágil
para tener la primera palabra:

- `\b(espera|esperar|quedate|para)\b` no distingue el verbo "para" (detente)
  de la preposición "para" (finalidad). *"¿el martillo sirve para algo?"* →
  `wait-here` → **"Puedo esperar aquí un momento."**, con Codex conectado.
- `/energ/ + /(com|aliment|...)/` marcaba como `explanation` cualquier frase
  con ambas palabras, sin importar que fuera una pregunta. *"¿por qué la
  comida te da energía?"* → **"Gracias, eso me ayuda a entender qué me pasa."**
  y, peor, activaba `pendingExplanation` y reactivaba objetivos suspendidos
  como si le hubieran enseñado algo.

## Decisión

`ModelProvider.interpretsLanguage` declara si un proveedor entiende lenguaje
natural (`true` solo en Codex; el mock y el scripted son deterministas).

- **Con `interpretsLanguage`**: el modelo interpreta **todos** los mensajes.
  El parser no corre primero.
- **Sin él**: manda el parser, exactamente como antes (el mock conserva su
  comportamiento y sus pruebas).
- **Red de seguridad**: si el modelo falla, se intenta el parser; si reconoce
  una orden clara la mascota obedece igual y `provider.error` lleva
  `recoveredWith: 'parser'`. Solo si ambos fallan, el error llega al usuario.

Se añadió la acción **`explanation`** al catálogo de `CommandInterpretation`:
sin ella, invertir la prioridad habría roto la experiencia guiada (una
lección del usuario dejaría de reactivar objetivos). El modelo distingue
"comer alimento te da energía" (lección) de "¿por qué la comida te da
energía?" (pregunta) mucho mejor que una regex.

Lo que **no** cambia: el modelo solo traduce texto a una intención del
catálogo cerrado; jamás decide si obedecer. La clasificación
(`accepted/cannot/will_not/not_now/needs_information`) y la respuesta siguen
saliendo de `evaluateUserRequest`, código determinista.

## Consecuencias

- **Costo/latencia**: con Codex, cada mensaje del usuario cuesta ahora una
  llamada `interpret.command` (antes las órdenes reconocidas por regex eran
  gratis). Es el precio aceptado por entender lenguaje de verdad; la
  simulación sigue sin consultar al modelo por tick.
- El parser deja de ser una fuente de verdad y pasa a ser una heurística de
  respaldo: sus regex ya no necesitan crecer para cubrir más lenguaje.

Verificado con la cuenta real:

> **¿el martillo sirve para algo?** → *"Sí, quizá sirva para golpear o
> construir, pero aún no sé exactamente cómo usarlo."*
> **¿por qué la comida te da energía?** → *"Porque mi cuerpo transforma la
> comida en energía; ahora solo tengo 15 de 50."*
> **comer alimento te devuelve la energía** → *"Gracias, eso me ayuda a
> entender qué me pasa."* (lección, reactiva objetivos)
> **da un pasito hacia la derecha, porfa** → *"Voy a la derecha."* (orden que
> el parser no reconocía)
