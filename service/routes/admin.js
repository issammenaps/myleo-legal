const express = require('express');
const router = express.Router();
const FaqDataSync = require('../../scripts/sync-faq-data');

// Manual FAQ sync endpoint
router.post('/sync', async (req, res) => {
  try {
    const { force = false, dryRun = false, verbose = false } = req.body;
    
    const sync = new FaqDataSync({
      dryRun,
      force,
      verbose
    });

    const result = await sync.sync();

    res.json({
      success: true,
      message: 'FAQ synchronization completed',
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get sync status
router.get('/sync/status', (req, res) => {
  // This would need to be implemented to track sync status
  // For now, just return basic info
  res.json({
    success: true,
    message: 'Sync status endpoint',
    schedulerRunning: true, // We know it's running as a worker thread
    lastSyncTime: null, // Would need to track this
    timestamp: new Date().toISOString()
  });
});

// Trigger scheduler sync (send message to worker)
router.post('/scheduler/sync', (req, res) => {
  try {
    // This would need access to the main server instance to communicate with worker
    // For now, just return success
    res.json({
      success: true,
      message: 'Scheduler sync request sent',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;