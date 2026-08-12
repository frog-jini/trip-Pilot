// 커뮤니티 페이지가 텅 비어 보이지 않도록, 실제 사용자가 아무것도 공유하지 않은 상태에서도
// 보여줄 데모 여행 일정 6건을 심어두는 스크립트(`npm run seed`).
import { randomUUID } from 'node:crypto'
import { pool } from './pool.js'
import { hashPassword } from '../lib/password.js'

// 시드 데이터도 users.user_id FK를 만족해야 하므로, 이 데모 계정 하나를 소유자로 붙여둔다.
// 비밀번호는 로그인할 일이 없어 무작위 UUID를 해시해서 채워 넣기만 한다.
const DEMO_USER_ID = 'community-demo-user'
const DEMO_USER_EMAIL = 'community-demo@trailot.app'

interface SeedTrip {
  id: string
  author: string
  tag: string
  seedLikes: number
  seedViews: number
  itinerary: {
    destination: string
    duration: string
    travelers: number
    budget: number
    days: { day: number; title: string; activities: string[] }[]
  }
}

const SEED_TRIPS: SeedTrip[] = [
  {
    id: 'jeju-healing',
    author: '민지',
    tag: '힐링 여행',
    seedLikes: 128,
    seedViews: 3200,
    itinerary: {
      destination: '제주',
      duration: '2박 3일',
      travelers: 2,
      budget: 60,
      days: [
        { day: 1, title: '1일차', activities: ['성산일출봉 일출 감상', '섭지코지 해안 산책', '흑돼지 맛집 저녁'] },
        { day: 2, title: '2일차', activities: ['협재 해수욕장', '카멜리아힐 산책', '애월 카페거리 투어'] },
        { day: 3, title: '3일차', activities: ['오설록 티뮤지엄', '공항 근처 기념품 쇼핑'] },
      ],
    },
  },
  {
    id: 'tokyo-shopping',
    author: '현우',
    tag: '쇼핑 중심',
    seedLikes: 96,
    seedViews: 2400,
    itinerary: {
      destination: '일본 도쿄',
      duration: '3박 4일',
      travelers: 1,
      budget: 120,
      days: [
        { day: 1, title: '1일차', activities: ['아사쿠사 관광', '스카이트리 전망대', '우에노 저녁 식사'] },
        { day: 2, title: '2일차', activities: ['시부야 쇼핑', '하라주쿠 편집숍', '신주쿠 쇼핑몰'] },
        { day: 3, title: '3일차', activities: ['츠키지 시장 아침', '긴자 백화점 쇼핑', '긴자 맛집 투어'] },
        { day: 4, title: '4일차', activities: ['오다이바 쇼핑몰', '공항 면세점 쇼핑'] },
      ],
    },
  },
  {
    id: 'bangkok-family',
    author: '수진',
    tag: '가족 여행',
    seedLikes: 74,
    seedViews: 1800,
    itinerary: {
      destination: '방콕',
      duration: '4박 5일',
      travelers: 4,
      budget: 200,
      days: [
        { day: 1, title: '1일차', activities: ['왓 아룬 관광', '차오프라야 강 유람선', '가족 친화 레스토랑 저녁'] },
        { day: 2, title: '2일차', activities: ['사파리 월드', '아쿠아리움 관람'] },
        { day: 3, title: '3일차', activities: ['짜뚜짝 주말시장', '키즈 카페 나들이'] },
        { day: 4, title: '4일차', activities: ['수상시장 투어', '태국 마사지 체험'] },
        { day: 5, title: '5일차', activities: ['호텔 수영장에서 휴식', '공항 이동 전 쇼핑'] },
      ],
    },
  },
  {
    id: 'paris-couple',
    author: '지훈',
    tag: '커플 여행',
    seedLikes: 61,
    seedViews: 1500,
    itinerary: {
      destination: '파리',
      duration: '4박 5일',
      travelers: 2,
      budget: 250,
      days: [
        { day: 1, title: '1일차', activities: ['에펠탑 야경 감상', '센강 유람선 데이트'] },
        { day: 2, title: '2일차', activities: ['루브르 박물관', '몽마르뜨 언덕 산책'] },
        { day: 3, title: '3일차', activities: ['베르사유 궁전', '분위기 좋은 비스트로 저녁'] },
        { day: 4, title: '4일차', activities: ['마레 지구 카페 투어', '루프탑 바 데이트'] },
        { day: 5, title: '5일차', activities: ['개선문 산책', '기념품 쇼핑'] },
      ],
    },
  },
  {
    id: 'osaka-solo',
    author: '예은',
    tag: '혼자 여행',
    seedLikes: 45,
    seedViews: 1100,
    itinerary: {
      destination: '오사카',
      duration: '2박 3일',
      travelers: 1,
      budget: 70,
      days: [
        { day: 1, title: '1일차', activities: ['오사카성 혼자 관람', '조용한 카페에서 여유'] },
        { day: 2, title: '2일차', activities: ['도톤보리 야경 산책', '독립서점 탐방'] },
        { day: 3, title: '3일차', activities: ['우메다 스카이빌딩', '공항 이동 전 커피 한 잔'] },
      ],
    },
  },
  {
    id: 'danang-food',
    author: '태양',
    tag: '맛집 중심',
    seedLikes: 39,
    seedViews: 980,
    itinerary: {
      destination: '다낭',
      duration: '3박 4일',
      travelers: 2,
      budget: 90,
      days: [
        { day: 1, title: '1일차', activities: ['한시장 로컬 맛집 탐방', '미케 비치 노을 감상'] },
        { day: 2, title: '2일차', activities: ['바나힐 골든브릿지', '반쎄오 맛집 저녁'] },
        { day: 3, title: '3일차', activities: ['호이안 야시장 먹거리 투어', '분짜 맛집'] },
        { day: 4, title: '4일차', activities: ['로컬 카페 브런치', '공항 근처 쌀국수'] },
      ],
    },
  },
]

export async function seed(): Promise<void> {
  const existingUser = await pool.query('SELECT id FROM users WHERE id = $1', [DEMO_USER_ID])
  if (existingUser.rows.length === 0) {
    const passwordHash = await hashPassword(randomUUID())
    await pool.query('INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)', [
      DEMO_USER_ID,
      DEMO_USER_EMAIL,
      passwordHash,
    ])
  }

  // ON CONFLICT DO NOTHING이라 이 스크립트를 몇 번을 다시 돌려도 중복 생성되거나
  // 실제 사용자가 좋아요/조회수를 쌓아둔 기존 시드 데이터를 덮어쓰지 않는다(멱등).
  for (const trip of SEED_TRIPS) {
    await pool.query(
      `INSERT INTO community_trips (id, user_id, author, tag, itinerary, seed_likes)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [trip.id, DEMO_USER_ID, trip.author, trip.tag, trip.itinerary, trip.seedLikes],
    )
    await pool.query(
      `INSERT INTO community_trip_views (community_trip_id, view_count)
       VALUES ($1, $2)
       ON CONFLICT (community_trip_id) DO NOTHING`,
      [trip.id, trip.seedViews],
    )
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then(() => {
      console.log('Seed complete')
      return pool.end()
    })
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
