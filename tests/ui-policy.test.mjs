import test from 'node:test'
import assert from 'node:assert/strict'
import { canViewDemoData, canRunVision } from '../src/lib/uiPolicy.js'

const user = (roleCode, permissions = []) => ({ source: 'api', roleCode, permissions })
const gangwon = [{ name: '강원특별자치도', is_active: true }]
test('demo visibility is limited to system admin and verified Gangwon province admin', () => {
  assert.equal(canViewDemoData(user('SYS_ADMIN')), true)
  assert.equal(canViewDemoData(user('PROVINCE_ADMIN', ['region:read']), gangwon), true)
  for (const role of ['CENTRAL_ADMIN', 'CITY_ADMIN', 'TOWN_ADMIN', 'INSPECTOR', 'PLANT_OPERATOR', 'VIEWER']) {
    assert.equal(canViewDemoData(user(role, ['region:read']), gangwon), false)
  }
})
test('missing, inactive or different scope and demo login never enable administrative samples', () => {
  const province = user('PROVINCE_ADMIN', ['region:read'])
  assert.equal(canViewDemoData(province), false)
  assert.equal(canViewDemoData(province, [{ name: '경기도', is_active: true }]), false)
  assert.equal(canViewDemoData(province, [{ name: '강원특별자치도', is_active: false }]), false)
  assert.equal(canViewDemoData(user('PROVINCE_ADMIN'), gangwon), false)
  assert.equal(canViewDemoData({ ...user('SYS_ADMIN'), source: 'demo' }), false)
  assert.equal(canViewDemoData(null), false)
})
test('inspector restriction only narrows server permission and never grants analysis access', () => {
  assert.equal(canRunVision(user('INSPECTOR', ['vision:run','vision:review'])), false)
  assert.equal(canRunVision(user('PLANT_OPERATOR', ['vision:run'])), true)
  assert.equal(canRunVision(user('PLANT_OPERATOR', ['vision:read'])), false)
  assert.equal(canRunVision(user('SYS_ADMIN')), false)
  assert.equal(canRunVision({ ...user('SYS_ADMIN', ['vision:run']), source: 'demo' }), false)
  assert.equal(canRunVision(null), false)
})
