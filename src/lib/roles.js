// 백엔드 역할 레벨 → 메뉴 역할(통합 버전과 동일한 3단계)
//   10 SYS_ADMIN = admin(발전소 운영 + 감독 전체) / 20~60 CENTRAL~INSPECTOR = official(감독·현장점검)
//   70 운영자·80 조회전용 = owner(발전소 운영)
const ADMIN_MAX_LEVEL = 10
const OFFICIAL_MENU_MAX_LEVEL = 60

// 실계정은 level로, 데모는 선택한 demoRole로, 미로그인(또는 레벨 조회 실패)은 owner(발전사업자 화면).
export function menuRoleOf(user) {
  if (user?.level != null) {
    if (user.level <= ADMIN_MAX_LEVEL) return 'admin'
    return user.level <= OFFICIAL_MENU_MAX_LEVEL ? 'official' : 'owner'
  }
  return user?.demoRole || 'owner'
}

// 역할은 표시명과 메뉴 정렬에만 사용한다. 기능 권한은 permissions.js에서 판단한다.
