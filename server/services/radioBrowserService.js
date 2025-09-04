const axios = require('axios');
const dns = require('dns').promises;
// Fallback servers in case DNS discovery fails
const FALLBACK_SERVERS = [
  'https://de1.api.radio-browser.info',
  'https://nl1.api.radio-browser.info',
  'https://at1.api.radio-browser.info'
];
// Create axios instance with retry logic
const createRadioApi = (baseURL) => axios.create({
  baseURL: `${baseURL}/json`,
  timeout: 10000,
  headers: {
    'User-Agent': 'RadioHead/1.0'
  }
});

const discoverServersViaSRV = async () => {
  try {
    const srvRecords = await dns.resolveSrv('_api._tcp.radio-browser.info');
    const discoveredServers = srvRecords
      .sort((a, b) => a.priority - b.priority || a.weight - b.weight)
      .map(record => `https://${record.name}`);
    console.log(`Discovered ${discoveredServers.length} Radio Browser servers via SRV records`);
    return discoveredServers;
  } catch (error) {
    console.warn('SRV record discovery failed:', error.message);
    return null;
  }
};

const discoverServersViaA = async () => {
  try {
    const aRecords = await dns.resolve4('all.api.radio-browser.info');
    const reversePromises = aRecords.map(async (ip) => {
      try {
        const hostnames = await dns.reverse(ip);
        const radioBrowserHost = hostnames.find(host =>
          host.includes('api.radio-browser.info')
        );
        return radioBrowserHost ? `https://${radioBrowserHost}` : `https://${ip}`;
      } catch (reverseError) {
        return `https://${ip}`;
      }
    });
    const discoveredServers = await Promise.all(reversePromises);
    console.log(`Discovered ${discoveredServers.length} Radio Browser servers via A records`);
    return discoveredServers;
  } catch (error) {
    console.warn('A record discovery failed:', error.message);
    return null;
  }
};

const discoverServers = async () => {
  let servers = await discoverServersViaSRV();
  if (!servers || servers.length === 0) {
    servers = await discoverServersViaA();
  }
  if (!servers || servers.length === 0) {
    console.warn('DNS discovery failed completely, using fallback servers');
    return FALLBACK_SERVERS;
  }
  return servers;
};

const testServerHealth = async (server) => {
  const start = Date.now();
  try {
    const api = createRadioApi(server);
    await api.get('/countries');
    const responseTime = Date.now() - start;
    return { server, healthy: true, responseTime };
  } catch (error) {
    return { server, healthy: false, responseTime: Infinity, error: error.message };
  }
};

const getBestWorkingServer = async () => {
  try {
    const servers = await discoverServers();
    console.log(`Testing ${servers.length} servers for health and response time...`);
    const healthChecks = await Promise.allSettled(
      servers.map(server => testServerHealth(server))
    );
    const healthyServers = healthChecks
      .filter(result => result.status === 'fulfilled' && result.value.healthy)
      .map(result => result.value)
      .sort((a, b) => a.responseTime - b.responseTime);
    if (healthyServers.length === 0) {
      throw new Error('No healthy Radio Browser servers found');
    }
    const bestServer = healthyServers[0];
    console.log(`Selected server: ${bestServer.server} (${bestServer.responseTime}ms)`);
    return bestServer.server;
  } catch (error) {
    console.error('Error finding best server:', error.message);
    throw new Error('All Radio Browser servers are unavailable');
  }
};

let serverCache = {
  server: null,
  timestamp: 0,
  ttl: 10 * 60 * 1000
};

const getCachedServer = async (forceRefresh = false) => {
  const now = Date.now();
  const isExpired = now - serverCache.timestamp > serverCache.ttl;
  if (forceRefresh || !serverCache.server || isExpired) {
    console.log('Refreshing server cache...');
    serverCache.server = await getBestWorkingServer();
    serverCache.timestamp = now;
  }
  return serverCache.server;
};
const getApi = async (forceRefresh = false) => {
  const server = await getCachedServer(forceRefresh);
  return createRadioApi(server);
};

const getRadioStations = async (params = {}) => {
  let retryCount = 0;
  const maxRetries = 2;
  while (retryCount <= maxRetries) {
    try {
      const api = await getApi(retryCount > 0);
      const queryParams = new URLSearchParams();
      if (params.countrycode) queryParams.append('countrycode', params.countrycode);
      if (params.tag) queryParams.append('tag', params.tag);
      if (params.name) queryParams.append('name', params.name);
      if (params.language) queryParams.append('language', params.language);
      if (params.order) queryParams.append('order', params.order);
      if (params.reverse) queryParams.append('reverse', 'true');
      queryParams.append('limit', (params.limit || 50).toString());
      queryParams.append('offset', (params.offset || 0).toString());
      queryParams.append('hidebroken', 'true');
      const response = await api.get(`/stations/search?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      retryCount++;
      console.warn(`Request failed (attempt ${retryCount}):`, error.message);
      if (retryCount <= maxRetries) {
        console.log('Retrying with server refresh...');
        continue;
      }
      console.error('Error fetching radio stations after all retries:', error);
      throw new Error('Failed to fetch radio stations after multiple attempts');
    }
  }
};

const searchStationsByName = async (query, limit = 20) => {
  return getRadioStations({
    name: query,
    limit,
    order: 'clickcount',
    reverse: true
  });
};

const getStationsByCountry = async (countryCode, limit = 50) => {
  return getRadioStations({
    countrycode: countryCode.toLowerCase(),
    limit,
    order: 'clickcount',
    reverse: true
  });
};

const getStationsByTag = async (tag, limit = 50) => {
  return getRadioStations({
    tag,
    limit,
    order: 'clickcount',
    reverse: true
  });
};

const getPopularStations = async (limit = 50) => {
  return getRadioStations({
    limit,
    order: 'clickcount',
    reverse: true
  });
};

const getCountries = async () => {
  try {
    const api = await getApi();
    const response = await api.get('/countries');
    return response.data;
  } catch (error) {
    console.error('Error fetching countries:', error);
    throw new Error('Failed to fetch countries');
  }
};

const getTags = async () => {
  try {
    const api = await getApi();
    const response = await api.get('/tags');
    return response.data;
  } catch (error) {
    console.error('Error fetching tags:', error);
    throw new Error('Failed to fetch tags');
  }
};

const refreshServerCache = async () => {
  return getCachedServer(true);
};

const getServerInfo = () => {
  return {
    currentServer: serverCache.server,
    cacheAge: serverCache.timestamp ? Date.now() - serverCache.timestamp : null,
    ttl: serverCache.ttl
  };
};

const getAllServers = async () => {
  return discoverServers();
};
module.exports = {
  getRadioStations,
  searchStationsByName,
  getStationsByCountry,
  getStationsByTag,
  getPopularStations,
  getCountries,
  getTags,
  refreshServerCache,
  getServerInfo,
  getAllServers,
  discoverServers
};






