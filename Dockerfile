# Railway 배포용. mcr.microsoft.com/playwright 태그는 package.json의 playwright 버전(1.57.0)과
# 정확히 맞춰야 함 — 버전이 어긋나면 브라우저 바이너리와 드라이버가 안 맞아 크롤러가 깨짐.
FROM mcr.microsoft.com/playwright:v1.57.0-noble

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.29.2 --activate
RUN npm install -g pm2

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY dashboard/package.json dashboard/pnpm-lock.yaml ./dashboard/
RUN pnpm --dir dashboard install --frozen-lockfile

COPY . .

RUN pnpm build
RUN pnpm --dir dashboard build

ENV NODE_ENV=production

CMD ["pm2-runtime", "start", "ecosystem.railway.config.cjs"]
