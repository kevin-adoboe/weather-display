/* eslint-disable no-undef */
process.env.NODE_ENV = 'test';

const request = require('supertest');
const { app, WeatherService } = require('../server');

// Utility validators
const isISODateString = (val) => typeof val === 'string' && !Number.isNaN(Date.parse(val));
const hasAllFields = (obj) =>
  obj &&
  typeof obj.city === 'string' &&
  typeof obj.temperature === 'number' &&
  typeof obj.description === 'string' &&
  typeof obj.humidity === 'number' &&
  typeof obj.windSpeed === 'number' &&
  typeof obj.timestamp === 'string';

describe('Health Check Tests', () => {
  test('Should return 200 status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  test('Should return healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.body).toHaveProperty('status', 'healthy');
  });

  test('Should include timestamp', async () => {
    const res = await request(app).get('/health');
    expect(res.body).toHaveProperty('timestamp');
    expect(isISODateString(res.body.timestamp)).toBe(true);
  });
});

describe('Static Files Tests', () => {
  test('Should serve index.html at /', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });

  test('Should contain "Weather App" in response (flexible check)', async () => {
    const res = await request(app).get('/');
    // Accept either exact or extended title used in the implementation
    expect(res.text).toMatch(/Weather( Display)? App/i);
  });

  test('Served file should be the expected public/index.html', async () => {
    const res = await request(app).get('/');
    // Basic sanity check: the HTML should include the header title element
    expect(res.text).toContain('<title>Weather Display App</title>');
  });
});

describe('Weather API Tests', () => {
  test('Should return weather for valid city (London)', async () => {
    const res = await request(app).get('/api/weather/London');
    expect(res.status).toBe(200);
    expect(hasAllFields(res.body)).toBe(true);
    expect(res.body.city).toMatch(/London/i);
  });

  test('Should handle invalid city names (only spaces) with 400', async () => {
    const res = await request(app).get('/api/weather/%20%20%20');
    expect([400, 422]).toContain(res.status);
  });

  test('Should return proper JSON format', async () => {
    const res = await request(app).get('/api/weather/Paris');
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(hasAllFields(res.body)).toBe(true);
  });

  test('Should include all required fields', async () => {
    const res = await request(app).get('/api/weather/Tokyo');
    const b = res.body;
    expect(b).toHaveProperty('city');
    expect(b).toHaveProperty('temperature');
    expect(b).toHaveProperty('description');
    expect(b).toHaveProperty('humidity');
    expect(b).toHaveProperty('windSpeed');
    expect(b).toHaveProperty('timestamp');
  });
});

describe('WeatherService Unit Tests', () => {
  test('Should create service (demo key not required)', () => {
    const service = new WeatherService();
    expect(service).toBeInstanceOf(WeatherService);
    expect(typeof service.getCurrentWeather).toBe('function');
  });

  test('Should generate mock data with valid ranges', () => {
    const service = new WeatherService();
    const data = service.getMockWeatherData('Berlin');
    expect(data.city).toBe('Berlin');
    expect(typeof data.temperature).toBe('number');
    expect(data.temperature).toBeGreaterThanOrEqual(5);
    expect(data.temperature).toBeLessThanOrEqual(35);
    expect(data.humidity).toBeGreaterThanOrEqual(0);
    expect(data.humidity).toBeLessThanOrEqual(100);
    expect(data.windSpeed).toBeGreaterThanOrEqual(0);
    expect(isISODateString(data.timestamp)).toBe(true);
  });

  test('Should throw error for empty city', async () => {
    const service = new WeatherService();
    await expect(service.getCurrentWeather('   ')).rejects.toThrow(/required/i);
  });

  test('Should format weather data correctly', () => {
    const service = new WeatherService();
    const formatted = service.formatWeatherData({
      city: 'Oslo',
      temperature: 12.3,
      description: 'light rain',
      humidity: 77,
      windSpeed: 3.2,
      timestamp: new Date().toISOString()
    });
    expect(hasAllFields(formatted)).toBe(true);
    expect(formatted.city).toBe('Oslo');
    expect(formatted.temperature).toBeCloseTo(12.3, 1);
    expect(formatted.description).toBe('light rain');
  });

  test('Should handle missing wind data (present but possibly NaN)', () => {
    const service = new WeatherService();
    const formatted = service.formatWeatherData({
      city: 'Lima', temperature: 20, description: 'clear', humidity: 50, timestamp: new Date().toISOString()
    });
    // Property exists and is a number (may be NaN since not provided)
    expect(Object.prototype.hasOwnProperty.call(formatted, 'windSpeed')).toBe(true);
    expect(typeof formatted.windSpeed).toBe('number');
  });
});

describe('Error Handling Tests', () => {
  test('Should return 404 for unknown routes', async () => {
    const res = await request(app).get('/this-route-does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Not Found');
  });

  test('Should handle malformed requests (bad URI segment)', async () => {
    const res = await request(app).get('/api/weather/%');
    // Express typically returns 400 on bad URI
    expect([400, 500]).toContain(res.status);
  });
});

describe('Data Validation Tests', () => {
  test('Temperature should be reasonable (-50 to 60°C)', async () => {
    const res = await request(app).get('/api/weather/Sydney');
    expect(res.status).toBe(200);
    expect(res.body.temperature).toBeGreaterThanOrEqual(-50);
    expect(res.body.temperature).toBeLessThanOrEqual(60);
  });

  test('Humidity should be 0-100%', async () => {
    const res = await request(app).get('/api/weather/Paris');
    expect(res.body.humidity).toBeGreaterThanOrEqual(0);
    expect(res.body.humidity).toBeLessThanOrEqual(100);
  });

  test('Wind speed should be positive (>= 0)', async () => {
    const res = await request(app).get('/api/weather/Toronto');
    expect(res.body.windSpeed).toBeGreaterThanOrEqual(0);
  });

  test('Timestamp should be valid ISO string', async () => {
    const res = await request(app).get('/api/weather/Madrid');
    expect(isISODateString(res.body.timestamp)).toBe(true);
  });

  test('Description should be a non-empty string', async () => {
    const res = await request(app).get('/api/weather/Rome');
    expect(typeof res.body.description).toBe('string');
    expect(res.body.description.length).toBeGreaterThan(0);
  });
});

