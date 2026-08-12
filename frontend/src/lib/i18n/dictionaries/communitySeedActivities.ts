// backend/src/db/seed.ts의 커뮤니티 데모 게시글 6건이 쓰는 활동 문구. destinationCatalog.ts의
// "{name} ({area})" 형식이 아니라 직접 쓴 문장이라 별도 사전이 필요하다 — activityTranslation.ts가
// activityTranslations(스타일 풀 범용 문구)와 함께 병합해서 조회한다.
export const communitySeedActivityTranslations: Record<string, { en: string; ja: string }> = {
  // 제주 · jeju-healing (힐링 여행)
  '성산일출봉 일출 감상': { en: 'Seongsan Ilchulbong Sunrise Viewing', ja: '城山日出峰 日の出鑑賞' },
  '섭지코지 해안 산책': { en: 'Seopjikoji Coastal Walk', ja: '涉地可支 海岸散歩' },
  '흑돼지 맛집 저녁': { en: 'Black Pork Restaurant Dinner', ja: '黒豚グルメディナー' },
  '협재 해수욕장': { en: 'Hyeopjae Beach', ja: '挾才海水浴場' },
  '카멜리아힐 산책': { en: 'Camellia Hill Walk', ja: 'カメリアヒル散歩' },
  '애월 카페거리 투어': { en: 'Aewol Cafe Street Tour', ja: '涯月カフェ通りツアー' },
  '오설록 티뮤지엄': { en: "O'sulloc Tea Museum", ja: 'オソルロック ティーミュージアム' },
  '공항 근처 기념품 쇼핑': { en: 'Souvenir Shopping Near the Airport', ja: '空港近くでお土産ショッピング' },

  // 일본 도쿄 · tokyo-shopping (쇼핑 중심)
  '아사쿠사 관광': { en: 'Asakusa Sightseeing', ja: '浅草観光' },
  '스카이트리 전망대': { en: 'Skytree Observation Deck', ja: 'スカイツリー展望台' },
  '우에노 저녁 식사': { en: 'Dinner in Ueno', ja: '上野で夕食' },
  '시부야 쇼핑': { en: 'Shibuya Shopping', ja: '渋谷でショッピング' },
  '하라주쿠 편집숍': { en: 'Harajuku Boutiques', ja: '原宿セレクトショップ' },
  '신주쿠 쇼핑몰': { en: 'Shinjuku Shopping Mall', ja: '新宿ショッピングモール' },
  '츠키지 시장 아침': { en: 'Morning at Tsukiji Market', ja: '築地市場で朝' },
  '긴자 백화점 쇼핑': { en: 'Ginza Department Store Shopping', ja: '銀座百貨店ショッピング' },
  '긴자 맛집 투어': { en: 'Ginza Food Tour', ja: '銀座グルメツアー' },
  '오다이바 쇼핑몰': { en: 'Odaiba Shopping Mall', ja: 'お台場ショッピングモール' },
  '공항 면세점 쇼핑': { en: 'Airport Duty-Free Shopping', ja: '空港免税店ショッピング' },

  // 방콕 · bangkok-family (가족 여행)
  '왓 아룬 관광': { en: 'Wat Arun Sightseeing', ja: 'ワット・アルン観光' },
  '차오프라야 강 유람선': { en: 'Chao Phraya River Cruise', ja: 'チャオプラヤー川クルーズ' },
  '가족 친화 레스토랑 저녁': { en: 'Family-Friendly Restaurant Dinner', ja: 'ファミリー向けレストランディナー' },
  '사파리 월드': { en: 'Safari World', ja: 'サファリワールド' },
  '아쿠아리움 관람': { en: 'Aquarium Visit', ja: '水族館見学' },
  '짜뚜짝 주말시장': { en: 'Chatuchak Weekend Market', ja: 'チャトゥチャック・ウィークエンドマーケット' },
  '수상시장 투어': { en: 'Floating Market Tour', ja: '水上マーケットツアー' },
  '태국 마사지 체험': { en: 'Thai Massage Experience', ja: 'タイマッサージ体験' },
  '호텔 수영장에서 휴식': { en: 'Relaxing at the Hotel Pool', ja: 'ホテルのプールでリラックス' },
  '공항 이동 전 쇼핑': { en: 'Shopping Before Heading to the Airport', ja: '空港移動前のショッピング' },

  // 파리 · paris-couple (커플 여행)
  '에펠탑 야경 감상': { en: 'Eiffel Tower Night View', ja: 'エッフェル塔夜景鑑賞' },
  '센강 유람선 데이트': { en: 'Seine River Cruise Date', ja: 'セーヌ川クルーズデート' },
  '루브르 박물관': { en: 'Louvre Museum', ja: 'ルーヴル美術館' },
  '몽마르뜨 언덕 산책': { en: 'Montmartre Hill Walk', ja: 'モンマルトルの丘散歩' },
  '베르사유 궁전': { en: 'Palace of Versailles', ja: 'ヴェルサイユ宮殿' },
  '분위기 좋은 비스트로 저녁': { en: 'Dinner at a Charming Bistro', ja: '雰囲気の良いビストロディナー' },
  '마레 지구 카페 투어': { en: 'Le Marais Cafe Tour', ja: 'マレ地区カフェツアー' },
  '루프탑 바 데이트': { en: 'Rooftop Bar Date', ja: 'ルーフトップバーデート' },
  '개선문 산책': { en: 'Arc de Triomphe Walk', ja: '凱旋門散歩' },
  '기념품 쇼핑': { en: 'Souvenir Shopping', ja: 'お土産ショッピング' },

  // 오사카 · osaka-solo (혼자 여행)
  '오사카성 혼자 관람': { en: 'Solo Visit to Osaka Castle', ja: '大阪城をひとりで観覧' },
  '조용한 카페에서 여유': { en: 'Relaxing at a Quiet Cafe', ja: '静かなカフェでくつろぐ' },
  '도톤보리 야경 산책': { en: 'Dotonbori Night Walk', ja: '道頓堀夜散歩' },
  '독립서점 탐방': { en: 'Independent Bookstore Exploration', ja: '独立系書店探訪' },
  '우메다 스카이빌딩': { en: 'Umeda Sky Building', ja: '梅田スカイビル' },
  '공항 이동 전 커피 한 잔': { en: 'A Coffee Before Heading to the Airport', ja: '空港移動前にコーヒーを一杯' },

  // 다낭 · danang-food (맛집 중심)
  '한시장 로컬 맛집 탐방': { en: 'Han Market Local Food Exploration', ja: 'ハン市場ローカルグルメ探訪' },
  '미케 비치 노을 감상': { en: 'My Khe Beach Sunset Viewing', ja: 'ミーケビーチ夕日鑑賞' },
  '바나힐 골든브릿지': { en: 'Golden Bridge (Ba Na Hills)', ja: 'ゴールデンブリッジ(バーナーヒルズ)' },
  '반쎄오 맛집 저녁': { en: 'Banh Xeo Restaurant Dinner', ja: 'バインセオグルメディナー' },
  '호이안 야시장 먹거리 투어': { en: 'Hoi An Night Market Food Tour', ja: 'ホイアン・ナイトマーケット グルメツアー' },
  '분짜 맛집': { en: 'Bun Cha Restaurant', ja: 'ブンチャーグルメ' },
  '로컬 카페 브런치': { en: 'Local Cafe Brunch', ja: 'ローカルカフェブランチ' },
  '공항 근처 쌀국수': { en: 'Pho Near the Airport', ja: '空港近くでフォー' },
}
