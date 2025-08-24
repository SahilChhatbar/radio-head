const express = require('express');
const { 
  getRadioStations, 
  searchStationsByName, 
  getStationsByCountry, 
  getStationsByTag 
} = require('../services/radioBrowserService');

const router = express.Router();

// Get all stations with optional filters
router.get('/stations', async (req, res) => {
  try {
    const { limit = 50, offset = 0, countrycode, tag, name, language } = req.query;
    
    const params = {
      limit: parseInt(limit),
      offset: parseInt(offset),
      countrycode: countrycode,
      tag: tag,
      name: name,
      language: language,
    };

    const stations = await getRadioStations(params);
    res.json({
      success: true,
      data: stations,
      count: stations.length
    });
  } catch (error) {
    console.error('Error fetching radio stations:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch radio stations',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Search stations by name
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const stations = await searchStationsByName(q, parseInt(limit));
    res.json({
      success: true,
      data: stations,
      count: stations.length
    });
  } catch (error) {
    console.error('Error searching radio stations:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to search radio stations',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get stations by country
router.get('/country/:countryCode', async (req, res) => {
  try {
    const { countryCode } = req.params;
    const { limit = 50 } = req.query;

    const stations = await getStationsByCountry(countryCode, parseInt(limit));
    res.json({
      success: true,
      data: stations,
      count: stations.length
    });
  } catch (error) {
    console.error('Error fetching stations by country:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch stations by country',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get stations by tag
router.get('/tag/:tagName', async (req, res) => {
  try {
    const { tagName } = req.params;
    const { limit = 50 } = req.query;

    const stations = await getStationsByTag(tagName, parseInt(limit));
    res.json({
      success: true,
      data: stations,
      count: stations.length
    });
  } catch (error) {
    console.error('Error fetching stations by tag:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch stations by tag',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get popular stations
router.get('/popular', async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const stations = await getRadioStations({
      limit: parseInt(limit),
      order: 'clickcount',
      reverse: true
    });

    res.json({
      success: true,
      data: stations,
      count: stations.length
    });
  } catch (error) {
    console.error('Error fetching popular stations:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch popular stations',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

module.exports = router;