const express = require('express');
const payload = require('payload');
const dotenv = require('dotenv');
const { registerWorkflowEndpoints } = require('./endpoints/workflowEndpoints');

dotenv.config();

const app = express();
const PORT = process.env.PAYLOAD_PORT || 3000;

app.use(express.json());

const start = async () => {
  await payload.init({
    secret: process.env.PAYLOAD_SECRET || 'default-secret-change-me',
    express: app,
    onInit: async () => {
      payload.logger.info(`Payload Admin URL: ${payload.getAdminURL()}`);
    },
  });

  // Register custom workflow REST API endpoints
  registerWorkflowEndpoints(app, payload);

  app.listen(PORT, () => {
    payload.logger.info(`Server running on port ${PORT}`);
  });
};

start().catch((err) => {
  console.error('Error starting server:', err);
  process.exit(1);
});
