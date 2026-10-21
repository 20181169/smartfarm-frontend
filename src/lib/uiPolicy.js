import { hasPermission } from './permissions.js'

// Requested demo visibility; never used to grant access to backend data.
// Regions are already scoped by the server. Do not infer a province from a user name.
export function canViewDemoData(user, regions = []) {
  if (user?.source !== 'api') return false
  if (user.roleCode === 'SYS_ADMIN') return true
  return user.roleCode === 'PROVINCE_ADMIN' && hasPermission(user, 'region:read') &&
    regions.some(region => region.is_active && ['강원특별자치도', '강원도'].includes(region.name))
}

// The requested inspector workflow is stricter than the current server permission.
// Backend must separately remove vision:run if direct API access must also be denied.
export function canRunVision(user) {
  return user?.roleCode !== 'INSPECTOR' && hasPermission(user, 'vision:run')
}
