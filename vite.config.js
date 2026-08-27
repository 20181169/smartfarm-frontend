import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 프로젝트 사이트로 배포할 경우 base 를 '/dongyang-solar-react/' 로 바꾸세요.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    host: true,
    // 프론트에서 '/api/*' 호출을 백엔드(FastAPI, :8000)로 프록시.
    // 같은 오리진으로 요청되므로 개발 중 CORS 문제를 피할 수 있습니다.
    // 백엔드 주소가 다르면 VITE_API_TARGET 환경변수로 바꾸세요.
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
