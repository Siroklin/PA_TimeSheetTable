# Развёртывание на сервере (Docker)

## 1. Установка Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

Перелогиньтесь (или `newgrp docker`), чтобы команда `docker` работала без `sudo`.

Проверка:
```bash
docker --version
docker compose version
```

## 2. Получение кода

```bash
git clone https://github.com/Siroklin/PA_TimeSheetTable.git
cd PA_TimeSheetTable
```

(или `git pull`, если репозиторий уже склонирован)

## 3. Настройка переменных окружения

```bash
cp .env.example .env
nano .env
```

Обязательно смените `POSTGRES_PASSWORD` на свой пароль.
`APP_PORT` — порт, на котором приложение будет доступно (по умолчанию 8000).

## 4. Сборка и запуск

```bash
docker compose up -d --build
```

Первый запуск соберёт фронтенд и образ бэкенда — это может занять пару минут.

Приложение будет доступно по адресу: `http://<ip-сервера>:<APP_PORT>`

## 5. Проверка

```bash
docker compose ps
docker compose logs -f app
```

## Обновление приложения

```bash
git pull
docker compose up -d --build
```

База данных при этом не пересоздаётся — данные хранятся в Docker-volume `db_data`.

## Бэкап базы данных

```bash
docker compose exec db pg_dump -U schedule schedule > backup_$(date +%F).sql
```

Восстановление:
```bash
cat backup_2026-06-10.sql | docker compose exec -T db psql -U schedule schedule
```

## Доступ по домену с HTTPS (опционально)

Если появится домен, проще всего поставить **nginx + certbot** перед приложением:

```bash
sudo apt install nginx certbot python3-certbot-nginx
```

Конфиг nginx (`/etc/nginx/sites-available/schedule`):
```nginx
server {
    listen 80;
    server_name your-domain.example;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/schedule /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d your-domain.example
```
