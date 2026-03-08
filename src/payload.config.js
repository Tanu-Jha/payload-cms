const { buildConfig } = require('payload/config');
const { mongooseAdapter } = require('@payloadcms/db-mongodb');
const { webpackBundler } = require('@payloadcms/bundler-webpack');
const { slateEditor } = require('@payloadcms/richtext-slate');
const path = require('path');

const { Users } = require('./collections/Users');
const { Blogs } = require('./collections/Blogs');
const { Contracts } = require('./collections/Contracts');
const { Workflows } = require('./collections/Workflows');
const { WorkflowInstances } = require('./collections/WorkflowInstances');
const { WorkflowLogs } = require('./collections/WorkflowLogs');
const { workflowPlugin } = require('./plugins/workflowPlugin');

module.exports = buildConfig({
  serverURL: process.env.SERVER_URL || '',
  cors: process.env.SERVER_URL ? [process.env.SERVER_URL, 'http://localhost:3000'] : '*',
  admin: {
    user: Users.slug,
    bundler: webpackBundler(),
    meta: {
      titleSuffix: '- Workflow Management System',
    },
    webpack: (config) => ({
      ...config,
      resolve: {
        ...config.resolve,
        alias: {
          ...(config.resolve?.alias || {}),
          dotenv: path.resolve(__dirname, './mocks/emptyModule.js'),
        },
      },
    }),
  },
  editor: slateEditor({}),
  db: mongooseAdapter({
    url: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/workflow-cms',
  }),
  collections: [
    Users,
    Blogs,
    Contracts,
    Workflows,
    WorkflowInstances,
    WorkflowLogs,
  ],
  plugins: [
    workflowPlugin({
      watchedCollections: ['blogs', 'contracts'],
      enableEmailNotifications: true,
      enableSLAEescalation: true,
    }),
  ],
});
