import express from 'express';
import { getRadioStations } from './services/radioBrowserService'; // Adjust path as needed

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const stations = await getRadioStations(req.query);
    res.json(stations);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch radio stations' });
  }
});

export default router;