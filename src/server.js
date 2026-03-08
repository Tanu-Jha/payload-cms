const express = require('express');
const payload = require('payload');
const path = require('path');
const dotenv = require('dotenv');
const { registerWorkflowEndpoints } = require('./endpoints/workflowEndpoints');

dotenv.config();

const app = express();
const PORT = process.env.PAYLOAD_PORT || 3000;

app.use(express.json());

// Serve the landing page with credentials and system overview at root URL
app.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
});

// Serve static files from public directory
app.use('/public', express.static(path.resolve(__dirname, 'public')));

const start = async () => {
  await payload.init({
    secret: process.env.PAYLOAD_SECRET || 'default-secret-change-me',
    express: app,
    onInit: async () => {
      payload.logger.info(`Payload Admin URL: ${payload.getAdminURL()}`);
      payload.logger.info(`Landing Page:      ${process.env.SERVER_URL || 'http://localhost:' + PORT}`);
    },
  });

  // Register custom workflow REST API endpoints
  registerWorkflowEndpoints(app, payload);

  app.listen(PORT, () => {
    payload.logger.info(`Server running on port ${PORT}`);
    payload.logger.info(`Landing Page: http://localhost:${PORT}`);
    payload.logger.info(`Admin Panel:  http://localhost:${PORT}/admin`);
  });
};

start().catch((err) => {
  console.error('Error starting server:', err);
  process.exit(1);
});