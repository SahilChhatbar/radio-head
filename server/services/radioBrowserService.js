const axios = require('axios');
const dns = require('dns').promises;

const CONFIG = {
  SERVER_CACHE_TTL: 10 * 60 * 1000,
  HEALTH_CHECK_TIMEOUT: 5000,
  REQUEST_TIMEOUT: 15000,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  BACKOFF_MULTIPLIER: 2,
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 1000,

  // User agent (speaking HTTP agent string as required)
  USER_AGENT: 'RadioVerse/1.0 (https://RadioVerse-app.com)',

  // Fallback servers (geographically distributed)
  FALLBACK_SERVERS: [
    'https://de1.api.radio-browser.info',
    'https://nl1.api.radio-browser.info',
    'https://at1.api.radio-browser.info',
    'https://fr1.api.radio-browser.info'
  ]
};

let serverCache = {
  servers: [],
  selectedServer: null,
  timestamp: 0,
  ttl: CONFIG.SERVER_CACHE_TTL,
  healthStats: new Map()
};

 //Enhanced server discovery using both SRV and A record methods
class RadioBrowserService {
  constructor() {
    this.isDiscovering = false;
    this.discoveryPromise = null;
  }

  /**
   * Discover servers via DNS SRV records (preferred method)
   */
  async discoverServersViaSRV() {
    try {
      const srvRecords = await dns.resolveSrv('_api._tcp.radio-browser.info');

      if (!srvRecords || srvRecords.length === 0) {
        throw new Error('No SRV records found');
      }

      const discoveredServers = srvRecords
        .sort((a, b) => a.priority - b.priority || b.weight - a.weight)
        .map(record => `https://${record.name}`)
        .filter(server => server.includes('api.radio-browser.info'));

      return discoveredServers;
    } catch (error) {
      return null;
    }
  }

  /**
   * Discover servers via A records (fallback method)
   */
  async discoverServersViaA() {
    try {
      const aRecords = await dns.resolve4('all.api.radio-browser.info');

      if (!aRecords || aRecords.length === 0) {
        throw new Error('No A records found');
      }

      const reversePromises = aRecords.map(async (ip) => {
        try {
          const hostnames = await dns.reverse(ip);
          const radioBrowserHost = hostnames.find(host =>
            host.includes('api.radio-browser.info')
          );
          return radioBrowserHost ? `https://${radioBrowserHost}` : `https://${ip}`;
        } catch (reverseError) {
          // If reverse lookup fails, use IP directly
          return `https://${ip}`;
        }
      });

      const discoveredServers = await Promise.all(reversePromises);
      return discoveredServers;
    } catch (error) {
      return null;
    }
  }

  /**
   * Main server discovery method with fallback chain
   */
  async discoverServers() {
    // Prevent multiple concurrent discoveries
    if (this.isDiscovering && this.discoveryPromise) {
      return await this.discoveryPromise;
    }

    this.isDiscovering = true;
    this.discoveryPromise = this._performDiscovery();

    try {
      return await this.discoveryPromise;
    } finally {
      this.isDiscovering = false;
      this.discoveryPromise = null;
    }
  }

  async _performDiscovery() {
    // Try SRV records first (preferred)
    let servers = await this.discoverServersViaSRV();

    // Fallback to A records
    if (!servers || servers.length === 0) {
      servers = await this.discoverServersViaA();
    }

    // Final fallback to hardcoded servers
    if (!servers || servers.length === 0) {
      return [...CONFIG.FALLBACK_SERVERS];
    }

    // Shuffle servers for load distribution
    return this.shuffleArray([...servers]);
  }

  /**
   * Test server health with comprehensive metrics
   */
  async testServerHealth(server, timeout = CONFIG.HEALTH_CHECK_TIMEOUT) {
    const start = Date.now();
    const api = this.createApiInstance(server, timeout);

    try {
      // Test with a lightweight endpoint
      await api.get('/countries', { params: { limit: 1 } });

      const responseTime = Date.now() - start;
      const stats = {
        server,
        healthy: true,
        responseTime,
        timestamp: Date.now()
      };

      // Update health stats cache
      serverCache.healthStats.set(server, stats);

      return stats;
    } catch (error) {
      const stats = {
        server,
        healthy: false,
        responseTime: Infinity,
        error: error.message,
        timestamp: Date.now()
      };

      serverCache.healthStats.set(server, stats);
      return stats;
    }
  }

  /**
   * Get the best working server with health-based selection
   */
  async getBestWorkingServer(forceRefresh = false) {
    try {
      const servers = await this.discoverServers();

      // Test all servers in parallel with timeout
      const healthCheckPromises = servers.map(server =>
        Promise.race([
          this.testServerHealth(server),
          new Promise(resolve =>
            setTimeout(() => resolve({
              server,
              healthy: false,
              responseTime: Infinity,
              error: 'Timeout'
            }), CONFIG.HEALTH_CHECK_TIMEOUT + 1000)
          )
        ])
      );

      const healthResults = await Promise.all(healthCheckPromises);

      // Filter and sort healthy servers by response time
      const healthyServers = healthResults
        .filter(result => result.healthy)
        .sort((a, b) => a.responseTime - b.responseTime);

      if (healthyServers.length === 0) {
        throw new Error('No healthy Radio Browser servers found');
      }

      const bestServer = healthyServers[0];

      // Store backup servers for failover
      serverCache.servers = healthyServers.slice(0, 3); // Keep top 3

      return bestServer.server;
    } catch (error) {
      // Try fallback servers as last resort
      for (const fallbackServer of CONFIG.FALLBACK_SERVERS) {
        try {
          const healthResult = await this.testServerHealth(fallbackServer);
          if (healthResult.healthy) {
            return fallbackServer;
          }
        } catch (fallbackError) {
          continue;
        }
      }

      throw new Error('All Radio Browser servers are unavailable');
    }
  }

  /**
   * Get cached server with intelligent cache management
   */
  async getCachedServer(forceRefresh = false) {
    const now = Date.now();
    const isExpired = now - serverCache.timestamp > serverCache.ttl;

    // Check if we need to refresh
    if (forceRefresh || !serverCache.selectedServer || isExpired) {
      try {
        serverCache.selectedServer = await this.getBestWorkingServer(forceRefresh);
        serverCache.timestamp = now;
      } catch (error) {
        // If refresh fails and we have a cached server, use it
        if (serverCache.selectedServer && !forceRefresh) {
          return serverCache.selectedServer;
        }
        throw error;
      }
    }

    return serverCache.selectedServer;
  }

  /**
   * Create API instance with enhanced configuration
   */
  createApiInstance(baseURL, timeout = CONFIG.REQUEST_TIMEOUT) {
    return axios.create({
      baseURL: `${baseURL}/json`,
      timeout,
      headers: {
        'User-Agent': CONFIG.USER_AGENT,
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate'
      },
      // Enhanced axios configuration
      validateStatus: (status) => status < 500, // Don't throw on 4xx errors
      maxRedirects: 3,
      decompress: true
    });
  }

  /**
   * Get API instance with automatic server selection and failover
   */
  async getApiInstance(forceRefresh = false) {
    const server = await this.getCachedServer(forceRefresh);
    return this.createApiInstance(server);
  }

  /**
   * Execute request with retry logic and server failover
   */
  async executeRequest(requestFn, maxRetries = CONFIG.MAX_RETRIES) {
    let lastError;
    let retryCount = 0;

    while (retryCount <= maxRetries) {
      try {
        const forceRefresh = retryCount > 0;
        const api = await this.getApiInstance(forceRefresh);

        const response = await requestFn(api);

        // Validate response
        if (!response.data) {
          throw new Error('Empty response data');
        }

        // Reset retry count on success
        return response.data;

      } catch (error) {
        lastError = error;
        retryCount++;

        if (retryCount <= maxRetries) {
          // Calculate exponential backoff delay
          const delay = CONFIG.RETRY_DELAY * Math.pow(CONFIG.BACKOFF_MULTIPLIER, retryCount - 1);

          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        break;
      }
    }

    // All retries failed
    throw new Error(`Failed to execute request after ${maxRetries + 1} attempts: ${lastError?.message}`);
  }

  /**
   * Validate and sanitize request parameters
   */
  validateParams(params = {}) {
    const validated = {};

    // Limit validation
    if (params.limit !== undefined) {
      validated.limit = Math.min(Math.max(parseInt(params.limit) || CONFIG.DEFAULT_LIMIT, 1), CONFIG.MAX_LIMIT);
    }

    // Offset validation
    if (params.offset !== undefined) {
      validated.offset = Math.max(parseInt(params.offset) || 0, 0);
    }

    // String parameters - sanitize
    const stringParams = ['countrycode', 'tag', 'name', 'language', 'order'];
    stringParams.forEach(param => {
      if (params[param] && typeof params[param] === 'string') {
        validated[param] = params[param].trim().substring(0, 100); // Limit length
      }
    });

    // Boolean parameters
    if (params.reverse !== undefined) {
      validated.reverse = Boolean(params.reverse);
    }

    return validated;
  }

  /**
   * Build query parameters for API requests
   */
  buildQueryParams(params) {
    const queryParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });

    // Always hide broken stations
    queryParams.append('hidebroken', 'true');

    return queryParams.toString();
  }

  /**
   * Main method to get radio stations with enhanced error handling
   */
  async getRadioStations(params = {}) {
    const validatedParams = this.validateParams({
      ...params,
      limit: params.limit || CONFIG.DEFAULT_LIMIT,
      offset: params.offset || 0
    });

    return await this.executeRequest(async (api) => {
      const queryString = this.buildQueryParams(validatedParams);
      const response = await api.get(`/stations/search?${queryString}`);

      // Validate response structure
      if (!Array.isArray(response.data)) {
        throw new Error('Invalid response format: expected array');
      }

      return response;
    });
  }

  /**
   * Search stations by name with fuzzy matching support
   */
  async searchStationsByName(query, limit = 20) {
    if (!query || typeof query !== 'string') {
      throw new Error('Search query must be a non-empty string');
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      throw new Error('Search query must be at least 2 characters long');
    }

    return await this.getRadioStations({
      name: trimmedQuery,
      limit,
      order: 'clickcount',
      reverse: true
    });
  }

  /**
   * Get stations by country code (ISO 3166-1 alpha-2)
   */
 /**
 * Get stations by country code (ISO 3166-1 alpha-2)
 * Uses the dedicated /stations/bycountrycodeexact/{code} endpoint.
 */
async getStationsByCountry(countryCode, limit = 50) {
  if (!countryCode || typeof countryCode !== "string") {
    throw new Error("Country code must be a non-empty string");
  }

  // Radio Browser expects UPPERCASE ISO 3166-1 alpha-2 codes
  const normalizedCode = countryCode.toUpperCase().trim();
  if (!/^[A-Z]{2}$/.test(normalizedCode)) {
    throw new Error("Country code must be a valid 2-letter ISO country code");
  }

  // Clamp limit using the same rules as the rest of the service
  const safeLimit = Math.min(
    Math.max(parseInt(limit) || CONFIG.DEFAULT_LIMIT, 1),
    CONFIG.MAX_LIMIT
  );

  return await this.executeRequest(async (api) => {
    const response = await api.get(
      `/stations/bycountrycodeexact/${encodeURIComponent(normalizedCode)}`,
      {
        params: {
          // Order by most clicked, hide broken – matches your “popular” logic
          limit: safeLimit,
          hidebroken: "true",
          order: "clickcount",
          reverse: "true",
        },
      }
    );

    if (!Array.isArray(response.data)) {
      throw new Error("Invalid response format for getStationsByCountry");
    }

    // executeRequest will return response.data to the caller
    return response;
  });
}

  /**
   * Get stations by tag with improved filtering
   */
  async getStationsByTag(tag, limit = 50) {
    if (!tag || typeof tag !== 'string') {
      throw new Error('Tag must be a non-empty string');
    }

    const trimmedTag = tag.trim();
    if (trimmedTag.length === 0) {
      throw new Error('Tag cannot be empty');
    }

    return await this.getRadioStations({
      tag: trimmedTag,
      limit,
      order: 'clickcount',
      reverse: true
    });
  }

  /**
   * Get popular stations (most clicked)
   */
  async getPopularStations(limit = 50) {
    return await this.getRadioStations({
      limit,
      order: 'clickcount',
      reverse: true
    });
  }

  /**
   * Get countries list for UI dropdowns
   */
  async getCountries() {
    return await this.executeRequest(async (api) => {
      const response = await api.get('/countries');

      if (!Array.isArray(response.data)) {
        throw new Error('Invalid countries response format');
      }

      return response;
    });
  }

  /**
   * Get tags list for UI dropdowns
   */
  async getTags(limit = 100) {
    return await this.executeRequest(async (api) => {
      const queryString = limit ? `?limit=${limit}` : '';
      const response = await api.get(`/tags${queryString}`);

      if (!Array.isArray(response.data)) {
        throw new Error('Invalid tags response format');
      }

      return response;
    });
  }

  /**
   * Record a station click (helps mark popular stations)
   * This is important for the API ecosystem as mentioned in docs
   */
  async recordStationClick(stationUuid) {
    if (!stationUuid) {
      return false;
    }

    try {
      await this.executeRequest(async (api) => {
        return await api.get(`/url/${stationUuid}`);
      });

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get detailed server information and statistics
   */
  getServerInfo() {
    const healthStats = Array.from(serverCache.healthStats.entries()).map(([server, stats]) => ({
      server,
      ...stats
    }));

    return {
      currentServer: serverCache.selectedServer,
      cacheAge: serverCache.timestamp ? Date.now() - serverCache.timestamp : null,
      ttl: serverCache.ttl,
      availableServers: serverCache.servers.length,
      healthStats,
      config: {
        maxRetries: CONFIG.MAX_RETRIES,
        timeout: CONFIG.REQUEST_TIMEOUT,
        userAgent: CONFIG.USER_AGENT
      }
    };
  }

  /**
   * Manually refresh server cache (for admin/maintenance use)
   */
  async refreshServerCache() {
    return await this.getCachedServer(true);
  }

  /**
   * Utility method to shuffle array (Fisher-Yates)
   */
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Health check method for monitoring
   */
  async healthCheck() {
    try {
      const server = await this.getCachedServer();
      const api = this.createApiInstance(server, 5000);

      await api.get('/countries', { params: { limit: 1 } });

      return {
        status: 'healthy',
        server,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Create singleton instance
const radioBrowserService = new RadioBrowserService();

// Export the service methods
module.exports = {
  getRadioStations: (params) => radioBrowserService.getRadioStations(params),
  searchStationsByName: (query, limit) => radioBrowserService.searchStationsByName(query, limit),
  getStationsByCountry: (countryCode, limit) => radioBrowserService.getStationsByCountry(countryCode, limit),
  getStationsByTag: (tag, limit) => radioBrowserService.getStationsByTag(tag, limit),
  getPopularStations: (limit) => radioBrowserService.getPopularStations(limit),
  getCountries: () => radioBrowserService.getCountries(),
  getTags: (limit) => radioBrowserService.getTags(limit),
  recordStationClick: (stationUuid) => radioBrowserService.recordStationClick(stationUuid),
  refreshServerCache: () => radioBrowserService.refreshServerCache(),
  getServerInfo: () => radioBrowserService.getServerInfo(),
  healthCheck: () => radioBrowserService.healthCheck(),
  service: radioBrowserService
};
