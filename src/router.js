const express = require('express');

const router = express.Router();

const {
  getAllInputs,
  getClientInputs,
  getTherapistInputs,
  processInputs,
  addFactor,
  searchInputs,
} = require('./controllers/inputController');

router.get('/', getAllInputs);
router.get('/client', getClientInputs);
router.get('/therapist', getTherapistInputs);
router.post('/submit', processInputs);
router.post('/add-factor', addFactor);
router.post('/search', searchInputs);

module.exports = router;
