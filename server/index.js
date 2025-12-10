const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const session = require('express-session');
const cookieParser = require('cookie-parser');
// const connectDB = require('./config/database');
const radioRoutes = require('./routes/radio');
const authRoutes = require('./routes/auth');

// Load passport AFTER dotenv config
dotenv.config();

// Connect to MongoDB
// connectDB();

// Load passport configuration after env vars are loaded
// const passport = require('./config/passport');

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.set('trust proxy', 1);

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  next();
});

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      process.env.CLIENT_URL || 'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://127.0.0.1:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
    ];

    if (process.env.ALLOWED_ORIGINS) {
      allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(','));
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`🚫 CORS: Blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
  maxAge: 86400
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '1mb', strict: true }));
app.use(express.urlencoded({ extended: true, limit: '1mb', parameterLimit: 100 }));
app.use(cookieParser());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// // Passport middleware
// app.use(passport.initialize());
// app.use(passport.session());

// Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const userAgent = req.get('User-Agent') || 'Unknown';
  const ip = req.ip || req.connection.remoteAddress;

  console.log(`📊 [${timestamp}] ${req.method} ${req.url} - IP: ${ip}`);

  if (NODE_ENV === 'development') {
    console.log(`   UA: ${userAgent.substring(0, 100)}${userAgent.length > 100 ? '...' : ''}`);
  }

  next();
});

// Response time tracking
app.use((req, res, next) => {
  req.startTime = Date.now();

  const originalSend = res.send;
  res.send = function(data) {
    const responseTime = Date.now() - req.startTime;
    res.setHeader('X-Response-Time', `${responseTime}ms`);

    if (responseTime > 5000) {
      console.warn(`⚠️ Slow response: ${req.method} ${req.url} took ${responseTime}ms`);
    }

    return originalSend.call(this, data);
  };

  next();
});

// // API Routes
// app.use('/api/auth', authRoutes);
app.use('/api/radio', radioRoutes);

// Root route
app.get('/', (req, res) => {
  const serverInfo = {
    name: 'RadioVerse API Server',
    version: '2.0.0',
    status: 'operational',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: NODE_ENV,
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      stations: '/api/radio/stations',
      search: '/api/radio/search',
      popular: '/api/radio/popular',
      countries: '/api/radio/countries',
      tags: '/api/radio/tags'
    },
    documentation: {
      baseUrl: req.protocol + '://' + req.get('host'),
      apiVersion: '2.0',
      radioBrowserAPI: 'https://api.radio-browser.info'
    }
  };

  res.json(serverInfo);
});

// Health check
app.get('/api/health', async (req, res) => {
  const mongoose = require('mongoose');

  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024)
    },
    system: {
      platform: process.platform,
      nodeVersion: process.version,
      pid: process.pid
    },
    database: {
      status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      name: mongoose.connection.name
    }
  };

  try {
    const { healthCheck: radioHealthCheck } = require('./services/radioBrowserService');
    const radioBrowserHealth = await radioHealthCheck();

    healthCheck.radioBrowser = radioBrowserHealth;

    if (radioBrowserHealth.status === 'unhealthy') {
      healthCheck.status = 'degraded';
      res.status(503);
    }

  } catch (error) {
    healthCheck.status = 'error';
    healthCheck.error = error.message;
    res.status(503);
  }

  const statusCode = mongoose.connection.readyState === 1 && healthCheck.status !== 'error' ? 200 : 503;
  res.status(statusCode).json(healthCheck);
});

// API Docs
app.get('/api/docs', (req, res) => {
  const docs = {
    title: 'RadioVerse API Documentation',
    version: '2.0.0',
    baseUrl: req.protocol + '://' + req.get('host') + '/api',
    endpoints: [
      {
        category: 'Authentication',
        routes: [
          {
            path: '/auth/register',
            method: 'POST',
            description: 'Register new user with email and password',
            body: { email: 'string', password: 'string', name: 'string' }
          },
          {
            path: '/auth/login',
            method: 'POST',
            description: 'Login with email and password',
            body: { email: 'string', password: 'string' }
          },
          {
            path: '/auth/google',
            method: 'GET',
            description: 'Start Google OAuth flow'
          },
          {
            path: '/auth/me',
            method: 'GET',
            description: 'Get current user profile',
            headers: { Authorization: 'Bearer <token>' }
          },
          {
            path: '/auth/logout',
            method: 'POST',
            description: 'Logout user'
          }
        ]
      },
      {
        category: 'Radio Stations',
        routes: [
          {
            path: '/radio/stations',
            method: 'GET',
            description: 'Get radio stations with optional filters',
            parameters: [
              { name: 'limit', type: 'number', description: 'Number of stations to return (1-1000)', default: 50 },
              { name: 'offset', type: 'number', description: 'Number of stations to skip', default: 0 },
              { name: 'countrycode', type: 'string', description: '2-letter ISO country code' },
              { name: 'tag', type: 'string', description: 'Filter by tag' },
              { name: 'name', type: 'string', description: 'Filter by station name' },
              { name: 'language', type: 'string', description: 'Filter by language' },
              { name: 'order', type: 'string', description: 'Sort order field' },
              { name: 'reverse', type: 'boolean', description: 'Reverse sort order' }
            ]
          },
          {
            path: '/radio/search',
            method: 'GET',
            description: 'Search stations by name',
            parameters: [
              { name: 'q', type: 'string', required: true, description: 'Search query (min 2 characters)' },
              { name: 'limit', type: 'number', description: 'Number of results to return', default: 20 }
            ]
          },
          {
            path: '/radio/country/:countryCode',
            method: 'GET',
            description: 'Get stations by country code',
            parameters: [
              { name: 'countryCode', type: 'string', required: true, description: '2-letter ISO country code' },
              { name: 'limit', type: 'number', description: 'Number of stations to return', default: 50 }
            ]
          },
          {
            path: '/radio/tag/:tagName',
            method: 'GET',
            description: 'Get stations by tag',
            parameters: [
              { name: 'tagName', type: 'string', required: true, description: 'Tag name' },
              { name: 'limit', type: 'number', description: 'Number of stations to return', default: 50 }
            ]
          },
          {
            path: '/radio/popular',
            method: 'GET',
            description: 'Get popular stations (most clicked)',
            parameters: [
              { name: 'limit', type: 'number', description: 'Number of stations to return', default: 50 }
            ]
          },
          {
            path: '/radio/countries',
            method: 'GET',
            description: 'Get list of all available countries'
          },
          {
            path: '/radio/tags',
            method: 'GET',
            description: 'Get list of all available tags',
            parameters: [
              { name: 'limit', type: 'number', description: 'Number of tags to return', default: 100 }
            ]
          },
          {
            path: '/radio/click/:stationUuid',
            method: 'POST',
            description: 'Record a station click (helps popularity ranking)',
            parameters: [
              { name: 'stationUuid', type: 'string', required: true, description: 'Station UUID' }
            ]
          }
        ]
      }
    ],
    responseFormat: {
      success: {
        success: true,
        message: 'string',
        data: 'array|object',
        count: 'number',
        timestamp: 'ISO string'
      },
      error: {
        success: false,
        message: 'string',
        error: 'string',
        timestamp: 'ISO string'
      }
    },
    rateLimits: {
      general: '200 requests per minute per IP',
      note: 'Rate limits are applied per IP address'
    }
  };

  res.json(docs);
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    error: `The requested endpoint ${req.method} ${req.originalUrl} does not exist`,
    availableEndpoints: [
      'GET /',
      'GET /api/health',
      'GET /api/docs',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET /api/auth/google',
      'GET /api/auth/me',
      'GET /api/radio/stations',
      'GET /api/radio/search',
      'GET /api/radio/popular',
      'GET /api/radio/countries',
      'GET /api/radio/tags'
    ],
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((err, req, res, next) => {
  const timestamp = new Date().toISOString();
  const requestId = Math.random().toString(36).substring(2, 15);

  console.error(`🚨 [${timestamp}] Error ${requestId}:`, {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
  });

  const isDevelopment = NODE_ENV === 'development';

  res.status(err.status || 500).json({
    success: false,
    message: 'Internal server error',
    error: isDevelopment ? err.message : 'Something went wrong',
    requestId,
    timestamp,
    ...(isDevelopment && { stack: err.stack })
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 RadioVerse API Server is running!`);
  console.log(`📡 Environment: ${NODE_ENV}`);
  console.log(`🌐 Server: http://localhost:${PORT}`);
  console.log(`📖 Documentation: http://localhost:${PORT}/api/docs`);
  console.log(`💚 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🔐 Auth: http://localhost:${PORT}/api/auth`);
  console.log(`🎵 Radio API: http://localhost:${PORT}/api/radio`);
  console.log(`⚡ Ready to serve radio stations from around the world!\n`);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n🔄 Received ${signal}. Starting graceful shutdown...`);

  server.close(async (err) => {
    if (err) {
      console.error('❌ Error during server close:', err);
      process.exit(1);
    }

    const mongoose = require('mongoose');
    await mongoose.connection.close();
    console.log('✅ Server and database connections closed successfully');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('⏰ Could not close server gracefully, forcing shutdown');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
