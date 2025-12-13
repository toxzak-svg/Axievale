const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const routes = require('./api/routes');

const app = express();

// Middleware
app.use(express.json());

// Configure CORS: allow listed origins, chrome-extension scheme, or no-origin (server-to-server)
const allowedOrigins = config.corsAllowedOrigins || [];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests without origin (curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.startsWith('chrome-extension://')) return callback(null, true);
    return callback(new Error('CORS not allowed'), false);
  }
}));
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api', routes);

// Serve index.html for SPA routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: config.nodeEnv === 'production' ? 'Internal Server Error' : err.message
  });
});

// Start server
if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`Axievale server running on port ${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(`API available at: http://localhost:${config.port}/api`);
  });
}

module.exports = app;
