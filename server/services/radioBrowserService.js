const axios = require('axios');

// Radio Browser API server list - we'll use multiple servers for failover
const RADIO_BROWSER_SERVERS = [
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

// Get working server (with failover)
const getWorkingServer = async () => {
  for (const server of RADIO_BROWSER_SERVERS) {
    try {
      const api = createRadioApi(server);
      await api.get('/countries');
      return server;
    } catch (error) {
      console.warn(`Server ${server} is not responding, trying next...`);
      continue;
    }
  }
  throw new Error('All Radio Browser servers are unavailable');
};

// Cached working server
let cachedServer = null;

const getApi = async () => {
  if (!cachedServer) {
    cachedServer = await getWorkingServer();
  }
  return createRadioApi(cachedServer);
};

/**
 * Fetches radio stations with optional filters
 * @param {Object} params - Optional parameters to filter the stations
 * @returns {Promise<Array>} A promise that resolves to an array of station objects
 */
const getRadioStations = async (params = {}) => {
  try {
    const api = await getApi();
    const queryParams = new URLSearchParams();

    // Add parameters
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
    // Reset cached server on error and retry once
    if (cachedServer) {
      cachedServer = null;
      return getRadioStations(params);
    }
    
    console.error('Error fetching radio stations:', error);
    throw new Error('Failed to fetch radio stations');
  }
};

/**
 * Search stations by name
 * @param {string} query - Search query
 * @param {number} limit - Number of results to return
 * @returns {Promise<Array>} A promise that resolves to an array of station objects
 */
const searchStationsByName = async (query, limit = 20) => {
  return getRadioStations({
    name: query,
    limit,
    order: 'clickcount',
    reverse: true
  });
};

/**
 * Get stations by country
 * @param {string} countryCode - Country code
 * @param {number} limit - Number of results to return
 * @returns {Promise<Array>} A promise that resolves to an array of station objects
 */
const getStationsByCountry = async (countryCode, limit = 50) => {
  return getRadioStations({
    countrycode: countryCode.toLowerCase(),
    limit,
    order: 'clickcount',
    reverse: true
  });
};

/**
 * Get stations by tag
 * @param {string} tag - Tag name
 * @param {number} limit - Number of results to return
 * @returns {Promise<Array>} A promise that resolves to an array of station objects
 */
const getStationsByTag = async (tag, limit = 50) => {
  return getRadioStations({
    tag,
    limit,
    order: 'clickcount',
    reverse: true
  });
};

/**
 * Get popular stations
 * @param {number} limit - Number of results to return
 * @returns {Promise<Array>} A promise that resolves to an array of station objects
 */
const getPopularStations = async (limit = 50) => {
  return getRadioStations({
    limit,
    order: 'clickcount',
    reverse: true
  });
};

/**
 * Get countries list
 * @returns {Promise<Array>} A promise that resolves to an array of country objects
 */
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

/**
 * Get tags list
 * @returns {Promise<Array>} A promise that resolves to an array of tag objects
 */
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

module.exports = {
  getRadioStations,
  searchStationsByName,
  getStationsByCountry,
  getStationsByTag,
  getPopularStations,
  getCountries,
  getTags
};