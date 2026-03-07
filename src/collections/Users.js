const Users = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'role'],
  },
  access: {
    read: ({ req: { user } }) => {
      if (user?.role === 'admin') return true;
      if (!user) return false;
      return { id: { equals: user.id } };
    },
    create: ({ req: { user } }) => user?.role === 'admin',
    update: ({ req: { user } }) => {
      if (user?.role === 'admin') return true;
      if (!user) return false;
      return { id: { equals: user.id } };
    },
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'reviewer',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Manager', value: 'manager' },
        { label: 'Reviewer', value: 'reviewer' },
        { label: 'Editor', value: 'editor' },
        { label: 'Viewer', value: 'viewer' },
      ],
      admin: {
        description: 'Role determines permissions in workflows',
      },
    },
    {
      name: 'department',
      type: 'text',
      admin: {
        description: 'Department for workflow assignment routing',
      },
    },
  ],
  timestamps: true,
};

module.exports = { Users };
