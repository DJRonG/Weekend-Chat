# Weekend Agent 🚦

Smart local logistics and mobility recommendations powered by intelligent decision-making algorithms.

## Overview

Weekend Agent is an AI-powered mobility assistant that helps you make smart decisions about how to get to your destinations. By analyzing weather conditions, parking availability, local events, and your home status, it provides personalized recommendations on whether to walk, drive, or take a rideshare.

## Features

### 🎯 Intelligent Mobility Recommendations
- **Walk, Drive, or Rideshare** suggestions based on multiple factors
- Real-time confidence scoring for each recommendation
- Detailed reasoning for every decision

### 🌦️ Weather-Aware Logic
- Temperature thresholds (configurable)
- Rain probability analysis
- Automatic adjustments for extreme weather conditions

### 🚗 Parking Intelligence
- Destination-specific parking difficulty ratings
- Parking garage availability tracking
- Cost estimates for parking fees

### 🎉 Event Impact Analysis
- Track local events and festivals
- Automatic detection of nearby large gatherings (>5,000 attendees)
- Event-based parking and mobility recommendations

### 🏠 Home Status Integration
- EV charge level monitoring
- Garden watering status tracking
- Smart suggestions based on home maintenance needs

### 📝 Friday Recap (Conversation Notes)
- Log weekly conversations and commitments
- Extract venue mentions and social plans
- Emotional state tracking for better recommendations

## How It Works

### 1. Pre-Flight Mobility Check

Before suggesting any activity, the agent evaluates:

- **Event Layer**: Cross-references local events, festivals, and road closures within 1.5 miles
- **Parking Pulse**: Predicts availability based on historical patterns and current conditions
- **Weather Conditions**: Temperature, precipitation, and comfort factors
- **Home Status**: EV charge level and maintenance needs

### 2. Recommendation Engine

The mobility engine calculates a weighted score based on:

```
Total Score = Weather Score + Parking Score + Event Score + Home Status Score + Distance Score
```

**Scoring Logic:**
- **Score > 60**: Rideshare recommended (high difficulty)
- **Score 30-60**: Drive recommended (moderate difficulty)
- **Score < 30**: Walk recommended (optimal conditions)

### 3. Decision Output

Each recommendation includes:
- Primary suggestion (Walk/Drive/Rideshare)
- Confidence percentage
- Detailed reasoning
- Weather summary
- Parking difficulty and cost
- Nearby event alerts
- Home status report
- Friday recap notes (if applicable)

---

## 🚀 Deployment Options

### Option 1: Cloudflare Workers (Current)

The app is currently configured for Cloudflare Workers with D1 database.

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Deploy to Cloudflare
npx wrangler deploy
```

### Option 2: Vercel Deployment

See [Vercel Deployment Guide](#-vercel-deployment) below.

---

## ☁️ Vercel Deployment

### Architecture Comparison

| Component | Cloudflare | Vercel |
|-----------|------------|--------|
| Frontend | Vite + Workers Assets | Vite Static or Next.js |
| Backend | Hono on Workers | Vercel Functions (Node.js) |
| Database | D1 (SQLite) | Vercel Postgres or Turso |
| Edge Runtime | Workers | Edge Functions |

### Vercel Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Vercel Platform                        │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────┐    ┌────────────────────────┐    │
│  │   Vite Frontend  │    │  Serverless Functions  │    │
│  │   (Static Build) │◄──►│  /api/recommendation   │    │
│  │   React + TS     │    │  /api/destinations     │    │
│  └──────────────────┘    │  /api/events           │    │
│                          │  /api/home-status      │    │
│                          │  /api/settings         │    │
│                          └────────────────────────┘    │
└─────────────────────────────┬───────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Turso / Vercel   │
                    │  Postgres / Neon  │
                    └───────────────────┘
```

### Step 1: Install Vercel CLI

```bash
npm i -g vercel
vercel login
```

### Step 2: Choose Database Option

#### Option A: Turso (SQLite - Closest to D1)

Turso is the easiest migration path since D1 is SQLite-based.

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Create database
turso db create weekend-agent

# Get connection URL
turso db show weekend-agent --url

# Create auth token
turso db tokens create weekend-agent
```

#### Option B: Vercel Postgres

```bash
# Create via Vercel Dashboard or CLI
vercel postgres create weekend-agent-db
```

### Step 3: Update Project Structure

Create the following new files:

#### `vercel.json`

```json
{
  "framework": null,
  "buildCommand": "npm run build:vercel",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "functions": {
    "api/**/*.ts": {
      "runtime": "@vercel/node@3",
      "maxDuration": 10
    }
  }
}
```

#### `api/recommendation.ts` (Vercel Serverless Function)

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@libsql/client';
import { MobilityEngine } from '../src/worker/mobility-engine';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const mobilityEngine = new MobilityEngine();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { destination_id, weather } = req.body;

    if (!destination_id) {
      return res.status(400).json({ error: 'destination_id is required' });
    }

    // Get destination
    const destResult = await db.execute({
      sql: 'SELECT * FROM destinations WHERE id = ?',
      args: [destination_id],
    });
    const destination = destResult.rows[0];

    if (!destination) {
      return res.status(404).json({ error: 'Destination not found' });
    }

    // Get user settings
    const settingsResult = await db.execute(
      'SELECT * FROM user_settings ORDER BY id DESC LIMIT 1'
    );
    let settings = settingsResult.rows[0];

    if (!settings) {
      await db.execute({
        sql: `INSERT INTO user_settings 
              (max_comfortable_walk_distance, temperature_drive_threshold_high, 
               temperature_drive_threshold_low, rain_drive_threshold) 
              VALUES (?, ?, ?, ?)`,
        args: [1.5, 30, 5, 40],
      });
      const newSettings = await db.execute(
        'SELECT * FROM user_settings ORDER BY id DESC LIMIT 1'
      );
      settings = newSettings.rows[0];
    }

    // Get events
    const now = new Date().toISOString();
    const eventsResult = await db.execute({
      sql: `SELECT * FROM events 
            WHERE start_datetime >= ? OR end_datetime >= ? 
            ORDER BY start_datetime`,
      args: [now, now],
    });

    // Find nearby events
    const nearbyEvents = mobilityEngine.findNearbyEvents(
      destination as any,
      eventsResult.rows as any[],
      Number(settings.max_comfortable_walk_distance)
    );

    // Get home status
    const homeResult = await db.execute(
      'SELECT * FROM home_status ORDER BY id DESC LIMIT 1'
    );
    const homeStatus = homeResult.rows[0];

    // Calculate distance
    let distance = 0;
    if (settings?.home_latitude && settings?.home_longitude && 
        destination.latitude && destination.longitude) {
      const R = 3958.8;
      const dLat = (Number(destination.latitude) - Number(settings.home_latitude)) * (Math.PI / 180);
      const dLon = (Number(destination.longitude) - Number(settings.home_longitude)) * (Math.PI / 180);
      const a = Math.sin(dLat / 2) ** 2 +
                Math.cos(Number(settings.home_latitude) * (Math.PI / 180)) *
                Math.cos(Number(destination.latitude) * (Math.PI / 180)) *
                Math.sin(dLon / 2) ** 2;
      distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // Generate recommendation
    const recommendation = mobilityEngine.generateRecommendation(
      destination as any,
      nearbyEvents,
      homeStatus as any,
      settings as any,
      weather || { temp: 20, condition: 'Clear', rain_probability: 0 },
      distance
    );

    // Get conversation notes for Friday recap
    const notesResult = await db.execute(
      `SELECT * FROM conversation_notes 
       WHERE date_logged >= date('now', '-7 days') 
       ORDER BY date_logged DESC LIMIT 5`
    );

    if (notesResult.rows.length > 0) {
      const recapParts: string[] = [];
      notesResult.rows.forEach((note: any) => {
        if (note.contact_name && note.venue_mentioned) {
          recapParts.push(
            `You mentioned wanting to see ${note.contact_name} - they usually prefer ${note.venue_mentioned}`
          );
        } else if (note.emotional_state) {
          recapParts.push(`Recent mood: ${note.emotional_state} - ${note.note_text}`);
        }
      });
      if (recapParts.length > 0) {
        recommendation.friday_recap = recapParts.join('. ');
      }
    }

    // Store recommendation
    await db.execute({
      sql: `INSERT INTO mobility_recommendations 
            (destination_id, recommendation, confidence_score, reasoning, 
             weather_temp, weather_condition, rain_probability, 
             parking_difficulty, estimated_cost) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        destination_id,
        recommendation.recommendation,
        recommendation.confidence_score,
        recommendation.reasoning,
        recommendation.weather.temp,
        recommendation.weather.condition,
        recommendation.weather.rain_probability,
        recommendation.parking.difficulty,
        recommendation.parking.estimated_cost || null,
      ],
    });

    return res.status(200).json(recommendation);
  } catch (error) {
    console.error('Error generating recommendation:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

#### `api/destinations.ts`

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const result = await db.execute('SELECT * FROM destinations ORDER BY name');
    return res.status(200).json(result.rows);
  }

  if (req.method === 'POST') {
    try {
      const data = req.body;
      const result = await db.execute({
        sql: `INSERT INTO destinations 
              (name, address, latitude, longitude, typical_parking_difficulty, 
               has_parking_garage, parking_cost_estimate) 
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          data.name,
          data.address,
          data.latitude || null,
          data.longitude || null,
          data.typical_parking_difficulty || null,
          data.has_parking_garage ? 1 : 0,
          data.parking_cost_estimate || null,
        ],
      });
      return res.status(200).json({ id: result.lastInsertRowid, ...data });
    } catch (error) {
      console.error('Error creating destination:', error);
      return res.status(500).json({ error: 'Failed to create destination' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
```

### Step 4: Update package.json

```json
{
  "name": "weekend-agent",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "build:vercel": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint ."
  },
  "dependencies": {
    "@libsql/client": "^0.6.0",
    "lucide-react": "^0.510.0",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "react-router": "^7.5.3",
    "zod": "^3.24.3"
  },
  "devDependencies": {
    "@types/node": "22.14.1",
    "@types/react": "19.0.10",
    "@types/react-dom": "19.0.4",
    "@vercel/node": "^3.0.0",
    "@vitejs/plugin-react": "4.4.1",
    "autoprefixer": "^10.4.21",
    "eslint": "9.25.1",
    "postcss": "^8.5.3",
    "tailwindcss": "^3.4.17",
    "typescript": "5.8.3",
    "vite": "^7.1.3"
  }
}
```

### Step 5: Update Vite Config

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

### Step 6: Set Environment Variables

```bash
# Add via Vercel CLI
vercel env add TURSO_DATABASE_URL
vercel env add TURSO_AUTH_TOKEN

# Or via Vercel Dashboard
# Project → Settings → Environment Variables
```

### Step 7: Run Database Migrations

```bash
# Using Turso CLI
turso db shell weekend-agent < migrations/1.sql

# Or execute via the dashboard
```

### Step 8: Deploy

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Step 9: Verify Deployment

```bash
# Check deployment
vercel ls

# View logs
vercel logs

# Test API
curl https://your-app.vercel.app/api/destinations
```

---

## 📁 Project Structure (Vercel)

```
weekend-agent/
├── api/                          # Vercel Serverless Functions
│   ├── recommendation.ts         # POST /api/recommendation
│   ├── destinations.ts           # GET/POST /api/destinations
│   ├── events.ts                 # GET/POST /api/events
│   ├── conversation-notes.ts     # GET/POST /api/conversation-notes
│   ├── home-status.ts            # GET/POST/PUT /api/home-status
│   └── settings.ts               # GET/PUT /api/settings
├── src/
│   ├── react-app/               # Frontend React app
│   │   ├── App.tsx
│   │   ├── components/
│   │   ├── pages/
│   │   └── main.tsx
│   ├── shared/
│   │   └── types.ts             # Shared TypeScript types
│   └── worker/
│       └── mobility-engine.ts   # Recommendation logic (shared)
├── migrations/
│   └── 1.sql                    # Database schema
├── vercel.json                  # Vercel configuration
├── vite.config.ts               # Vite configuration
├── package.json
└── tsconfig.json
```

---

## 🔧 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `TURSO_DATABASE_URL` | Turso database URL | Yes |
| `TURSO_AUTH_TOKEN` | Turso authentication token | Yes |

---

## 🧪 Local Development (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Link to project
vercel link

# Pull environment variables
vercel env pull .env.local

# Run dev server with API routes
vercel dev
```

---

## 🔄 Migration Checklist

- [ ] Create Turso database
- [ ] Run migrations on Turso
- [ ] Create `/api` directory with serverless functions
- [ ] Update `package.json` (remove Cloudflare deps, add `@libsql/client`)
- [ ] Create `vercel.json`
- [ ] Update `vite.config.ts`
- [ ] Set environment variables in Vercel
- [ ] Deploy and test

---

## 📊 API Endpoints

### Recommendations
- `POST /api/recommendation` - Generate mobility recommendation

### Destinations
- `GET /api/destinations` - List all destinations
- `POST /api/destinations` - Add new destination

### Events
- `GET /api/events` - List all events
- `POST /api/events` - Add new event

### Conversation Notes
- `GET /api/conversation-notes` - Retrieve recent notes
- `POST /api/conversation-notes` - Log new conversation

### Home Status
- `GET /api/home-status` - Get current home status
- `POST /api/home-status` - Create home status entry
- `PUT /api/home-status` - Update home status

### Settings
- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update user settings

---

## Usage Guide

### Adding Destinations

1. Click the **+** button in the "Where to?" section
2. Enter destination details:
   - Name and address (required)
   - GPS coordinates (optional but recommended)
   - Parking difficulty (Low/Medium/High)
   - Parking garage availability
   - Estimated parking cost

### Setting Weather Conditions

1. Adjust current temperature (°C)
2. Select weather condition (Clear/Cloudy/Rainy/Stormy/Snowy)
3. Set rain probability (0-100%)

### Managing Home Status

1. Update EV charge percentage (0-100%)
2. Toggle garden watering status
3. Status automatically factors into recommendations

### Getting a Recommendation

1. Select a destination from your list
2. Ensure weather and home status are current
3. Click **"Get Recommendation"**
4. Review the detailed mobility advice

---

## Configuration

### Temperature Thresholds
- **High Threshold**: Above 30°C suggests driving
- **Low Threshold**: Below 5°C suggests driving

### Rain Threshold
- Above 40% probability triggers drive recommendation

### Event Radius
- 1.5 miles default radius for event impact detection
- Large events (>5,000 attendees) significantly influence recommendations

---

## Future Enhancements

Planned features include:
- Integration with Home Assistant for real-time EV data
- International time zone support for meeting scheduling
- Transit alert integration
- Historical pattern learning
- Calendar integration
- Contact preferences tracking

---

## Technical Stack

| Component | Cloudflare | Vercel |
|-----------|------------|--------|
| Frontend | React 19 + Vite | React 19 + Vite |
| Backend | Hono.js on Workers | Vercel Functions |
| Database | D1 (SQLite) | Turso (SQLite) |
| Styling | Tailwind CSS | Tailwind CSS |
| Icons | Lucide React | Lucide React |

---

## Contributing

Weekend Agent uses a sophisticated mobility scoring algorithm that balances multiple environmental and contextual factors to provide intelligent recommendations. Contributions to enhance the decision logic, add new data sources, or improve the user experience are welcome.

---

## License

Built with Mocha ☕
