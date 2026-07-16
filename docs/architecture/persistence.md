# Persistencia (diseño; implementación en Fases 7-8)

## Fase 7 — local primero

Modo invitado sin backend: snapshots del mundo (`takeSnapshot` /
`serializeSnapshot`, ya implementados y probados), biblioteca de skills,
memorias consolidadas y regresiones serializados a almacenamiento local
(IndexedDB en la web; JSON en disco para la CLI). Reiniciar y continuar debe
funcionar sin cuenta.

Aquí también: informes de muerte (identidad, causa probable con certeza,
estado previo, objetivo activo, últimas acciones, skills usadas, conocimientos,
recomendaciones, mensaje a la sucesora) y modelo de generaciones/linaje. Una
sucesora lee el informe como **testimonio, no como memoria propia**: puede
confiar, dudar, probar afirmaciones y adoptar o rechazar skills (que se
re-evalúan en su propio mundo antes de promoverse).

## Fase 8 — backend + Nostr

Principios ya fijados (verificar prácticas actuales del ecosistema antes de
implementar):

- La clave privada **nunca** llega al backend; firma con extensión del
  navegador (NIP-07) o firmante remoto equivalente.
- El backend identifica por clave pública; solicitudes sensibles autenticadas
  por desafío firmado verificable.
- Las credenciales de proveedores de IA no se almacenan sin consentimiento
  explícito.
- Las skills se guardan en el backend pero **jamás se ejecutan allí**.
- SQLite en desarrollo, esquema pensado para migrar a PostgreSQL.

Entidades a almacenar: usuario (pubkey), mascotas, generaciones, apariencia,
estado de mundo, snapshots, memorias consolidadas, hipótesis, objetivos,
skills y versiones, resultados de pruebas, regresiones, informes de muerte,
relación con el usuario.

Nostr no debe bloquear el núcleo: el modo invitado local es suficiente para
demostrar todo el aprendizaje.
