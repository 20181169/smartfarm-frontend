// UI hints only. API authorization and plant/region scope remain server-owned.
export function hasPermission(user, permission) {
  return user?.source === 'api' && Array.isArray(user.permissions) && user.permissions.includes(permission)
}

export function currentUser(me) {
  const permissionsLoaded = Array.isArray(me?.permissions) && me.permissions.every((p) => typeof p === 'string')
  return {
    userId: me.user_id, email: me.email, name: me.name,
    roleId: me.role_id, roleCode: me.role_code, roleName: me.role_name, level: me.level,
    source: 'api', permissionsLoaded,
    permissions: permissionsLoaded ? [...new Set(me.permissions)] : [],
  }
}

// Requirements describe each screen, never a role-to-permission matrix.
export const ROUTE_PERMISSIONS = {
  '/oversight': ['plant:read'],
  '/site-detail': ['farming_plan:read'],
  '/anomalies': ['farming_activity:read'],
  '/inspection': ['farming_activity:review'],
  '/cctv': ['vision:read'],
  '/plan-assessment': ['farming_plan:read', 'farming_assessment:read'],
  '/compliance-report': ['report:read'],
}
