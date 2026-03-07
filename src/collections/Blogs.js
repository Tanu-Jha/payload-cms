const Blogs = {
  slug: 'blogs',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'author', 'status', 'workflowStatus', 'updatedAt'],
  },
  access: {
    read: () => true,
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
      name: 'content',
      type: 'richText',
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'category',
      type: 'select',
      options: [
        { label: 'Technology', value: 'technology' },
        { label: 'Business', value: 'business' },
        { label: 'Design', value: 'design' },
        { label: 'Marketing', value: 'marketing' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'In Review', value: 'in_review' },
        { label: 'Approved', value: 'approved' },
        { label: 'Published', value: 'published' },
        { label: 'Rejected', value: 'rejected' },
      ],
    },
    {
      name: 'priority',
      type: 'select',
      defaultValue: 'normal',
      options: [
        { label: 'Low', value: 'low' },
        { label: 'Normal', value: 'normal' },
        { label: 'High', value: 'high' },
        { label: 'Urgent', value: 'urgent' },
      ],
    },
    // Workflow-injected fields (managed automatically by the plugin)
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

module.exports = { Blogs };
