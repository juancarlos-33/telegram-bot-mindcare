FROM node:20-slim

WORKDIR /app

# Instalar dependencias necesarias para Prisma (OpenSSL)
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Copiar manifiestos y esquema de prisma primero para optimizar caché de capas Docker
COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependencias
RUN npm install

# Copiar el resto del código
COPY . .

# Compilar TypeScript y generar cliente Prisma
RUN npm run build

# Variables por defecto
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Comando de arranque
CMD ["npm", "start"]
