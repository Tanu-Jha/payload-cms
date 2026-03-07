/**
 * Custom REST API Endpoints for the Workflow Management System.
 *
 * 1. POST /api/workflows/trigger      – Manually trigger a workflow on a document
 * 2. GET  /api/workflows/status/:docId – Get workflow + step status for a document
 * 3. POST /api/workflows/action        – Perform an action on a step (approve/reject/review/comment)
 * 4. POST /api/workflows/escalate-sla  – Manually trigger SLA escalation check
 */

const { WorkflowEngine } = require('../engine/workflowEngine');

function registerWorkflowEndpoints(app, payload) {
  const engine = new WorkflowEngine(payload);

  // ────────────────────────────────────────────────────────────
  // POST /api/workflows/trigger
  // ────────────────────────────────────────────────────────────
  app.post('/api/workflows/trigger', async (req, res) => {
    try {
      const { workflowId, collectionSlug, documentId } = req.body;

      if (!workflowId || !collectionSlug || !documentId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: workflowId, collectionSlug, documentId',
        });
      }

      let workflow;
      try {
        workflow = await payload.findByID({ collection: 'workflows', id: workflowId });
      } catch (err) {
        return res.status(404).json({ success: false, error: `Workflow "${workflowId}" not found` });
      }

      if (!workflow.isActive) {
        return res.status(400).json({ success: false, error: 'Workflow is inactive' });
      }

      let doc;
      try {
        doc = await payload.findByID({ collection: collectionSlug, id: documentId });
      } catch (err) {
        return res.status(404).json({ success: false, error: `Document "${documentId}" not found in "${collectionSlug}"` });
      }

      const userId = req.user?.id;
      const instance = await engine.startWorkflow(workflow, collectionSlug, documentId, doc, userId);

      return res.status(200).json({
        success: true,
        message: `Workflow "${workflow.name}" triggered successfully`,
        data: {
          instanceId: instance.id,
          workflow: workflow.name,
          document: `${collectionSlug}/${documentId}`,
          status: instance.status,
          currentStep: instance.currentStepIndex,
        },
      });
    } catch (error) {
      payload.logger.error(`POST /api/workflows/trigger error: ${error.message}`);
      return res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
    }
  });

  // ────────────────────────────────────────────────────────────
  // GET /api/workflows/status/:docId
  // ────────────────────────────────────────────────────────────
  app.get('/api/workflows/status/:docId', async (req, res) => {
    try {
      const { docId } = req.params;
      const collectionSlug = req.query.collection;

      if (!docId) {
        return res.status(400).json({ success: false, error: 'Missing document ID' });
      }

      const whereConditions = [{ documentId: { equals: docId } }];
      if (collectionSlug) {
        whereConditions.push({ documentCollection: { equals: collectionSlug } });
      }

      const { docs: instances } = await payload.find({
        collection: 'workflow-instances',
        where: { and: whereConditions },
        depth: 2,
        sort: '-createdAt',
        limit: 50,
      });

      if (instances.length === 0) {
        return res.status(404).json({ success: false, error: `No workflows found for document "${docId}"` });
      }

      const instancesWithLogs = await Promise.all(
        instances.map(async (instance) => {
          const { docs: logs } = await payload.find({
            collection: 'workflow-logs',
            where: { workflowInstance: { equals: instance.id } },
            sort: 'timestamp',
            limit: 200,
          });

          const workflow = instance.workflow;
          return {
            instanceId: instance.id,
            workflow: {
              id: workflow?.id || instance.workflow,
              name: workflow?.name || 'Unknown',
            },
            documentCollection: instance.documentCollection,
            documentId: instance.documentId,
            status: instance.status,
            currentStepIndex: instance.currentStepIndex,
            steps: (instance.stepStatuses || []).map((step) => ({
              stepId: step.stepId,
              stepName: step.stepName,
              stepOrder: step.stepOrder,
              status: step.status,
              assignedTo: step.assignedTo,
              completedBy: step.completedBy,
              completedAt: step.completedAt,
              comment: step.comment,
              slaDeadline: step.slaDeadline,
              isOverdue: step.isOverdue,
            })),
            logs: logs.map((log) => ({
              action: log.action,
              stepName: log.stepName,
              user: log.userName || log.user,
              userRole: log.userRole,
              comment: log.comment,
              timestamp: log.timestamp,
            })),
            startedAt: instance.startedAt,
            completedAt: instance.completedAt,
          };
        })
      );

      return res.status(200).json({
        success: true,
        data: {
          documentId: docId,
          collection: collectionSlug || 'all',
          totalInstances: instancesWithLogs.length,
          instances: instancesWithLogs,
        },
      });
    } catch (error) {
      payload.logger.error(`GET /api/workflows/status error: ${error.message}`);
      return res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
    }
  });

  // ────────────────────────────────────────────────────────────
  // POST /api/workflows/action
  // ────────────────────────────────────────────────────────────
  app.post('/api/workflows/action', async (req, res) => {
    try {
      const { instanceId, action, comment } = req.body;

      if (!instanceId || !action) {
        return res.status(400).json({ success: false, error: 'Missing: instanceId, action' });
      }

      const validActions = ['approved', 'rejected', 'reviewed', 'commented'];
      if (!validActions.includes(action)) {
        return res.status(400).json({ success: false, error: `Invalid action. Use: ${validActions.join(', ')}` });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const result = await engine.performAction(instanceId, action, userId, comment);
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      payload.logger.error(`POST /api/workflows/action error: ${error.message}`);
      return res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
    }
  });

  // ────────────────────────────────────────────────────────────
  // POST /api/workflows/escalate-sla
  // ────────────────────────────────────────────────────────────
  app.post('/api/workflows/escalate-sla', async (req, res) => {
    try {
      await engine.checkAndEscalateSLAs();
      return res.status(200).json({ success: true, message: 'SLA escalation check completed' });
    } catch (error) {
      return res.status(500).json({ success: false, error: 'SLA escalation check failed' });
    }
  });

  payload.logger.info('Custom workflow API endpoints registered:');
  payload.logger.info('  POST /api/workflows/trigger');
  payload.logger.info('  GET  /api/workflows/status/:docId');
  payload.logger.info('  POST /api/workflows/action');
  payload.logger.info('  POST /api/workflows/escalate-sla');
}

module.exports = { registerWorkflowEndpoints };
