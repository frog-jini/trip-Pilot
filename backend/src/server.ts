// 실제 프로세스 진입점(`npm run dev` / `npm start`). app.ts와 분리해둔 이유는 app.test.ts가
// 포트를 열지 않고도 supertest로 라우트를 직접 테스트할 수 있게 하기 위해서다.
import { app } from './app.js'

const PORT = Number(process.env.PORT ?? 4000)

app.listen(PORT, () => {
  console.log(`Trailot API listening on port ${PORT}`)
})
