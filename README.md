# Weather & Location Dashboard

A full-stack web app that lets users search cities and view:
- Current weather conditions
- Air quality index (AQI)
- Local news headlines
- Recently searched cities
- Favorite (⭐) cities
- Static map to confirm exact geolocation used for weather data

The app also handles city disambiguation (e.g., *Madison, WI vs other Madisons*).

---

## Live Demo

- **Frontend (Vercel)**  
  https://weather-location-dashboard.vercel.app
  
- **Backend (Render)**  
  https://weather-location-dashboard.onrender.com

> ⚠️ **Note:** Render free tier may sleep when inactive. The first request can take ~10–30 seconds to wake up.

---

## Features

- 🔍 **City search** with OpenWeather Geocoding API
- 🌫️ **Air quality index** with color-coded indicators
- 📰 **Local news** via Google News RSS feeds
- ⭐ **Favorite cities** with persistent storage
- 🕘 **Recent searches** separated from favorites
- 🗺️ **Static map preview** showing selected coordinates
- 🌗 **Dark mode** support
- 🎞️ **Smooth accordion animations** for city details
- 📍 **Geocode-based disambiguation** for common city names

---

## Tech Stack

### Frontend
- React + TypeScript
- Vite
- Tailwind CSS (or your styling solution)

### Backend
- Node.js
- Express
- TypeScript
- Prisma ORM

### Database
- PostgreSQL (hosted on Render)

---

## Local Development

### 1️⃣ Backend Setup
```bash
cd backend
npm install
```

Create `backend/.env`:
```env
OPENWEATHER_API_KEY=your_openweather_key
DATABASE_URL=your_postgresql_database_url
```

Initialize the database:
```bash
npx prisma migrate dev
npx prisma generate
```

Run the backend:
```bash
npm run dev
```

Backend runs at: **http://localhost:4000**

---

### 2️⃣ Frontend Setup
```bash
cd frontend
npm install
```

Create `frontend/.env.local`:
```env
VITE_API_BASE=http://localhost:4000
VITE_GEOAPIFY_KEY=your_geoapify_key
```

Run the frontend:
```bash
npm run dev
```

Frontend runs at: **http://localhost:5173**

---

## Deployment

### Frontend
- Deployed on **Vercel**
- Auto-deploys from main branch
- Environment variables configured in Vercel dashboard

### Backend
- Deployed on **Render**
- Connected to PostgreSQL database (also on Render)
- Environment variables configured in Render dashboard

### Database
- PostgreSQL hosted on **Render**
- Automatically managed by Prisma migrations

---

## API Keys Required

| Service | Purpose | Get API Key |
|---------|---------|-------------|
| OpenWeather | Weather data & geocoding | https://openweathermap.org/api |
| Geoapify | Static map images | https://www.geoapify.com/ |

---

## CORS Configuration

Backend allows requests from:
- `https://weather-location-dashboard.vercel.app` (production)
- `http://localhost:5173` (local development)
- `http://localhost:3000` (alternative local port)

---

## Known Limitations

- ⏱️ Render free-tier may cause cold starts (~10-30s delay)
- 🗄️ Free PostgreSQL database has storage limits
- 🗺️ Static map requires Geoapify API key
- 📰 News results depend on Google News RSS availability

---

## Possible Improvements

- 🔽 **Autocomplete dropdown** for ambiguous city names
- 💀 **Skeleton loaders** for better perceived performance
- 💾 **API response caching** to reduce external API calls
- 👤 **User accounts / authentication** for personalized favorites
- 🗺️ **Interactive maps** (Leaflet / Mapbox integration)
- 📊 **Weather charts** showing historical trends
- 🌍 **Multi-language support** for international users
- 📱 **Progressive Web App (PWA)** for offline access
- 🔔 **Weather alerts** and notifications
- 🎨 **Customizable themes** beyond dark mode

---
