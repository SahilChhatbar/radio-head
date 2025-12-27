const express = require('express');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

// @desc    Get user's favorite stations
// @route   GET /api/favorites
router.get('/', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('favoriteStations');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user.favoriteStations || [],
      count: user.favoriteStations?.length || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch favorite stations',
      error: error.message
    });
  }
});

// @desc    Add station to favorites
// @route   POST /api/favorites
router.post('/', protect, async (req, res, next) => {
  try {
    const { station } = req.body;

    if (!station || !station.stationuuid) {
      return res.status(400).json({
        success: false,
        message: 'Station data with stationuuid is required'
      });
    }

    const user = await User.findById(req.user._id).select('favoriteStations');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const existingIndex = user.favoriteStations.findIndex(
      fav => fav.stationuuid === station.stationuuid
    );

    if (existingIndex !== -1) {
      return res.status(400).json({
        success: false,
        message: 'Station already in favorites'
      });
    }

    await User.updateOne(
      { _id: req.user._id },
      {
        $push: {
          favoriteStations: {
            stationuuid: station.stationuuid,
            name: station.name,
            url: station.url,
            url_resolved: station.url_resolved,
            favicon: station.favicon,
            country: station.country,
            countrycode: station.countrycode,
            codec: station.codec,
            bitrate: station.bitrate,
            votes: station.votes,
            clickcount: station.clickcount,
            addedAt: new Date()
          }
        }
      }
    );

    const updatedUser = await User.findById(req.user._id).select('favoriteStations');

    res.status(201).json({
      success: true,
      message: 'Station added to favorites',
      data: updatedUser.favoriteStations,
      count: updatedUser.favoriteStations.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add station to favorites',
      error: error.message
    });
  }
});

// @desc    Remove station from favorites
// @route   DELETE /api/favorites/:stationUuid
router.delete('/:stationUuid', protect, async (req, res, next) => {
  try {
    const { stationUuid } = req.params;

    const user = await User.findById(req.user._id).select('favoriteStations');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const exists = user.favoriteStations.some(
      fav => fav.stationuuid === stationUuid
    );

    if (!exists) {
      return res.status(404).json({
        success: false,
        message: 'Station not found in favorites'
      });
    }

    await User.updateOne(
      { _id: req.user._id },
      {
        $pull: {
          favoriteStations: { stationuuid: stationUuid }
        }
      }
    );

    const updatedUser = await User.findById(req.user._id).select('favoriteStations');

    res.json({
      success: true,
      message: 'Station removed from favorites',
      data: updatedUser.favoriteStations,
      count: updatedUser.favoriteStations.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove station from favorites',
      error: error.message
    });
  }
});

// @desc    Check if station is favorited
// @route   GET /api/favorites/check/:stationUuid
router.get('/check/:stationUuid', protect, async (req, res, next) => {
  try {
    const { stationUuid } = req.params;
    const user = await User.findById(req.user._id).select('favoriteStations');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isFavorited = user.favoriteStations.some(
      fav => fav.stationuuid === stationUuid
    );

    res.json({
      success: true,
      data: { isFavorited },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Check favorite error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check favorite status',
      error: error.message
    });
  }
});

module.exports = router;