# Build stage
FROM node:20-alpine AS builder

# Instalar dependencias necesarias para canvas
RUN apk add --no-cache \
    python3 \
    py3-pip \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar todas las dependencias
RUN npm ci

# Copiar todo el código fuente
COPY . .

# Build del frontend
RUN npm run build

# Production stage
FROM node:20-alpine

# Instalar dependencias de runtime para canvas
RUN apk add --no-cache \
    python3 \
    py3-pip \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev \
    cairo \
    jpeg \
    pango \
    giflib \
    pixman

WORKDIR /app

# Instalar PM2 globalmente (opcional)
RUN npm install -g pm2

# Copiar package.json
COPY package*.json ./

# Instalar solo dependencias de producción
RUN npm ci --omit=dev

# Copiar el código del servidor
COPY server ./server

# Copiar archivos de configuración
COPY ecosystem.config.js ./

# Copiar el build del frontend
COPY --from=builder /app/dist ./dist

# Crear directorios necesarios
RUN mkdir -p uploads/payment-proofs logs

# Exponer el puerto
EXPOSE 3001

# Ejecutar directamente con Node (sin PM2 por ahora)
CMD ["node", "server/server.js"]