#!/bin/sh
set -e

# El CLI avisa (y pierde sus alias de PATH) si el CODEX_HOME todavía no existe.
if [ -n "${CODEX_HOME}" ]; then
  mkdir -p "${CODEX_HOME}"
  chmod 700 "${CODEX_HOME}"
fi

# Siembra la sesión de Codex la primera vez que arranca el contenedor.
#
# La cuenta entra por un montaje de SOLO LECTURA (`/semilla/codex`, que apunta
# al `~/.codex` de la máquina) y se copia al CODEX_HOME del volumen. La copia
# no es ceremonia: el CLI refresca su token cada tanto y reescribe `auth.json`.
# Si trabajara sobre el montaje, ese refresco —o un `logout` de cualquiera que
# entre a la web— tocaría las credenciales reales de la máquina.
#
# Se copia SOLO `auth.json`, que es lo único que significa «esta es mi cuenta».
# El `config.toml` se queda afuera a propósito: el de una máquina de trabajo
# trae servidores MCP, skills y rutas absolutas de su sistema operativo, y acá
# adentro nada de eso existe. El modelo se elige con ANIMA_CODEX_MODEL y el
# esfuerzo con ANIMA_CODEX_EFFORT; sin ellos manda el default de la cuenta.
if [ -n "${CODEX_HOME}" ] && [ ! -f "${CODEX_HOME}/auth.json" ]; then
  if [ -f /semilla/codex/auth.json ]; then
    cp /semilla/codex/auth.json "${CODEX_HOME}/auth.json"
    chmod 600 "${CODEX_HOME}/auth.json"
    echo "[anima] sesión de Codex sembrada en ${CODEX_HOME}"
  elif [ -d /semilla/codex ]; then
    echo "[anima] aviso: /semilla/codex no tiene auth.json; Codex arranca sin sesión"
  else
    echo "[anima] aviso: sin semilla montada; Codex arranca sin sesión"
  fi
fi

exec "$@"
