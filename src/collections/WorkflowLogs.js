const WorkflowLogs = {
  slug: 'workflow-logs',
  admin: {
    useAsTitle: 'action',
    defaultColumns: ['action', 'workflowInstance', 'documentCollection', 'documentId', 'user', 'createdAt'],
    description: 'Immutable audit trail for all workflow actions',
  },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: () => true,
    // IMMUTABLE: No updates or deletes ever allowed
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: 'workflowInstance',
      type: 'relationship',
      relationTo: 'workflow-instances',
      required: true,
    },
    {
      name: 'workflow',
      type: 'relationship',
      relationTo: 'workflows',
      required: true,
    },
    {
      name: 'documentCollection',
      type: 'text',
      required: true,
    },
    {
      name: 'documentId',
      type: 'text',
      required: true,
    },
    {
      name: 'stepId',
      type: 'text',
    },
    {
      name: 'stepName',
      type: 'text',
    },
    {
      name: 'action',
      type: 'select',
      required: true,
      options: [
        { label: 'Workflow Started', value: 'workflow_started' },
        { label: 'Step Activated', value: 'step_activated' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
        { label: 'Reviewed', value: 'reviewed' },
        { label: 'Comment Added', value: 'commented' },
        { label: 'Step Skipped', value: 'step_skipped' },
        { label: 'SLA Escalated', value: 'sla_escalated' },
        { label: 'Workflow Completed', value: 'workflow_completed' },
        { label: 'Workflow Rejected', value: 'workflow_rejected' },
        { label: 'Workflow Cancelled', value: 'workflow_cancelled' },
      ],
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
    },
    {
      name: 'userName',
      type: 'text',
    },
    {
      name: 'userRole',
      type: 'text',
    },
    {
      name: 'comment',
      type: 'textarea',
    },
    {
      name: 'metadata',
      type: 'json',
    },
    {
      name: 'timestamp',
      type: 'date',
      required: true,
    },
  ],
  timestamps: true,
};

module.exports = { WorkflowLogs };
