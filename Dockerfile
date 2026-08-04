# syntax=docker/dockerfile:1

# Ánima I, empaquetada en un solo proceso.
#
# En desarrollo son dos: Vite sirve la web en 5173 y le proxea `/api` a la API
# en 8787. Acá no hay proxy que valga: la API sirve también la web construida,
# así que comparten origen y el cliente no cambia una línea (el prefijo `/api`
# lo resuelve el servidor, ver `stripApiPrefix`).
#
# Lo que hace especial a esta imagen es que el CLI de Codex viaja adentro: el
# puente de IA no habla con ninguna API de OpenAI, lanza `codex` como
# subproceso. Sin el CLI en el PATH del contenedor no hay mente real. Las
# credenciales NO se hornean: entran en ejecución, por volumen.

# ---- construcción -----------------------------------------------------------
FROM node:24-bookworm-slim AS build

# git: dos dependencias de la web se instalan desde GitHub y corren su build.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable

WORKDIR /app
COPY . .

# El workspace entero, porque el lockfile lo exige entero; de todo esto la
# imagen final se queda con tres cosas.
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @anima/web build

# Ánima II, colgada de `/v2`. Las dos variables no son opcionales acá: sin
# `ANIMA_BASE` el juego pide sus assets a la raíz —y se los contesta Ánima I—,
# y sin `VITE_DEPOSITO` le pide los dibujos al `localhost` del visitante.
RUN ANIMA_BASE=/v2/ VITE_DEPOSITO=/v2/deposito pnpm --filter @anima/juego build

# El servidor se lleva sus dependencias resueltas y planas (`--legacy` porque
# este workspace no inyecta paquetes). `--prod=false` conserva tsx: el servidor
# corre TypeScript directo, igual que `pnpm start`.
RUN pnpm --filter @anima/api deploy --legacy --prod=false /paquete

# ---- ejecución --------------------------------------------------------------
FROM node:24-bookworm-slim AS runtime

# Fijada a propósito: el puente está verificado contra esta versión del CLI y
# el protocolo del app-server que usa es experimental.
ARG CODEX_CLI_VERSION=0.144.5

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g "@openai/codex@${CODEX_CLI_VERSION}" \
    && npm cache clean --force

WORKDIR /srv/api
COPY --from=build /paquete ./
COPY --from=build /app/apps/web/dist /srv/web
COPY --from=build /app/ii/apps/juego/dist /srv/v2
COPY docker/entrypoint.sh /usr/local/bin/anima-entrypoint
RUN chmod +x /usr/local/bin/anima-entrypoint

# Rutas absolutas: así el proceso no depende de dónde lo arranquen.
# `/datos` es el único directorio con estado — montale un volumen.
ENV NODE_ENV=production \
    PORT=8787 \
    ANIMA_HOST=0.0.0.0 \
    ANIMA_WEB_DIR=/srv/web \
    ANIMA_V2_DIR=/srv/v2 \
    ANIMA_DB=/datos/anima.sqlite \
    ANIMA_CODEX_DIR=/datos/codex \
    CODEX_HOME=/datos/codex-home

EXPOSE 8787
VOLUME ["/datos"]

ENTRYPOINT ["anima-entrypoint"]
CMD ["node", "/srv/api/node_modules/tsx/dist/cli.mjs", "/srv/api/src/main.ts"]
