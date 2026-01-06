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

## Deployment Notes

- Frontend deployed on **Vercel**
- Backend deployed on **Render**
- Database is PostgreSQL (hosted on **Render**)
---

## CORS Configuration

The ackend explicitly allows:
- `https://weather-location-dashboard.vercel.app`

---

## Known Limitations

- ⏱️ Render free-tier may expire cause cold starts (~10-30s delay)
- 🗄️ Free PostgreSQL database has storage limits
- 🗺️ Static map requires Geoapify API key
- 📰 News results depend on Google News RSS availability

---

