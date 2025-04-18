const express = require('express');

const router = express.Router();

const {
  getAllInputs,
  getClientInputs,
  getTherapistInputs,
  processInputs,
} = require('./controllers/inputController');

router.get('/', getAllInputs);
router.get('/client', getClientInputs);
router.get('/therapist', getTherapistInputs);
router.post('/submit', processInputs);

module.exports = router;
