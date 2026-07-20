import type { ChatEntry } from '../session/view.js';

/**
 * Cuándo se dijo un mensaje, para la etiqueta chica que va debajo.
 *
 * El chat mostraba el tick del mundo («t19»), que es el reloj de la partida y
 * no el del cuidador: entre dos mensajes puede haber una pausa de tres días o
 * diez minutos a velocidad 8, y el número es el mismo. Para saber si algo
 * acaba de pasar hace falta la hora de verdad.
 *
 * El tick no se pierde: sigue en el `title`, que es donde sirve —para cruzar
 * un mensaje con lo que muestran Ensayos o el registro técnico, que sí hablan
 * en ticks—.
 */

/**
 * «14:32». Sin segundos —un chat no es un cronómetro— y en 24 horas.
 *
 * El reloj de 12 sale «02:32 p. m.»: el triple de ancho para una etiqueta que
 * vive debajo de cada burbuja, y con un sufijo que en castellano nadie usa al
 * decir la hora. Se fija acá y no se deja al locale del navegador, que en esta
 * misma máquina ya devuelve las dos formas según cómo esté configurado.
 */
export function clockTime(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Qué escribir al pie de un mensaje. Los guardados anteriores a la hora no la
 * tienen, y ahí se dice el tick: es lo que ese mensaje realmente sabe de sí
 * mismo. Inventarle una hora sería fechar hoy algo dicho anteayer.
 */
export function chatStamp(entry: ChatEntry): { text: string; title: string } {
  if (entry.at === undefined) {
    return { text: `t${entry.tick}`, title: `tick ${entry.tick} · sin hora registrada` };
  }
  return {
    text: clockTime(entry.at),
    title: `${new Date(entry.at).toLocaleString()} · tick ${entry.tick}`,
  };
}
