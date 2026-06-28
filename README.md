# График работы сотрудников

Веб-приложение для ведения табеля рабочего времени по цехам и отделам.

## Стек

- **Frontend:** React + Vite
- **Backend:** Python + FastAPI
- **БД:** PostgreSQL (SQLite локально)
- **Деплой:** Docker + docker-compose

## Локальный запуск

```bash
# Бэкенд
uvicorn backend.main:app --reload --port 8000

# Фронтенд (в отдельном терминале)
npm install
npm run dev
```

Прокси `/api` → `localhost:8000` настроен в `vite.config.js`.

## Продакшн (Docker)

```bash
cp .env.example .env   # заполнить переменные
docker compose up -d --build
```

Переменные окружения:

| Переменная | Описание |
|---|---|
| `POSTGRES_USER` | Пользователь PostgreSQL |
| `POSTGRES_PASSWORD` | Пароль PostgreSQL |
| `POSTGRES_DB` | Имя базы данных |
| `SECRET_KEY` | Секрет для JWT-токенов |
| `APP_PORT` | Порт приложения (по умолчанию `8000`) |
| `DOMAIN` | Публичный URL (для CORS/заголовков) |
| `LDAP_SERVER` | Адрес LDAP-сервера (опционально) |

## Структура

```
backend/
  main.py       — FastAPI, все эндпоинты
  models.py     — SQLAlchemy модели
  schemas.py    — Pydantic схемы
  excel.py      — Генерация .xlsx
  auth.py       — JWT + LDAP аутентификация
  database.py   — Подключение к БД

src/
  App.jsx       — Главный компонент
  api.js        — HTTP-клиент
  components/   — Компоненты (таблица, редакторы, модалки)
```

## Документация

Подробное руководство пользователя: [USER_MANUAL.md](USER_MANUAL.md)  
Инструкция по деплою: [DEPLOY.md](DEPLOY.md)
