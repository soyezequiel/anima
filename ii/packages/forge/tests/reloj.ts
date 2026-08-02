// ─── LA SEPARACIÓN QUE EL HITO 11 PIDE, EN TRES LÍNEAS ───────────────────────
//
// > Y una separación que no se negocia: **CI determinista, benchmark real y E2E
// > de navegador corren aparte**. Mezclarlos es cómo un banco de 500 s termina
// > adentro de la suite compartida y nadie la corre más — ya pasó dos veces en
// > este proyecto.
//
// Ésta es la tercera, y está en el árbol: `el-episodio.test.ts` afirma
// `perdidosPorLaFragua === 0` contra el **reloj de pared**, así que pasa 6 de 6
// corriendo solo y falla cuando vitest corre los 13 archivos del paquete en
// paralelo. No falla porque el código esté mal: falla porque la máquina estaba
// ocupada.
//
// ─── POR QUÉ ESO ES PEOR DE LO QUE PARECE ───────────────────────────────────
//
// Un test que a veces falla sin motivo **entrena a todo el mundo a re-correr y
// seguir**. Y a partir de ahí ningún guardián protege nada: el día que uno falle
// de verdad, también lo van a volver a correr. Por eso el punto 4 va antes que
// las cien partidas del 5.
//
// ─── POR QUÉ UN FLAG NUEVO Y NO `ANIMA_BANCO` ───────────────────────────────
//
// Porque son dos cosas distintas y el plan las nombra por separado. `ANIMA_BANCO`
// dice **«esto sale caro»** —20 semillas, 311 s— y `ANIMA_RELOJ` dice **«esto
// mide contra el reloj de pared»**. Se superponen mucho y no son lo mismo: el
// episodio de la fragua tarda 8 segundos, o sea que es barato, y aun así su
// número no se puede afirmar en una máquina cargada.
//
// Conflatirlos haría que apagar el caro apague también al del reloj, y que quien
// quiera medir el reloj tenga que pagar los 311 s del banco.
//
//     ANIMA_RELOJ=1 pnpm --filter @anima/forge test    mide contra el reloj
//     pnpm ii:test                                     la suite determinista
//
// El env var va en la línea de comando y no en un script de `package.json`, que
// es la convención que `ANIMA_BANCO` ya usa en este repo: ningún script del
// árbol lleva prefijo de entorno, porque un `VAR=1 cmd` no corre en `cmd.exe`.
//
// ─── Y LO QUE NO SE HACE, DICHO ─────────────────────────────────────────────
//
// **El número no se afloja: se muda.** En la suite determinista el valor se
// SIGUE IMPRIMIENDO y lo que se afirma es lo estructural —que el mundo corrió,
// que la fragua forjó— que es cierto con la máquina cargada o libre. El `=== 0`
// se afirma donde se puede afirmar.

/** ¿Estamos midiendo contra el reloj de pared? `ANIMA_RELOJ=1` lo enciende. */
export const CONTRA_EL_RELOJ = process.env['ANIMA_RELOJ'] === '1'

/**
 * Lo que se imprime cuando el número no se afirma, para que el cero no sea mudo.
 *
 * Sin esta línea, alguien que lea la salida de la suite determinista no tiene
 * cómo saber que el número existe y que se mide en otro lado.
 */
export const NO_SE_AFIRMA = '(no se afirma acá: mide contra el reloj de pared · ANIMA_RELOJ=1)'
