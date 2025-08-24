import axios from 'axios';

// Create a dedicated Axios instance for the Radio Browser API.
// This is useful for setting a base URL and other default configurations.
const radioApi = axios.create({
  baseURL: 'https://de1.radiobrowser.info/json',
  timeout: 10000, // 10-second timeout
});

/**
 * Fetches a list of radio stations from the Radio Browser API.
 * @param {object} params - Optional parameters to filter the stations (e.g., { countryCode: 'US', tag: 'rock' }).
 * @returns {Promise<Array<object>>} A promise that resolves to an array of station objects.
 * @throws Will throw an error if the network request fails.
 */
export const getRadioStations = async (params = {}) => {
  // Build the search path based on provided parameters
  const path = '/stations/search';
  const queryParams = new URLSearchParams();

  if (params.countryCode) {
    queryParams.append('countrycode', params.countryCode);
  }
  if (params.tag) {
    queryParams.append('tag', params.tag);
  }
  if (params.name) {
    queryParams.append('name', params.name);
  }
  queryParams.append('limit', (params.limit || 100).toString()); // Default limit to 100
  queryParams.append('hidebroken', 'true'); // Hide stations that are known to be broken

  try {
    const response = await radioApi.get(`${path}?${queryParams.toString()}`);
    return response.data;
  } catch (error) {
    // Provide more detailed error logging
    if (axios.isAxiosError(error)) {
      console.error(`Axios error fetching radio stations: ${error.message}`);
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
      }
    } else {
      console.error('An unexpected error occurred:', error);
    }

    // Re-throw the error so the calling component can handle it
    throw new Error('Failed to fetch radio stations.');
  }
};
