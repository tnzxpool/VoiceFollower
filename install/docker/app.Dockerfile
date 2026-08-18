# App VoiceFollower (Express + build Vite) — nessuna GPU richiesta
FROM node:22-slim
WORKDIR /opt/voicefollower
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/server.cjs"]
