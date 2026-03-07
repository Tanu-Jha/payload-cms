/**
 * WorkflowEngine - Core logic for evaluating and advancing workflows.
 *
 * Handles:
 *  - Evaluating trigger conditions on documents
 *  - Starting new workflow instances
 *  - Advancing workflow steps based on user actions
 *  - Conditional branching between steps
 *  - SLA deadline computation & auto-escalation
 *  - Logging all actions to the immutable audit trail
 *  - Simulated email notifications (console logs)
 */

// ─── Condition Evaluator Helpers ─────────────────────────────────────────────

/**
 * Get a nested value from an object using a dot-separated path.
 * e.g. getNestedValue({ a: { b: 5 } }, 'a.b') → 5
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => {
    if (current === undefined || current === null) return undefined;
    return current[key];
  }, obj);
}

/**
 * Evaluate a single field condition against a document.
 */
function evaluateCondition(doc, condition) {
  const fieldValue = getNestedValue(doc, condition.fieldPath);
  const compareValue = condition.value;

  switch (condition.operator) {
    case 'equals':
      return String(fieldValue) === String(compareValue);
    case 'not_equals':
      return String(fieldValue) !== String(compareValue);
    case 'greater_than': {
      const numField = parseFloat(fieldValue);
      const numCompare = parseFloat(compareValue);
      if (isNaN(numField) || isNaN(numCompare)) return false;
      return numField > numCompare;
    }
    case 'less_than': {
      const numField = parseFloat(fieldValue);
      const numCompare = parseFloat(compareValue);
      if (isNaN(numField) || isNaN(numCompare)) return false;
      return numField < numCompare;
    }
    case 'contains':
      return String(fieldValue || '').toLowerCase().includes(String(compareValue).toLowerCase());
    case 'exists':
      return compareValue === 'true'
        ? fieldValue !== undefined && fieldValue !== null && fieldValue !== ''
        : fieldValue === undefined || fieldValue === null || fieldValue === '';
    default:
      return false;
  }
}

/**
 * Evaluate all conditions (AND logic). Returns true if all pass.
 */
function evaluateAllConditions(doc, conditions) {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((cond) => evaluateCondition(doc, cond));
}

// ─── Workflow Engine Class ───────────────────────────────────────────────────

class WorkflowEngine {
  constructor(payload) {
    this.payload = payload;
  }

  /**
   * Find all active workflows targeting a collection that match trigger conditions.
   */
  async findMatchingWorkflows(collectionSlug, doc, operation) {
    const { docs: workflows } = await this.payload.find({
      collection: 'workflows',
      where: {
        and: [
          { targetCollection: { equals: collectionSlug } },
          { isActive: { equals: true } },
        ],
      },
      limit: 100,
    });

    return workflows.filter((wf) => {
      const triggerOn = wf.triggerConditions?.triggerOn || 'both';
      if (triggerOn === 'manual') return false;
      if (triggerOn === 'create' && operation !== 'create') return false;
      if (triggerOn === 'update' && operation !== 'update') return false;

      const fieldConditions = wf.triggerConditions?.fieldConditions;
      if (fieldConditions && fieldConditions.length > 0) {
        return evaluateAllConditions(doc, fieldConditions);
      }
      return true;
    });
  }

  /**
   * Start a new workflow instance on a document.
   */
  async startWorkflow(workflow, collectionSlug, documentId, doc, userId) {
    // Check for existing active instance
    const { docs: existing } = await this.payload.find({
      collection: 'workflow-instances',
      where: {
        and: [
          { workflow: { equals: workflow.id } },
          { documentId: { equals: documentId } },
          { status: { in: ['pending', 'in_progress'] } },
        ],
      },
      limit: 1,
    });

    if (existing.length > 0) {
      this.payload.logger.info(
        `Workflow "${workflow.name}" already active for ${collectionSlug}/${documentId}`
      );
      return existing[0];
    }

    // Sort steps by order
    const sortedSteps = [...workflow.steps].sort((a, b) => a.stepOrder - b.stepOrder);

    // Build step statuses
    const stepStatuses = sortedSteps.map((step) => ({
      stepId: step.id,
      stepName: step.stepName,
      stepOrder: step.stepOrder,
      status: 'pending',
      assignedTo:
        step.assigneeType === 'user'
          ? (typeof step.assignedUser === 'object' ? step.assignedUser?.id : step.assignedUser)
          : (step.assignedRole || ''),
      slaDeadline: step.slaHours
        ? new Date(Date.now() + step.slaHours * 3600 * 1000).toISOString()
        : undefined,
      isOverdue: false,
    }));

    // Find first applicable step
    const firstStepIndex = this._findNextApplicableStep(sortedSteps, doc, -1, undefined);

    if (firstStepIndex >= 0 && stepStatuses[firstStepIndex]) {
      stepStatuses[firstStepIndex].status = 'active';
      const activeStep = sortedSteps[firstStepIndex];
      if (activeStep.slaHours) {
        stepStatuses[firstStepIndex].slaDeadline = new Date(
          Date.now() + activeStep.slaHours * 3600 * 1000
        ).toISOString();
      }
    }

    // Create the instance
    const instance = await this.payload.create({
      collection: 'workflow-instances',
      data: {
        workflow: workflow.id,
        documentCollection: collectionSlug,
        documentId,
        status: 'in_progress',
        currentStepIndex: firstStepIndex >= 0 ? firstStepIndex : 0,
        stepStatuses,
        startedAt: new Date().toISOString(),
        initiatedBy: userId || undefined,
      },
    });

    // Update source document with workflow references
    try {
      await this.payload.update({
        collection: collectionSlug,
        id: documentId,
        data: {
          workflowStatus: 'in_progress',
          currentWorkflowStep: firstStepIndex >= 0 ? firstStepIndex : 0,
          activeWorkflowInstance: instance.id,
        },
        depth: 0,
      });
    } catch (err) {
      this.payload.logger.error(`Failed to update document workflow fields: ${err}`);
    }

    // Log: workflow started
    await this._createLog({
      workflowInstance: instance.id,
      workflow: workflow.id,
      documentCollection: collectionSlug,
      documentId,
      action: 'workflow_started',
      user: userId,
      comment: `Workflow "${workflow.name}" started`,
    });

    // Log: first step activated + send notification
    if (firstStepIndex >= 0) {
      const firstStep = sortedSteps[firstStepIndex];
      await this._createLog({
        workflowInstance: instance.id,
        workflow: workflow.id,
        documentCollection: collectionSlug,
        documentId,
        stepId: firstStep.id,
        stepName: firstStep.stepName,
        action: 'step_activated',
        user: userId,
        comment: `Step "${firstStep.stepName}" is now active`,
      });
      this._sendNotification(firstStep, workflow.name, collectionSlug, documentId);
    }

    this.payload.logger.info(
      `Workflow "${workflow.name}" started for ${collectionSlug}/${documentId} (instance: ${instance.id})`
    );

    return instance;
  }

  /**
   * Perform an action (approve/reject/review/comment) on the current step.
   */
  async performAction(instanceId, action, userId, comment) {
    const instance = await this.payload.findByID({
      collection: 'workflow-instances',
      id: instanceId,
      depth: 2,
    });

    if (!instance) {
      return { success: false, message: 'Workflow instance not found' };
    }
    if (instance.status !== 'in_progress') {
      return { success: false, message: `Workflow is already ${instance.status}` };
    }

    const workflow = instance.workflow;
    if (!workflow || !workflow.steps) {
      return { success: false, message: 'Workflow definition not found' };
    }

    const currentIndex = instance.currentStepIndex;
    const stepStatuses = instance.stepStatuses || [];
    const sortedSteps = [...workflow.steps].sort((a, b) => a.stepOrder - b.stepOrder);

    if (currentIndex < 0 || currentIndex >= sortedSteps.length) {
      return { success: false, message: 'Invalid step index' };
    }

    const currentStep = sortedSteps[currentIndex];

    // Permission check
    const canAct = await this._checkStepPermission(currentStep, userId);
    if (!canAct) {
      return { success: false, message: 'You do not have permission to act on this step' };
    }

    // Determine step completion status
    let stepStatus;
    switch (action) {
      case 'approved': stepStatus = 'approved'; break;
      case 'rejected': stepStatus = 'rejected'; break;
      case 'reviewed': stepStatus = 'reviewed'; break;
      case 'commented': stepStatus = 'commented'; break;
      default: stepStatus = 'approved';
    }

    // Update step status
    if (stepStatuses[currentIndex]) {
      stepStatuses[currentIndex].status = stepStatus;
      stepStatuses[currentIndex].completedBy = userId;
      stepStatuses[currentIndex].completedAt = new Date().toISOString();
      stepStatuses[currentIndex].comment = comment || '';
    }

    // Log the action
    await this._createLog({
      workflowInstance: instanceId,
      workflow: workflow.id,
      documentCollection: instance.documentCollection,
      documentId: instance.documentId,
      stepId: currentStep.id,
      stepName: currentStep.stepName,
      action: stepStatus,
      user: userId,
      comment: comment || '',
    });

    // Handle rejection — workflow stops
    if (action === 'rejected' && currentStep.stepType !== 'comment_only') {
      for (let i = currentIndex + 1; i < stepStatuses.length; i++) {
        stepStatuses[i].status = 'skipped';
      }

      await this.payload.update({
        collection: 'workflow-instances',
        id: instanceId,
        data: {
          status: 'rejected',
          currentStepIndex: currentIndex,
          stepStatuses,
          completedAt: new Date().toISOString(),
        },
      });

      await this._updateDocumentWorkflowStatus(instance.documentCollection, instance.documentId, 'rejected');

      await this._createLog({
        workflowInstance: instanceId,
        workflow: workflow.id,
        documentCollection: instance.documentCollection,
        documentId: instance.documentId,
        action: 'workflow_rejected',
        user: userId,
        comment: `Workflow rejected at step "${currentStep.stepName}"`,
      });

      return { success: true, message: 'Step rejected. Workflow terminated.' };
    }

    // Find next applicable step (conditional branching)
    const doc = await this._fetchDocument(instance.documentCollection, instance.documentId);
    const nextIndex = this._findNextApplicableStep(sortedSteps, doc || {}, currentIndex, stepStatus);

    if (nextIndex === -1 || nextIndex >= sortedSteps.length) {
      // Workflow completed
      await this.payload.update({
        collection: 'workflow-instances',
        id: instanceId,
        data: {
          status: 'completed',
          currentStepIndex: currentIndex,
          stepStatuses,
          completedAt: new Date().toISOString(),
        },
      });

      await this._updateDocumentWorkflowStatus(instance.documentCollection, instance.documentId, 'completed');

      await this._createLog({
        workflowInstance: instanceId,
        workflow: workflow.id,
        documentCollection: instance.documentCollection,
        documentId: instance.documentId,
        action: 'workflow_completed',
        user: userId,
        comment: 'All workflow steps completed successfully',
      });

      this.payload.logger.info(`Workflow instance ${instanceId} completed!`);
      return { success: true, message: 'Workflow completed successfully!' };
    }

    // Activate next step
    const nextStep = sortedSteps[nextIndex];
    stepStatuses[nextIndex].status = 'active';
    if (nextStep.slaHours) {
      stepStatuses[nextIndex].slaDeadline = new Date(
        Date.now() + nextStep.slaHours * 3600 * 1000
      ).toISOString();
    }

    await this.payload.update({
      collection: 'workflow-instances',
      id: instanceId,
      data: { currentStepIndex: nextIndex, stepStatuses },
    });

    try {
      await this.payload.update({
        collection: instance.documentCollection,
        id: instance.documentId,
        data: { currentWorkflowStep: nextIndex },
        depth: 0,
      });
    } catch (err) { /* non-critical */ }

    await this._createLog({
      workflowInstance: instanceId,
      workflow: workflow.id,
      documentCollection: instance.documentCollection,
      documentId: instance.documentId,
      stepId: nextStep.id,
      stepName: nextStep.stepName,
      action: 'step_activated',
      user: userId,
      comment: `Step "${nextStep.stepName}" is now active`,
    });

    this._sendNotification(nextStep, workflow.name, instance.documentCollection, instance.documentId);

    return {
      success: true,
      message: `Step "${currentStep.stepName}" ${stepStatus}. Next: "${nextStep.stepName}"`,
    };
  }

  /**
   * Check SLA deadlines and auto-escalate overdue steps.
   */
  async checkAndEscalateSLAs() {
    const { docs: instances } = await this.payload.find({
      collection: 'workflow-instances',
      where: { status: { equals: 'in_progress' } },
      limit: 500,
      depth: 1,
    });

    for (const instance of instances) {
      const stepStatuses = instance.stepStatuses || [];
      const currentIndex = instance.currentStepIndex;
      const currentStepStatus = stepStatuses[currentIndex];

      if (
        currentStepStatus?.slaDeadline &&
        !currentStepStatus.isOverdue &&
        new Date(currentStepStatus.slaDeadline) < new Date()
      ) {
        currentStepStatus.isOverdue = true;
        currentStepStatus.status = 'escalated';

        await this.payload.update({
          collection: 'workflow-instances',
          id: instance.id,
          data: { stepStatuses },
        });

        const wfId = typeof instance.workflow === 'string' ? instance.workflow : instance.workflow?.id;
        await this._createLog({
          workflowInstance: instance.id,
          workflow: wfId,
          documentCollection: instance.documentCollection,
          documentId: instance.documentId,
          stepId: currentStepStatus.stepId,
          stepName: currentStepStatus.stepName,
          action: 'sla_escalated',
          comment: `SLA breached for step "${currentStepStatus.stepName}". Auto-escalated.`,
        });

        console.log(
          `\n[EMAIL] SLA ESCALATION: Step "${currentStepStatus.stepName}" is OVERDUE ` +
          `for ${instance.documentCollection}/${instance.documentId}. Escalating now.\n`
        );
      }
    }
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  /**
   * Find the next applicable step index, considering conditional branching.
   */
  _findNextApplicableStep(sortedSteps, doc, currentIndex, previousOutcome) {
    for (let i = currentIndex + 1; i < sortedSteps.length; i++) {
      const step = sortedSteps[i];

      // Check required previous outcome (conditional branching)
      if (
        step.requiredPreviousOutcome &&
        step.requiredPreviousOutcome !== 'any' &&
        previousOutcome &&
        step.requiredPreviousOutcome !== previousOutcome
      ) {
        continue;
      }

      // Check step-level field conditions
      if (step.conditions && step.conditions.length > 0) {
        if (!evaluateAllConditions(doc, step.conditions)) {
          continue;
        }
      }

      return i;
    }
    return -1;
  }

  /**
   * Check if a user has permission to act on a specific step.
   */
  async _checkStepPermission(step, userId) {
    if (step.assigneeType === 'user') {
      const assignedId = typeof step.assignedUser === 'object' ? step.assignedUser?.id : step.assignedUser;
      return assignedId === userId;
    }

    if (step.assigneeType === 'role') {
      try {
        const user = await this.payload.findByID({ collection: 'users', id: userId });
        return user?.role === step.assignedRole;
      } catch {
        return false;
      }
    }
    return false;
  }

  async _fetchDocument(collectionSlug, documentId) {
    try {
      return await this.payload.findByID({ collection: collectionSlug, id: documentId, depth: 0 });
    } catch {
      return null;
    }
  }

  async _updateDocumentWorkflowStatus(collectionSlug, documentId, status) {
    try {
      await this.payload.update({
        collection: collectionSlug,
        id: documentId,
        data: { workflowStatus: status },
        depth: 0,
      });
    } catch (err) {
      this.payload.logger.error(`Error updating document workflow status: ${err}`);
    }
  }

  async _createLog(data) {
    try {
      let userName = '';
      let userRole = '';
      if (data.user) {
        try {
          const u = await this.payload.findByID({ collection: 'users', id: data.user });
          userName = u?.name || '';
          userRole = u?.role || '';
        } catch { /* user lookup failed */ }
      }

      await this.payload.create({
        collection: 'workflow-logs',
        data: {
          ...data,
          userName,
          userRole,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      this.payload.logger.error(`Failed to create workflow log: ${err}`);
    }
  }

  _sendNotification(step, workflowName, collectionSlug, documentId) {
    const assignee =
      step.assigneeType === 'user'
        ? `User ID: ${typeof step.assignedUser === 'object' ? step.assignedUser?.id : step.assignedUser}`
        : `Role: ${step.assignedRole}`;

    console.log(`\n╔══════════════════════════════════════════════════════╗`);
    console.log(`║  EMAIL NOTIFICATION (Simulated)                     ║`);
    console.log(`╠══════════════════════════════════════════════════════╣`);
    console.log(`║  Workflow : ${workflowName}`);
    console.log(`║  Step     : ${step.stepName} (${step.stepType})`);
    console.log(`║  Assigned : ${assignee}`);
    console.log(`║  Document : ${collectionSlug}/${documentId}`);
    console.log(`║  Action   : Please ${step.stepType.replace('_', ' ')} this item`);
    if (step.slaHours) {
      console.log(`║  SLA      : ${step.slaHours} hours`);
    }
    if (step.instructions) {
      console.log(`║  Notes    : ${step.instructions}`);
    }
    console.log(`╚══════════════════════════════════════════════════════╝\n`);
  }
}

module.exports = { WorkflowEngine, evaluateCondition, evaluateAllConditions };
