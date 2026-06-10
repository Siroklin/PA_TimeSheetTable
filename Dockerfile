# --- Stage 1: build React frontend ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html eslint.config.js vite.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

# --- Stage 2: production image ---
FROM python:3.11-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend ./backend
COPY --from=frontend-builder /app/dist ./dist

EXPOSE 8000
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
