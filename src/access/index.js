const isAuthenticated = ({ req: { user } }) => Boolean(user);

const isAdmin = ({ req: { user } }) => user?.role === 'admin';

const isAdminOrManager = ({ req: { user } }) =>
  user?.role === 'admin' || user?.role === 'manager';

const hasRole = (...roles) => ({ req: { user } }) => {
  if (!user) return false;
  return roles.includes(user.role);
};

const isAdminOrSelf = ({ req: { user } }) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return { id: { equals: user.id } };
};

module.exports = { isAuthenticated, isAdmin, isAdminOrManager, hasRole, isAdminOrSelf };
