const express = require('express');
const { 
  getRadioStations, 
  searchStationsByName, 
  getStationsByCountry, 
  getStationsByTag,
  getPopularStations,
  getCountries,
  getTags,
  recordStationClick,
  refreshServerCache,
  getServerInfo,
  healthCheck
} = require('../services/radioBrowserService');

const router = express.Router();

router.use((req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;
  
  res.send = function(data) {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    originalSend.call(this, data);
  };
  
  next();
});

const handleError = (res, error, context = 'Operation') => {
  console.error(`❌ ${context} failed:`, error);
  
  const statusCode = error.message.includes('Invalid') || error.message.includes('must be') ? 400 : 500;
  const isClientError = statusCode === 400;
  
  res.status(statusCode).json({
    success: false,
    message: isClientError ? error.message : `${context} failed`,
    error: isClientError ? error.message : 'Internal server error',
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
};

const sendSuccess = (res, data, message = 'Success', meta = {}) => {
  res.json({
    success: true,
    message,
    data,
    count: Array.isArray(data) ? data.length : 1,
    timestamp: new Date().toISOString(),
    ...meta
  });
};

const validatePagination = (req, res, next) => {
  const { limit, offset } = req.query;
  
  if (limit !== undefined) {
    const parsedLimit = parseInt(limit);
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Invalid limit parameter',
        error: 'Limit must be a number between 1 and 1000'
      });
    }
  }
  
  if (offset !== undefined) {
    const parsedOffset = parseInt(offset);
    if (isNaN(parsedOffset) || parsedOffset < 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid offset parameter', 
        error: 'Offset must be a non-negative number'
      });
    }
  }
  
  next();
};

const createRateLimiter = (maxRequests = 100, windowMs = 60000) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (requests.has(clientIP)) {
      const clientRequests = requests.get(clientIP).filter(time => time > windowStart);
      requests.set(clientIP, clientRequests);
    }
    
    const clientRequests = requests.get(clientIP) || [];
    
    if (clientRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests',
        error: `Rate limit exceeded. Max ${maxRequests} requests per minute.`,
        retryAfter: Math.ceil((clientRequests[0] + windowMs - now) / 1000)
      });
    }
    
    clientRequests.push(now);
    requests.set(clientIP, clientRequests);
    
    next();
  };
};

router.use(createRateLimiter(200, 60000)); 
router.get('/stations', validatePagination, async (req, res) => {
  try {
    const { limit = 50, offset = 0, countrycode, tag, name, language, order, reverse } = req.query;
    
    const params = {
      limit: parseInt(limit),
      offset: parseInt(offset),
      ...(countrycode && { countrycode }),
      ...(tag && { tag }),
      ...(name && { name }),
      ...(language && { language }),
      ...(order && { order }),
      ...(reverse !== undefined && { reverse: reverse === 'true' })
    };

    const stations = await getRadioStations(params);
    
    sendSuccess(res, stations, 'Stations fetched successfully', {
      pagination: {
        limit: params.limit,
        offset: params.offset,
        hasMore: stations.length === params.limit
      },
      filters: {
        countrycode,
        tag,
        name,
        language,
        order,
        reverse: params.reverse
      }
    });
  } catch (error) {
    handleError(res, error, 'Fetch stations');
  }
});

router.get('/search', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
        error: 'Query parameter "q" must be a non-empty string'
      });
    }

    if (q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query too short',
        error: 'Query must be at least 2 characters long'
      });
    }

    const stations = await searchStationsByName(q.trim(), parseInt(limit));
    
    sendSuccess(res, stations, 'Search completed successfully', {
      query: q.trim(),
      resultsCount: stations.length
    });
  } catch (error) {
    handleError(res, error, 'Search stations');
  }
});

router.get('/country/:countryCode', validatePagination, async (req, res) => {
  try {
    const { countryCode } = req.params;
    const { limit = 50 } = req.query;
    if (!countryCode || !/^[a-zA-Z]{2}$/.test(countryCode)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid country code',
        error: 'Country code must be a valid 2-letter ISO country code'
      });
    }

    const stations = await getStationsByCountry(countryCode, parseInt(limit));
    
    sendSuccess(res, stations, `Stations fetched for country: ${countryCode.toUpperCase()}`, {
      country: countryCode.toUpperCase(),
      stationsFound: stations.length
    });
  } catch (error) {
    handleError(res, error, 'Fetch stations by country');
  }
});

router.get('/tag/:tagName', validatePagination, async (req, res) => {
  try {
    const { tagName } = req.params;
    const { limit = 50 } = req.query;

    if (!tagName || typeof tagName !== 'string' || tagName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tag name',
        error: 'Tag name must be a non-empty string'
      });
    }

    const stations = await getStationsByTag(tagName.trim(), parseInt(limit));
    
    sendSuccess(res, stations, `Stations fetched for tag: ${tagName}`, {
      tag: tagName.trim(),
      stationsFound: stations.length
    });
  } catch (error) {
    handleError(res, error, 'Fetch stations by tag');
  }
});

router.get('/popular', validatePagination, async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const stations = await getPopularStations(parseInt(limit));
    
    sendSuccess(res, stations, 'Popular stations fetched successfully', {
      sortedBy: 'click count (descending)',
      stationsFound: stations.length
    });
  } catch (error) {
    handleError(res, error, 'Fetch popular stations');
  }
});

router.get('/countries', async (req, res) => {
  try {
    const countries = await getCountries();
    
    sendSuccess(res, countries, 'Countries fetched successfully', {
      totalCountries: countries.length
    });
  } catch (error) {
    handleError(res, error, 'Fetch countries');
  }
});

router.get('/tags', async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    
    const tags = await getTags(parseInt(limit));
    
    sendSuccess(res, tags, 'Tags fetched successfully', {
      totalTags: tags.length,
      limited: limit < tags.length
    });
  } catch (error) {
    handleError(res, error, 'Fetch tags');
  }
});

router.post('/click/:stationUuid', async (req, res) => {
  try {
    const { stationUuid } = req.params;
    
    if (!stationUuid || typeof stationUuid !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid station UUID',
        error: 'Station UUID must be a non-empty string'
      });
    }

    const success = await recordStationClick(stationUuid);
    
    if (success) {
      sendSuccess(res, { clicked: true }, 'Station click recorded successfully', {
        stationUuid,
        note: 'This helps mark the station as popular in the Radio Browser network'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to record station click',
        error: 'Click recording failed but this does not affect playback'
      });
    }
  } catch (error) {
    handleError(res, error, 'Record station click');
  }
});

router.get('/health', async (req, res) => {
  try {
    const healthStatus = await healthCheck();
    const serverInfo = getServerInfo();
    
    res.json({
      success: true,
      message: 'Service health check completed',
      health: healthStatus,
      serverInfo: {
        currentServer: serverInfo.currentServer,
        cacheAge: serverInfo.cacheAge,
        availableServers: serverInfo.availableServers,
        lastRefresh: serverInfo.cacheAge ? new Date(Date.now() - serverInfo.cacheAge).toISOString() : null
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Service health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/server-info', async (req, res) => {
  try {
    const serverInfo = getServerInfo();
    
    sendSuccess(res, serverInfo, 'Server information retrieved successfully');
  } catch (error) {
    handleError(res, error, 'Get server info');
  }
});

router.post('/refresh-cache', async (req, res) => {
  try {
    const newServer = await refreshServerCache();
    
    sendSuccess(res, { 
      newServer,
      refreshedAt: new Date().toISOString()
    }, 'Server cache refreshed successfully');
  } catch (error) {
    handleError(res, error, 'Refresh server cache');
  }
});

router.get('/stats', async (req, res) => {
  try {
    const [popularStations, countries] = await Promise.all([
      getPopularStations(1),
      getCountries()
    ]);
    
    const serverInfo = getServerInfo();
    
    const stats = {
      service: {
        status: 'operational',
        uptime: process.uptime(),
        version: '2.0.0'
      },
      servers: {
        current: serverInfo.currentServer,
        available: serverInfo.availableServers,
        cacheAge: serverInfo.cacheAge
      },
      data: {
        countriesAvailable: countries.length,
        sampleStationsFetched: popularStations.length > 0
      },
      performance: {
        averageResponseTime: serverInfo.healthStats?.reduce((acc, stat) => 
          acc + (stat.responseTime || 0), 0) / (serverInfo.healthStats?.length || 1) || 0
      }
    };
    
    sendSuccess(res, stats, 'Service statistics retrieved successfully');
  } catch (error) {
    handleError(res, error, 'Get service statistics');
  }
});

router.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    error: `The endpoint ${req.method} ${req.originalUrl} does not exist`,
    availableEndpoints: [
      'GET /api/radio/stations',
      'GET /api/radio/search',
      'GET /api/radio/country/:countryCode',
      'GET /api/radio/tag/:tagName',
      'GET /api/radio/popular',
      'GET /api/radio/countries',
      'GET /api/radio/tags',
      'POST /api/radio/click/:stationUuid',
      'GET /api/radio/health',
      'GET /api/radio/server-info',
      'POST /api/radio/refresh-cache',
      'GET /api/radio/stats'
    ],
    timestamp: new Date().toISOString()
  });
});

router.use((error, req, res, next) => {
  console.error('🚨 Unhandled route error:', error);
  
  if (res.headersSent) {
    return next(error);
  }
  
  handleError(res, error, 'Request processing');
});

module.exports = router;