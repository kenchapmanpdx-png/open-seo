# K3 render sidecar. Build context = repo root:
#   docker compose -f fork/sidecar/compose.yaml up -d --build
FROM mcr.microsoft.com/playwright:v1.59.1-noble
WORKDIR /app
COPY fork/sidecar/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund
COPY src/server/features/handbook/contracts/sidecar.ts src/server/features/handbook/contracts/version.ts ./src/server/features/handbook/contracts/
COPY fork/sidecar/server.ts fork/sidecar/render.ts fork/sidecar/axe.ts fork/sidecar/lighthouse.ts ./fork/sidecar/
USER pwuser
ENV HANDBOOK_SIDECAR_HOST=0.0.0.0
EXPOSE 4777
CMD ["npx", "tsx", "fork/sidecar/server.ts"]
