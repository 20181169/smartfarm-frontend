import { createContext, useContext } from 'react'

// 컨텍스트 객체와 훅을 Provider 컴포넌트와 분리해 둡니다.
// (한 파일에서 컴포넌트 + 훅을 함께 export 하면 Vite fast-refresh 가 깨짐)
export const AppContext = createContext(null)

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
