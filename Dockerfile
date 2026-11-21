FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json* ./
RUN npm install --include=dev --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev
ENV SECUREMARK_DATA=/data
VOLUME /data
COPY scripts/docker-entrypoint.sh /usr/local/bin/securemark-entrypoint
RUN chmod 755 /usr/local/bin/securemark-entrypoint
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/securemark-entrypoint"]
CMD ["npm", "start"]
