const express = require('express');
const router = express.Router();

/* API routes */
router.use('/notes', require('./api/notesRoutes'));
router.use('/conc',  require('./api/concRouter'));

module.exports = router;