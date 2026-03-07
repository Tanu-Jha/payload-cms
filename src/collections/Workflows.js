const Workflows = {
  slug: 'workflows',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'targetCollection', 'isActive', 'updatedAt'],
    description: 'Define reusable workflow templates with multi-stage approval steps',
  },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'manager',
    update: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'manager',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'A descriptive name for this workflow (e.g., "Blog Approval Flow")',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Explain what this workflow does and when it should be used',
      },
    },
    {
      name: 'targetCollection',
      type: 'text',
      required: true,
      admin: {
        description: 'The slug of the collection this workflow applies to (e.g., "blogs", "contracts")',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether this workflow is currently active',
        position: 'sidebar',
      },
    },
    {
      name: 'triggerConditions',
      type: 'group',
      admin: {
        description: 'Conditions that must be met to auto-trigger this workflow',
      },
      fields: [
        {
          name: 'triggerOn',
          type: 'select',
          defaultValue: 'create',
          options: [
            { label: 'On Create', value: 'create' },
            { label: 'On Update', value: 'update' },
            { label: 'On Create & Update', value: 'both' },
            { label: 'Manual Only', value: 'manual' },
          ],
        },
        {
          name: 'fieldConditions',
          type: 'array',
          admin: {
            description: 'Field-based conditions (all must pass to trigger)',
          },
          fields: [
            {
              name: 'fieldPath',
              type: 'text',
              required: true,
              admin: {
                description: 'Field path to check (e.g., "status", "amount", "priority")',
              },
            },
            {
              name: 'operator',
              type: 'select',
              required: true,
              options: [
                { label: 'Equals', value: 'equals' },
                { label: 'Not Equals', value: 'not_equals' },
                { label: 'Greater Than', value: 'greater_than' },
                { label: 'Less Than', value: 'less_than' },
                { label: 'Contains', value: 'contains' },
                { label: 'Exists', value: 'exists' },
              ],
            },
            {
              name: 'value',
              type: 'text',
              required: true,
              admin: {
                description: 'Value to compare against',
              },
            },
          ],
        },
      ],
    },
    // Workflow Steps
    {
      name: 'steps',
      type: 'array',
      required: true,
      minRows: 1,
      admin: {
        description: 'Define each step of the workflow in sequential order',
      },
      fields: [
        {
          name: 'stepName',
          type: 'text',
          required: true,
          admin: {
            description: 'Display name for this step (e.g., "Manager Review")',
          },
        },
        {
          name: 'stepOrder',
          type: 'number',
          required: true,
          min: 1,
          admin: {
            description: 'Execution order (1 = first step)',
          },
        },
        {
          name: 'stepType',
          type: 'select',
          required: true,
          options: [
            { label: 'Approval', value: 'approval' },
            { label: 'Review', value: 'review' },
            { label: 'Sign-off', value: 'sign_off' },
            { label: 'Comment Only', value: 'comment_only' },
          ],
        },
        {
          name: 'assigneeType',
          type: 'select',
          required: true,
          defaultValue: 'role',
          options: [
            { label: 'Specific User', value: 'user' },
            { label: 'User Role', value: 'role' },
          ],
        },
        {
          name: 'assignedUser',
          type: 'relationship',
          relationTo: 'users',
          admin: {
            description: 'Specific user to assign (when assigneeType = "user")',
            condition: (data, siblingData) => siblingData?.assigneeType === 'user',
          },
        },
        {
          name: 'assignedRole',
          type: 'select',
          options: [
            { label: 'Admin', value: 'admin' },
            { label: 'Manager', value: 'manager' },
            { label: 'Reviewer', value: 'reviewer' },
            { label: 'Editor', value: 'editor' },
          ],
          admin: {
            description: 'Role to assign (when assigneeType = "role")',
            condition: (data, siblingData) => siblingData?.assigneeType === 'role',
          },
        },
        // Conditional branching fields
        {
          name: 'conditions',
          type: 'array',
          admin: {
            description: 'Conditions on document fields for this step to activate (conditional branching)',
          },
          fields: [
            {
              name: 'fieldPath',
              type: 'text',
              required: true,
            },
            {
              name: 'operator',
              type: 'select',
              required: true,
              options: [
                { label: 'Equals', value: 'equals' },
                { label: 'Not Equals', value: 'not_equals' },
                { label: 'Greater Than', value: 'greater_than' },
                { label: 'Less Than', value: 'less_than' },
                { label: 'Contains', value: 'contains' },
              ],
            },
            {
              name: 'value',
              type: 'text',
              required: true,
            },
          ],
        },
        {
          name: 'requiredPreviousOutcome',
          type: 'select',
          admin: {
            description: 'Only activate this step if the previous step had this outcome (branching)',
          },
          options: [
            { label: 'Any (Always Continue)', value: 'any' },
            { label: 'Approved', value: 'approved' },
            { label: 'Rejected', value: 'rejected' },
            { label: 'Reviewed', value: 'reviewed' },
          ],
        },
        // SLA
        {
          name: 'slaHours',
          type: 'number',
          min: 0,
          admin: {
            description: 'SLA deadline in hours. Auto-escalates if overdue.',
          },
        },
        {
          name: 'escalateTo',
          type: 'relationship',
          relationTo: 'users',
          admin: {
            description: 'User to escalate to if SLA is breached',
          },
        },
        {
          name: 'instructions',
          type: 'textarea',
          admin: {
            description: 'Instructions for the person handling this step',
          },
        },
      ],
    },
    {
      name: 'createdByUser',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ req, data, operation }) => {
        if (operation === 'create' && req.user) {
          data.createdByUser = req.user.id;
        }
        if (data.steps && Array.isArray(data.steps)) {
          data.steps.sort((a, b) => (a.stepOrder || 0) - (b.stepOrder || 0));
        }
        return data;
      },
    ],
  },
  timestamps: true,
};

module.exports = { Workflows };
