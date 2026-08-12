// generatePlan.ts의 STYLE_ACTIVITIES(카탈로그 없는 목적지에서 쓰는 스타일별 범용 활동 문구, 7개
// 스타일 × 6개 = 42개)를 그대로 키로 삼아 번역을 찾는다. 원문 한국어 문자열이 저장되는 canonical
// 값이므로, 여기 없는 문자열은 그대로(원문) 노출된다.
export const activityTranslations: Record<string, { en: string; ja: string }> = {
  // 관광 중심
  '대표 랜드마크 관광': { en: 'Iconic Landmark Sightseeing', ja: '代表的なランドマーク観光' },
  '전망대에서 도시 전경 감상': { en: 'City View from an Observation Deck', ja: '展望台から街の景色を楽しむ' },
  '역사 박물관 관광': { en: 'History Museum Visit', ja: '歴史博物館観光' },
  '유명 사원 관광': { en: 'Famous Temple Visit', ja: '有名な寺院観光' },
  '구시가지 골목 탐방': { en: 'Old Town Alley Exploration', ja: '旧市街散策' },
  '유명 광장 사진 명소 관광': { en: 'Famous Square Photo Spot', ja: '有名な広場のフォトスポット観光' },

  // 맛집 중심
  '현지 맛집 탐방': { en: 'Local Restaurant Exploration', ja: '地元グルメ巡り' },
  '전통 시장 맛집 투어': { en: 'Traditional Market Food Tour', ja: '伝統市場グルメツアー' },
  '유명 맛집 저녁 식사': { en: 'Dinner at a Famous Restaurant', ja: '有名レストランでのディナー' },
  '로컬 맛집 브런치': { en: 'Brunch at a Local Restaurant', ja: 'ローカルレストランでのブランチ' },
  '노포 맛집 탐방': { en: 'Old-School Restaurant Visit', ja: '老舗グルメ巡り' },
  '디저트 카페 투어': { en: 'Dessert Cafe Tour', ja: 'デザートカフェ巡り' },

  // 쇼핑 중심
  '대형 쇼핑몰 쇼핑': { en: 'Shopping at a Large Mall', ja: '大型ショッピングモールでの買い物' },
  '아울렛 쇼핑': { en: 'Outlet Shopping', ja: 'アウトレットショッピング' },
  '쇼핑 거리 구경': { en: 'Browsing a Shopping Street', ja: 'ショッピングストリート散策' },
  '편집숍 쇼핑 투어': { en: 'Boutique Shopping Tour', ja: 'セレクトショップ巡り' },
  '로컬 브랜드 쇼핑': { en: 'Local Brand Shopping', ja: 'ローカルブランドショッピング' },
  '기념품 거리 쇼핑': { en: 'Souvenir Street Shopping', ja: 'お土産通りショッピング' },

  // 힐링 여행
  '스파에서 힐링': { en: 'Relaxing at a Spa', ja: 'スパでのヒーリング' },
  '공원 산책하며 힐링': { en: 'Relaxing Park Stroll', ja: '公園散策でヒーリング' },
  '해변에서 여유로운 힐링': { en: 'Leisurely Beach Relaxation', ja: 'ビーチでのんびりヒーリング' },
  '온천에서 힐링': { en: 'Relaxing at a Hot Spring', ja: '温泉でヒーリング' },
  '루프탑 카페에서 힐링': { en: 'Relaxing at a Rooftop Cafe', ja: 'ルーフトップカフェでヒーリング' },
  '요가·명상 클래스로 힐링': { en: 'Relaxing Yoga & Meditation Class', ja: 'ヨガ・瞑想クラスでヒーリング' },

  // 가족 여행
  '테마파크 가족 나들이': { en: 'Family Theme Park Outing', ja: 'テーマパーク家族お出かけ' },
  '아쿠아리움 가족 관람': { en: 'Family Aquarium Visit', ja: '水族館家族見学' },
  '가족 액티비티 체험': { en: 'Family Activity Experience', ja: '家族アクティビティ体験' },
  '동물원 가족 나들이': { en: 'Family Zoo Outing', ja: '動物園家族お出かけ' },
  '키즈 카페 나들이': { en: 'Kids Cafe Outing', ja: 'キッズカフェお出かけ' },
  '가족 사진 스팟 나들이': { en: 'Family Photo Spot Outing', ja: '家族フォトスポットお出かけ' },

  // 커플 여행
  '야경 명소 커플 데이트': { en: "Couple's Night View Date", ja: '夜景スポットでカップルデート' },
  '커플 스파 체험': { en: "Couple's Spa Experience", ja: 'カップルスパ体験' },
  '루프탑 바 커플 데이트': { en: "Couple's Rooftop Bar Date", ja: 'ルーフトップバーでカップルデート' },
  '분위기 좋은 레스토랑 커플 저녁': { en: 'Romantic Restaurant Dinner', ja: '雰囲気の良いレストランでカップルディナー' },
  '커플 액티비티 체험': { en: "Couple's Activity Experience", ja: 'カップルアクティビティ体験' },
  '기념품 숍 커플 데이트': { en: "Couple's Souvenir Shop Date", ja: 'お土産ショップでカップルデート' },

  // 혼자 여행
  '한적한 카페에서 혼자만의 시간': { en: 'Quiet Time at a Cafe', ja: '静かなカフェでひとり時間' },
  '나만의 산책 코스': { en: 'Personal Walking Route', ja: '自分だけの散策コース' },
  '독립서점 혼자 탐방': { en: 'Solo Indie Bookstore Visit', ja: '独立系書店ひとり探訪' },
  '조용한 미술관 혼자 관람': { en: 'Quiet Solo Art Museum Visit', ja: '静かな美術館をひとりで鑑賞' },
  '혼자 즐기는 로컬 맛집': { en: 'Solo Dining at a Local Restaurant', ja: 'ひとりで楽しむ地元グルメ' },
  '한적한 공원 산책': { en: 'Quiet Park Walk', ja: '静かな公園散歩' },
}
