'use strict';

// Load environment variables early
require('dotenv').config();

const path = require('path');
const express = require('express');

// Express application instance
const app = express();

// Core middleware
// Serve static assets from the "public" directory (e.g., index.html, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));
// Parse JSON bodies
app.use(express.json());

/**
 * WeatherService encapsulates retrieval and normalization of weather data.
 * This implementation provides a mock generator so the app runs with no API keys.
 */
class WeatherService {
  /**
   * Returns current weather for a given city.
   * In this mock implementation, synthetic but realistic values are generated.
   * @param {string} cityName - Target city name provided by clients
   * @returns {Promise<object>} - Standardized weather payload
   */
  async getCurrentWeather(cityName) {
    const normalizedCity = this._normalizeCityName(cityName);
    if (!normalizedCity) {
      const error = new Error('City parameter is required');
      error.status = 400;
      throw error;
    }

    // In future, real API integration could be placed here
    const data = this.getMockWeatherData(normalizedCity);
    return this.formatWeatherData(data);
  }

  /**
   * Generates mock weather data. Ranges are chosen to look realistic and wide enough
   * for demos: temperature [5, 35] °C, humidity [0, 100] %, windSpeed [0, 15] m/s.
   * @param {string} cityName
   * @returns {object}
   */
  getMockWeatherData(cityName) {
    const temperatureC = this._randomInRange(5, 35, 1);
    const humidityPct = this._randomInRange(0, 100, 0);
    const windSpeedMs = this._randomInRange(0, 15, 1);

    const description = this._pickDescription(temperatureC, humidityPct);

    return {
      city: cityName,
      temperature: temperatureC,
      description,
      humidity: humidityPct,
      windSpeed: windSpeedMs,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Formats weather data into a stable, documented schema for API consumers.
   * @param {object} data
   * @returns {object}
   */
  formatWeatherData(data) {
    return {
      city: String(data.city),
      temperature: Number(data.temperature), // °C
      description: String(data.description),
      humidity: Number(data.humidity), // %
      windSpeed: Number(data.windSpeed), // m/s
      timestamp: new Date(data.timestamp || Date.now()).toISOString()
    };
  }

  // Helpers
  _normalizeCityName(cityName) {
    if (typeof cityName !== 'string') return '';
    const decoded = decodeURIComponent(cityName).trim();
    // Collapse multiple spaces and capitalize nicely
    return decoded
      .replace(/[\s_-]+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  _randomInRange(min, max, decimals = 0) {
    const value = Math.random() * (max - min) + min;
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  _pickDescription(temperatureC, humidityPct) {
    const descriptions = {
      hot: ['Sunny', 'Hot and dry', 'Scorching sun', 'Warm breeze'],
      mild: ['Partly cloudy', 'Mild and pleasant', 'Light clouds', 'Calm skies'],
      cool: ['Cool and crisp', 'Overcast', 'Chilly breeze', 'Cloudy'],
      wet: ['Light rain', 'Showers', 'Drizzle', 'Humid and cloudy'],
      windy: ['Windy', 'Gusty winds', 'Breezy']
    };

    const bucket = temperatureC >= 28
      ? 'hot'
      : temperatureC >= 16
      ? 'mild'
      : 'cool';

    const pool = new Set(descriptions[bucket]);
    if (humidityPct >= 70) {
      descriptions.wet.forEach((d) => pool.add(d));
    }
    if (temperatureC >= 20 && Math.random() < 0.4) {
      descriptions.windy.forEach((d) => pool.add(d));
    }
    const arr = Array.from(pool);
    return arr[Math.floor(Math.random() * arr.length)];
  }
}

// Routes
app.get('/', async (req, res, next) => {
  try {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    return res.sendFile(indexPath);
  } catch (err) {
    return next(err);
  }
});

app.get('/health', async (req, res) => {
  return res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/weather/:city', async (req, res, next) => {
  try {
    const { city } = req.params;
    const service = new WeatherService();
    const weather = await service.getCurrentWeather(city);
    return res.json(weather);
  } catch (err) {
    return next(err);
  }
});

// 404 handler for unmatched routes (placed after all route handlers)
app.use((req, res) => {
  return res.status(404).json({ error: 'Not Found', path: req.originalUrl });
});

// Centralized error handler
// Avoids leaking internals; returns structured error responses
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status && Number.isInteger(err.status) ? err.status : 500;
  const isProd = process.env.NODE_ENV === 'production';
  const payload = {
    error: status === 500 ? 'Internal Server Error' : 'Request Error',
    message: isProd && status === 500 ? undefined : err.message || undefined,
    timestamp: new Date().toISOString()
  };
  if (!isProd) {
    // In non-production, include a minimal stack to aid debugging
    payload.stack = err.stack;
  }
  return res.status(status).json(payload);
});

// Start HTTP server unless running in test environment
const PORT = Number(process.env.PORT) || 3000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Weather app listening on port ${PORT}`);
  });
}

module.exports = { app, WeatherService };

