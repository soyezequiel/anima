# Hito 0 — Arranque en el navegador: la fragua entra

La última pieza del Hito 0. El banco de typecheck ya había medido 240 ms en frío
y 30 ms tibio, **pero en Node, con `typescript` en disco**. El documento pone la
fragua adentro del navegador, y ahí hay que bajarlo.

```bash
pnpm ii:navegador
```

Levanta el banco en <http://localhost:5180>. Mide solo: no hay que tocar nada.

## Qué se buscaba, que no es velocidad

**Que el toolchain se pueda diferir.** La página tiene que estar viva y jugable
antes de que TypeScript termine de cargar, porque el requisito número uno es que
Ánima no haga esperar. Un toolchain de un mega que carga en segundo plano es
perfectamente aceptable; uno de cien kilobytes en el camino del primer cuadro,
no.

Lo que **sí** está en el camino del usuario es el typecheck de cada candidata,
con la criatura esperando para actuar. Ése es el número que se vigila, y el
presupuesto del documento es 90 ms p50 / 250 ms p95.

## Los números

| Etapa | Caché fría | Caché tibia |
|---|---|---|
| importar `typescript` | 306 ms | 19–171 ms |
| bajar 57 `lib.d.ts` en paralelo | 44 ms | 36–61 ms |
| bajar `skill-api.d.ts` | 2 ms | 1 ms |
| crear el `LanguageService` | 0 ms | 0 ms |
| **typecheck en frío** (primera habilidad) | **193 ms** | 138–140 ms |
| **typecheck tibio** (mediana de 12 seguidas) | **8 ms** | **6 ms** |
| **arranque total** | **651 ms** | 295–427 ms |

Y el peso, que es lo que decide si esto es viable:

| | Sin comprimir | Con gzip |
|---|---|---|
| `typescript` minificado | 3.59 MB | **1.03 MB** |
| las 71 `lib.d.ts` | 519 KB | **93 KB** |
| **total a bajar** | | **~1.1 MB** |

**Ojo con el número que informa el navegador en modo dev: 9.7 MB.** Ése es vite
sirviendo módulos sin minificar ni comprimir. El de producción es 1.03 MB, casi
diez veces menos, y está medido con `vite build` aparte. Poner el número de dev
sin aclararlo asusta por nada, que es la otra forma de mentir con una medición.

## Veredicto: entra, y con margen

**El typecheck tibio en el navegador sale 6–8 ms contra un presupuesto de
250 ms.** Treinta veces de margen.

Y el arranque —entre 300 y 650 ms según la caché— **no está en el camino del
primer cuadro**: el `import()` de `typescript` es dinámico, así que el mundo
puede estar corriendo a 30 Hz mientras el toolchain baja de fondo. La fragua
recién se necesita la primera vez que a la criatura le falta una habilidad, y
para entonces hace rato que cargó.

La habilidad de prueba —un generador que busca lo que más alimenta, va y lo
agarra— **typechequeó con cero errores contra `skill-api.d.ts`**, o sea que la
superficie del pase 3 funciona también del lado del navegador.

## Una honestidad sobre el 6 ms

**No es comparable de frente con los 30 ms del banco de Node.** El host del
navegador sirve un conjunto mínimo de archivos —`skill-api.d.ts` y la candidata,
con `skipLibCheck`— mientras que el de Node levantaba el `tsconfig` real del
paquete con todo lo que arrastra.

Lo que la comparación **sí** permite decir es que el navegador no introduce un
costo de otro orden: está en la misma decena de milisegundos, no en cientos. Y
eso alcanza para la decisión que el Hito 0 tenía que tomar.

## Lo que queda por vigilar

- **El presupuesto de 250 ms es por candidata**, y la fragua manda K=2 por
  viaje. Con dos candidatas son 12–16 ms, que siguen siendo nada.
- **La medición es en un desktop.** En un teléfono el parseo de 1 MB de JS y el
  typecheck van a costar bastante más. Hay que rehacerla ahí antes de prometerle
  a nadie que anda en el celular.
- **1.1 MB es real y hay que pagarlo alguna vez.** No está en el camino del
  primer cuadro, pero sí en el del primer aprendizaje. Si algún día molesta, la
  salida es mover la fragua al backend —que ya existe, es `apps/api`— y dejar en
  el navegador solo la ejecución.

## Hito 0, cerrado

| Pieza | Criterio | Medido | |
|---|---|---|---|
| [typecheck](hito-0-banco-de-latencia.md) | < 3000 ms en frío | 240 ms | ✔ |
| [barrido térmico](hito-0-barrido-termico.md) | ventana para 10 sustancias | 12/12 | ✔ |
| [combustible](hito-0-combustible.md) | ≤ 2% del tick ([II-0005](decisions/II-0005-el-presupuesto-se-mide-contra-el-tick.md)) | 0.40% | ✔ |
| **arranque en el navegador** | typecheck tibio ≤ 250 ms | **6 ms** | ✔ |

**Las cuatro piezas medidas. Ninguna mató el plan.** Una lo obligó a cambiar de
regla y otra encontró una degeneración en la física, que es exactamente para lo
que el hito existía: enterarse antes de construir encima.
