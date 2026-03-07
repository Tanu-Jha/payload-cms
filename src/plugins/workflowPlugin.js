/**
 * workflowPlugin - Payload CMS plugin that automatically hooks into
 * watched collections and triggers the workflow engine on create/update.
 */

const { WorkflowEngine } = require('../engine/workflowEngine');

const workflowPlugin = (options) => {
  const {
    watchedCollections = [],
    enableSLAEscalation = true,
    slaCheckInterval = 5 * 60 * 1000, // 5 minutes
  } = options;

  return (incomingConfig) => {
    const config = { ...incomingConfig };
    const collections = [...(config.collections || [])];

    let engineInstance = null;
    let slaIntervalId = null;

    // Factory: create an afterChange hook for each watched collection
    const createWorkflowHook = (collectionSlug) => {
      return async ({ doc, req, operation, previousDoc }) => {
        // Avoid re-triggering from the engine's own updates
        if (req.__workflowEngineUpdate) {
          return doc;
        }

        // Skip if workflow is already in progress and this is just an update
        if (
          operation === 'update' &&
          doc.workflowStatus === 'in_progress' &&
          previousDoc?.workflowStatus === 'in_progress'
        ) {
          return doc;
        }

        try {
          if (!engineInstance) {
            engineInstance = new WorkflowEngine(req.payload);

            // Start SLA escalation checker
            if (enableSLAEscalation && !slaIntervalId) {
              slaIntervalId = setInterval(async () => {
                try {
                  await engineInstance.checkAndEscalateSLAs();
                } catch (err) {
                  req.payload.logger.error(`SLA check error: ${err}`);
                }
              }, slaCheckInterval);

              req.payload.logger.info(
                `SLA escalation checker started (interval: ${slaCheckInterval / 1000}s)`
              );
            }
          }

          const mapOp = operation === 'create' ? 'create' : 'update';
          const matchingWorkflows = await engineInstance.findMatchingWorkflows(
            collectionSlug, doc, mapOp
          );

          for (const workflow of matchingWorkflows) {
            req.payload.logger.info(
              `Triggering workflow "${workflow.name}" for ${collectionSlug}/${doc.id}`
            );
            req.__workflowEngineUpdate = true;
            await engineInstance.startWorkflow(workflow, collectionSlug, doc.id, doc, req.user?.id);
            req.__workflowEngineUpdate = false;
          }
        } catch (err) {
          req.payload.logger.error(`Workflow plugin error: ${err}`);
        }

        return doc;
      };
    };

    // Attach hooks to watched collections
    config.collections = collections.map((collection) => {
      if (typeof collection === 'object' && watchedCollections.includes(collection.slug)) {
        const existingHooks = collection.hooks || {};
        const existingAfterChange = existingHooks.afterChange || [];

        return {
          ...collection,
          hooks: {
            ...existingHooks,
            afterChange: [...existingAfterChange, createWorkflowHook(collection.slug)],
          },
        };
      }
      return collection;
    });

    return config;
  };
};

module.exports = { workflowPlugin };
