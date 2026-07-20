import { describe, expect, it } from 'vitest';
import { chatStamp, clockTime } from '../src/components/clock.js';
import type { ChatEntry } from '../src/session/view.js';

function entry(over: Partial<ChatEntry> = {}): ChatEntry {
  return { from: 'pet', text: 'hola', tick: 19, ...over };
}

describe('la hora de un mensaje del chat', () => {
  it('muestra hora y minuto en 24 horas, sin segundos ni «p. m.»', () => {
    const at = new Date(2026, 6, 20, 14, 32, 45).getTime();
    // El reloj de 12 daría «02:32 p. m.»: tres veces más ancho para una
    // etiqueta que va debajo de cada burbuja.
    expect(clockTime(at)).toBe('14:32');
  });

  it('usa la hora sellada al decirlo, no la de ahora', () => {
    const at = new Date(2026, 0, 2, 9, 5).getTime();
    expect(chatStamp(entry({ at })).text).toBe(clockTime(at));
  });

  it('cae al tick en los guardados viejos, que no tienen hora', () => {
    // Rellenarlos con `Date.now()` fecharía hoy una charla de anteayer: es
    // preferible decir lo único que ese mensaje sabe de sí mismo.
    const stamp = chatStamp(entry({ tick: 162 }));
    expect(stamp.text).toBe('t162');
    expect(stamp.title).toContain('sin hora registrada');
  });

  it('conserva el tick en el title, que es con lo que se cruza contra Ensayos', () => {
    const stamp = chatStamp(entry({ at: Date.now(), tick: 19 }));
    expect(stamp.title).toContain('tick 19');
  });
});
