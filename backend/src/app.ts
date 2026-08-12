// Express 앱 조립부. server.ts(실제 listen)와 분리해둔 이유는 app.test.ts처럼
// 포트를 열지 않고 supertest로 라우트만 바로 테스트할 수 있게 하기 위해서다.
import express from 'express'
import cors from 'cors'
import { authRouter } from './routes/auth.js'
import { tripsRouter } from './routes/trips.js'
import { favoritesRouter } from './routes/favorites.js'
import { communityRouter } from './routes/community.js'

export const app = express()

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/auth', authRouter)
app.use('/api/trips', tripsRouter)
app.use('/api/favorites', favoritesRouter)
app.use('/api/community', communityRouter)
