# Las dos tipografías, bajadas y no pedidas

El handoff las pedía «desde Google Fonts». Acá viven en el repo, y el motivo no
es prolijidad: **el diseño usa la tipografía como canal de información**. Quién
habla se distingue por la familia y no por el color —la criatura en serif, lo
que pedís vos en monoespaciada—, así que un CDN que no contesta no degrada el
aspecto: borra una distinción. Con las fuentes acá, el juego no le pide nada a
nadie fuera de `localhost`, y los e2e no dependen de la red.

| archivo | qué es | pesos |
|---|---|---|
| `ibm-plex-mono-400.woff2` | IBM Plex Mono, redonda | 400 |
| `ibm-plex-mono-500.woff2` | IBM Plex Mono, redonda | 500 |
| `newsreader.woff2` | Newsreader, redonda — **variable** | 400–500 |
| `newsreader-italica.woff2` | Newsreader, itálica — **variable** | 400–500 |

Los `@font-face` que las declaran están en el `<style>` de `index.html`, que es
donde vive todo el CSS de esta app.

**Sólo el subconjunto `latin`**, que es el que el castellano usa entero
(acentos, `ñ`, `¿`, `¡` viven en `U+00A0–00FF`). Traer `latin-ext`, `cyrillic` y
`vietnamese` duplicaría el peso para cubrir alfabetos que esta pantalla no
escribe nunca.

**Y el peso 600 no está, aunque el handoff lo listaba.** Medido sobre el propio
prototipo del bundle: la única `font-weight` numérica que aparece en toda la
Vidriera es `500`. Bajar un archivo de 30 KB para una regla que no existe sería
versionar un binario que nadie carga.

Las dos son **SIL Open Font License 1.1** (IBM Plex Mono de IBM, Newsreader de
Production Type). La licencia permite redistribuirlas empaquetadas con software;
el texto completo está en <https://openfontlicense.org>.
