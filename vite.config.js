import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 프로젝트 사이트로 배포할 경우 base 를 '/dongyang-solar-react/' 로 바꾸세요.
export default defineConfig(({ mode }) => {
  // 백엔드(FastAPI Smartfarm Platform) 주소. .env* 의 VITE_API_TARGET 으로 덮어쓸 수 있습니다.
  // 예) 로컬 백엔드로 붙일 때:  VITE_API_TARGET=http://localhost:8000
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_TARGET || 'http://121.78.116.151'

  return {
    plugins: [react()],
    base: './',
    server: {
      port: 5173,
      host: true,
      // 프론트의 '/api/*' 호출을 백엔드로 프록시. 같은 오리진으로 나가므로
      // 개발 중 CORS 문제를 피할 수 있습니다. (이 API 는 CORS 헤더를 주지 않음)
      proxy: {
        '/api/v1/vision': {
          target: env.VITE_VISION_API_TARGET || 'http://127.0.0.1:8011',
          changeOrigin: true,
          timeout: 200000,
          proxyTimeout: 200000,
        },
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
