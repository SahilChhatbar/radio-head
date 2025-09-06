const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const radioRoutes = require('./routes/radio');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Trust proxy for accurate IP addresses (important for rate limiting)
app.set('trust proxy', 1);

// Security headers middleware
app.use((req, res, next) => {
  // Basic security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Remove powered by header
  res.removeHeader('X-Powered-By');
  
  next();
});

// Enhanced CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.CLIENT_URL || 'http://localhost:3000',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://127.0.0.1:3000'
    ];
    
    // Add additional origins from environment variable
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
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Body parsing middleware with size limits
app.use(express.json({ 
  limit: '1mb',
  strict: true
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '1mb',
  parameterLimit: 100
}));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const userAgent = req.get('User-Agent') || 'Unknown';
  const ip = req.ip || req.connection.remoteAddress;
  
  console.log(`📊 [${timestamp}] ${req.method} ${req.url} - IP: ${ip}`);
  
  // Log user agent for debugging (truncated)
  if (NODE_ENV === 'development') {
    console.log(`   UA: ${userAgent.substring(0, 100)}${userAgent.length > 100 ? '...' : ''}`);
  }
  
  next();
});

// Performance monitoring middleware
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

// API Routes
app.use('/api/radio', radioRoutes);

// Root endpoint with API information
app.get('/', (req, res) => {
  const serverInfo = {
    name: 'RadioHead API Server',
    version: '2.0.0',
    status: 'operational',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: NODE_ENV,
    endpoints: {
      health: '/api/health',
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

// Health check endpoint with detailed diagnostics
app.get('/api/health', async (req, res) => {
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
    }
  };
  
  try {
    // Import health check from radio service
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
  
  res.json(healthCheck);
});

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  const docs = {
    title: 'RadioHead API Documentation',
    version: '2.0.0',
    baseUrl: req.protocol + '://' + req.get('host') + '/api/radio',
    endpoints: [
      {
        path: '/stations',
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
        path: '/search',
        method: 'GET',
        description: 'Search stations by name',
        parameters: [
          { name: 'q', type: 'string', required: true, description: 'Search query (min 2 characters)' },
          { name: 'limit', type: 'number', description: 'Number of results to return', default: 20 }
        ]
      },
      {
        path: '/country/:countryCode',
        method: 'GET',
        description: 'Get stations by country code',
        parameters: [
          { name: 'countryCode', type: 'string', required: true, description: '2-letter ISO country code' },
          { name: 'limit', type: 'number', description: 'Number of stations to return', default: 50 }
        ]
      },
      {
        path: '/tag/:tagName',
        method: 'GET',
        description: 'Get stations by tag',
        parameters: [
          { name: 'tagName', type: 'string', required: true, description: 'Tag name' },
          { name: 'limit', type: 'number', description: 'Number of stations to return', default: 50 }
        ]
      },
      {
        path: '/popular',
        method: 'GET',
        description: 'Get popular stations (most clicked)',
        parameters: [
          { name: 'limit', type: 'number', description: 'Number of stations to return', default: 50 }
        ]
      },
      {
        path: '/countries',
        method: 'GET',
        description: 'Get list of all available countries'
      },
      {
        path: '/tags',
        method: 'GET',
        description: 'Get list of all available tags',
        parameters: [
          { name: 'limit', type: 'number', description: 'Number of tags to return', default: 100 }
        ]
      },
      {
        path: '/click/:stationUuid',
        method: 'POST',
        description: 'Record a station click (helps popularity ranking)',
        parameters: [
          { name: 'stationUuid', type: 'string', required: true, description: 'Station UUID' }
        ]
      },
      {
        path: '/health',
        method: 'GET',
        description: 'Service health check with Radio Browser status'
      },
      {
        path: '/server-info',
        method: 'GET',
        description: 'Detailed server information and statistics'
      },
      {
        path: '/refresh-cache',
        method: 'POST',
        description: 'Force refresh of Radio Browser server cache'
      },
      {
        path: '/stats',
        method: 'GET',
        description: 'Service statistics and performance metrics'
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

// Handle 404 for undefined routes
app.use((req, res, next) => {
  // Only handle if no other route matched
  res.status(404).json({
    success: false,
    message: 'Route not found',
    error: `The requested endpoint ${req.method} ${req.originalUrl} does not exist`,
    availableEndpoints: [
      'GET /',
      'GET /api/health',
      'GET /api/docs',
      'GET /api/radio/stations',
      'GET /api/radio/search',
      'GET /api/radio/popular',
      'GET /api/radio/countries',
      'GET /api/radio/tags'
    ],
    timestamp: new Date().toISOString()
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  const timestamp = new Date().toISOString();
  const requestId = Math.random().toString(36).substring(2, 15);
  
  // Log error with request details
  console.error(`🚨 [${timestamp}] Error ${requestId}:`, {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Don't send error details in production
  const isDevelopment = NODE_ENV === 'development';
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      error: isDevelopment ? err.message : 'Invalid request data',
      requestId,
      timestamp
    });
  }
  
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({
      success: false,
      message: 'CORS error',
      error: 'Origin not allowed',
      requestId,
      timestamp
    });
  }
  
  // Generic server error
  res.status(err.status || 500).json({
    success: false,
    message: 'Internal server error',
    error: isDevelopment ? err.message : 'Something went wrong',
    requestId,
    timestamp,
    ...(isDevelopment && { stack: err.stack })
  });
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`\n🔄 Received ${signal}. Starting graceful shutdown...`);
  
  const server = app.listen(PORT, () => {
    console.log(`🚀 RadioHead API Server is running!`);
    console.log(`📡 Environment: ${NODE_ENV}`);
    console.log(`🌐 Server: http://localhost:${PORT}`);
    console.log(`📖 Documentation: http://localhost:${PORT}/api/docs`);
    console.log(`💚 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`🎵 Radio API: http://localhost:${PORT}/api/radio`);
    console.log(`⚡ Ready to serve radio stations from around the world!\n`);
  });
  
  // Graceful shutdown
  const shutdown = () => {
    console.log('🛑 Closing server...');
    server.close((err) => {
      if (err) {
        console.error('❌ Error during server close:', err);
        process.exit(1);
      }
      console.log('✅ Server closed successfully');
      process.exit(0);
    });
    
    // Force close after 30 seconds
    setTimeout(() => {
      console.error('⏰ Could not close server gracefully, forcing shutdown');
      process.exit(1);
    }, 30000);
  };
  
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  
  return server;
};

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at Promise:', promise, 'reason:', reason);
  // Don't exit the process, but log it for debugging
});

// Start server
if (require.main === module) {
  gracefulShutdown('startup');
}

module.exports = app;