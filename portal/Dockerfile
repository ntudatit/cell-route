FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ARG VITE_API_URL=/api
ARG VITE_CKB_NETWORK=testnet
ARG VITE_FIBER_NETWORK=testnet
ARG VITE_FIBER_CONFIG_PATH=/fiber-config/testnet.yml
ARG VITE_FIBER_EXPECTED_VERSION=0.9.0
ARG VITE_FIBER_DATABASE_PREFIX=fiberpay:testnet:browser-node-v1
ENV VITE_API_URL=$VITE_API_URL \
    VITE_CKB_NETWORK=$VITE_CKB_NETWORK \
    VITE_FIBER_NETWORK=$VITE_FIBER_NETWORK \
    VITE_FIBER_CONFIG_PATH=$VITE_FIBER_CONFIG_PATH \
    VITE_FIBER_EXPECTED_VERSION=$VITE_FIBER_EXPECTED_VERSION \
    VITE_FIBER_DATABASE_PREFIX=$VITE_FIBER_DATABASE_PREFIX
RUN npm run build

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
