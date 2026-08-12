// 앱 최상위 진입 컴포넌트. 라우터와 인증 컨텍스트(로그인 세션)를 여기서 한 번만 감싸서
// 모든 페이지가 useAuth()와 <Link>/useNavigate 등을 쓸 수 있게 한다.
// LanguageProvider는 인증 여부와 무관하게 전체 앱에 적용돼야 해서 가장 바깥에 둔다.
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { LanguageProvider } from './context/LanguageContext'
import { AppRoutes } from './AppRoutes'

function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  )
}

export default App
