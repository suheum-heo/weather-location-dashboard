# Weather & Location Dashboard

A full-stack demo app that lets you search a city and see:
- Current weather (OpenWeather)
- Air quality (OpenWeather AQI)
- Local news headlines (Google News RSS)
- Recent searches + Favorites (persistent via Postgres)
- City disambiguation via geocoding + static map preview

## Live Demo
- Frontend (Vercel): https://weather-location-dashboard.vercel.app
- Backend (Render): https://weather-location-dashboard.onrender.com

> Note: The Render free tier may “sleep” when inactive. The first request can take a bit longer to respond.

## Features
- 🔎 City search (weather + AQI + news)
- ⭐ Favorites (toggle on/off)
- 🕘 Recent vs Favorites separated in UI
- 🗺️ Geocode disambiguation (e.g., Madison, WI vs other Madisons)
- 🧭 Static map snapshot for the selected coordinates
- 🎛️ Dark mode + polished UI + smooth accordion sections

## Tech Stack
**Frontend**
- React + TypeScript (Vite)

**Backend**
- Node + Express + TypeScript
- Prisma ORM

**Database**
- Postgres (Render)

## Local Development

### 1) Backend
```bash
cd backend
npm install
```
Create backend/.env
OPENWEATHER_API_KEY=your_openweather_key
DATABASE_URL=your_database_url
