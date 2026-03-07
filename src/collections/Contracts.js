const Contracts = {
  slug: 'contracts',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'client', 'amount', 'status', 'workflowStatus', 'updatedAt'],
  },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'client',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'amount',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'Contract value in USD',
      },
    },
    {
      name: 'contractType',
      type: 'select',
      required: true,
      options: [
        { label: 'Service Agreement', value: 'service' },
        { label: 'NDA', value: 'nda' },
        { label: 'Employment', value: 'employment' },
        { label: 'Vendor', value: 'vendor' },
        { label: 'Partnership', value: 'partnership' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Under Review', value: 'under_review' },
        { label: 'Legal Review', value: 'legal_review' },
        { label: 'Approved', value: 'approved' },
        { label: 'Signed', value: 'signed' },
        { label: 'Rejected', value: 'rejected' },
      ],
    },
    {
      name: 'startDate',
      type: 'date',
    },
    {
      name: 'endDate',
      type: 'date',
    },
    // Workflow-injected fields
    {
      name: 'workflowStatus',
      type: 'select',
      defaultValue: 'none',
      options: [
        { label: 'No Workflow', value: 'none' },
        { label: 'Pending', value: 'pending' },
        { label: 'In Progress', value: 'in_progress' },
        { label: 'Completed', value: 'completed' },
        { label: 'Rejected', value: 'rejected' },
      ],
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Managed by the workflow engine',
      },
    },
    {
      name: 'currentWorkflowStep',
      type: 'number',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Current step index in the active workflow',
      },
    },
    {
      name: 'activeWorkflowInstance',
      type: 'relationship',
      relationTo: 'workflow-instances',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Reference to the active workflow instance',
      },
    },
  ],
  timestamps: true,
};

module.exports = { Contracts };
