import type { Language } from '../language'

// 일정 상세 화면(TripDetailPage) — 알림 문구, 채팅 응답 문구, 삭제/공유 버튼 등.
export const tripDetailDictionary: Record<Language, Record<string, string>> = {
  ko: {
    weatherRain: '비',
    weatherSnow: '눈',
    weatherStorm: '태풍',
    weatherDust: '미세먼지',
    weatherHeat: '폭염',
    weatherCold: '한파',
    weatherClear: '맑은 날씨',
    weatherOutdoor: '실외',

    loadingStatus: '불러오는 중...',
    notFound: '해당 일정을 찾을 수 없어요.',
    backToTrips: '내 여행 일정 목록으로',

    chatTitle: 'AI에게 일정을 말해보세요',
    chatGreeting:
      '안녕하세요! 날씨나 일정 변경을 자유롭게 말씀해주세요. "둘째 날은 비가 올 것 같아"라고 하면 실내 일정으로 바꾸고, "2일차에 디즈니랜드 추가해줘"라고 하면 그 활동을 넣고, "2일차에 디즈니랜드 삭제해줘"라고 하면 빼드려요.',
    chatPlaceholder: '예: 2일차에 디즈니랜드 추가해줘',
    clarificationMessage:
      '어느 날짜에 어떤 날씨인지, 또는 몇 일차에 어떤 활동을 추가·삭제하고 싶은지 알려주시겠어요? 예: "둘째 날은 비가 올 것 같아", "2일차에 디즈니랜드 추가해줘", "2일차에 디즈니랜드 삭제해줘"',
    tripUnavailable: '지금은 일정 정보를 불러올 수 없어요.',
    dayNotInTrip: '{{day}}일차는 이번 일정에 없어요. 1~{{max}}일차 중에서 알려주세요.',

    unpublish: '커뮤니티에서 내리기',
    publish: '커뮤니티에 공유하기',
    unpublishedNotice: '커뮤니티에서 내렸어요.',
    publishedNotice: '커뮤니티에 공유했어요! 다른 사람들도 이 일정을 볼 수 있어요.',

    confirmDeletePrompt: '정말 이 일정을 삭제할까요?',
    confirmDeleteButton: '삭제 확정',
    deleteButton: '일정 삭제',

    noticeRemovedWithReplacement: "'{{activity}}'을(를) 삭제했어요. AI가 '{{added}}'을(를) 대신 추천했어요.",
    noticeRemoved: "'{{activity}}'을(를) 일정에서 삭제했어요.",
    noticeSwapped: "'{{oldActivity}}' 대신 '{{newActivity}}'(으)로 변경했어요.",
    noticeEdited: "'{{oldActivity}}'을(를) '{{newActivity}}'(으)로 직접 수정했어요.",
    noticeDayAdded: '{{n}}일차를 추가했어요.',
    noticeActivityAdded: "{{day}}일차에 '{{activity}}'을(를) 추가했어요.",
    noticeDayFullShort: '{{day}}일차는 이미 일정이 가득 찼어요. 더 이상 일정을 추가할 수 없어요.',
    noticeNoMoreSuggestions: '{{day}}일차에 더 추천할 만한 활동이 없어요. 다른 스타일을 선택해보세요.',

    chatDayFull: '{{day}}일차는 이미 일정이 가득 찼어요. 더 이상 활동을 추가할 수 없어요.',
    chatActivityNotFound: "{{day}}일차에 '{{activity}}'이(가) 없어요.",
    chatRemovedWithReplacement: "{{day}}일차에서 '{{activity}}'을(를) 삭제했어요. AI가 '{{added}}'을(를) 대신 추천했어요.",
    chatRemoved: "{{day}}일차에서 '{{activity}}'을(를) 삭제했어요.",
    chatWeatherClear: '{{day}}일차는 {{weather}}라니 잘 됐네요! 일정은 그대로 둘게요.',
    chatWeatherOutdoorRestored: '{{day}}일차를 다시 {{weather}} 활동 위주로 되돌렸어요.',
    chatWeatherAlreadyIndoor: '{{day}}일차는 이미 실내 위주 일정이라 그대로 유지할게요.',
    chatWeatherAdjusted: '{{day}}일차에 {{weather}} 소식을 반영해서 실외 관광 대신 쇼핑몰과 실내 관광 위주로 변경했어요.',
  },
  en: {
    weatherRain: 'rain',
    weatherSnow: 'snow',
    weatherStorm: 'a storm',
    weatherDust: 'fine dust',
    weatherHeat: 'a heatwave',
    weatherCold: 'a cold snap',
    weatherClear: 'clear weather',
    weatherOutdoor: 'outdoor',

    loadingStatus: 'Loading...',
    notFound: 'This trip could not be found.',
    backToTrips: 'Back to My Trips',

    chatTitle: 'Tell the AI About Your Trip',
    chatGreeting:
      'Hi! Feel free to tell me about weather or itinerary changes. Say "it looks like it’ll rain on day two" to switch to indoor activities, "add Disneyland on day 2" to add that activity, or "remove Disneyland on day 2" to remove it.',
    chatPlaceholder: 'e.g. Add Disneyland on day 2',
    clarificationMessage:
      'Could you tell me which day and what weather, or which day and which activity to add/remove? e.g. "it looks like it’ll rain on day two", "add Disneyland on day 2", "remove Disneyland on day 2"',
    tripUnavailable: 'Trip information isn’t available right now.',
    dayNotInTrip: 'Day {{day}} isn’t part of this trip. Please pick a day from 1 to {{max}}.',

    unpublish: 'Remove from Community',
    publish: 'Share to Community',
    unpublishedNotice: 'Removed from the community.',
    publishedNotice: 'Shared to the community! Others can now see this trip.',

    confirmDeletePrompt: 'Are you sure you want to delete this trip?',
    confirmDeleteButton: 'Confirm Delete',
    deleteButton: 'Delete Trip',

    noticeRemovedWithReplacement: 'Removed "{{activity}}". AI suggested "{{added}}" instead.',
    noticeRemoved: 'Removed "{{activity}}" from the itinerary.',
    noticeSwapped: 'Changed "{{oldActivity}}" to "{{newActivity}}".',
    noticeEdited: 'Edited "{{oldActivity}}" to "{{newActivity}}".',
    noticeDayAdded: 'Added day {{n}}.',
    noticeActivityAdded: 'Added "{{activity}}" to day {{day}}.',
    noticeDayFullShort: 'Day {{day}} is already full. You can’t add any more to it.',
    noticeNoMoreSuggestions: 'No more suggestions for day {{day}}. Try selecting a different style.',

    chatDayFull: 'Day {{day}} is already full. No more activities can be added.',
    chatActivityNotFound: '"{{activity}}" isn’t on day {{day}}.',
    chatRemovedWithReplacement: 'Removed "{{activity}}" from day {{day}}. AI suggested "{{added}}" instead.',
    chatRemoved: 'Removed "{{activity}}" from day {{day}}.',
    chatWeatherClear: 'Glad day {{day}} has {{weather}}! I’ll leave the plan as is.',
    chatWeatherOutdoorRestored: 'Restored day {{day}} back to {{weather}} activities.',
    chatWeatherAlreadyIndoor: 'Day {{day}} is already mostly indoor, so I’ll keep it as is.',
    chatWeatherAdjusted:
      'Updated day {{day}} for {{weather}} — swapped outdoor sightseeing for a shopping mall and indoor spots.',
  },
  ja: {
    weatherRain: '雨',
    weatherSnow: '雪',
    weatherStorm: '台風',
    weatherDust: '黄砂・PM2.5',
    weatherHeat: '猛暑',
    weatherCold: '寒波',
    weatherClear: '晴天',
    weatherOutdoor: '屋外',

    loadingStatus: '読み込み中...',
    notFound: 'このプランが見つかりません。',
    backToTrips: 'マイ旅程一覧へ',

    chatTitle: 'AIにプランについて話しかけてください',
    chatGreeting:
      'こんにちは!天気やプラン変更を自由に話してください。「2日目は雨が降りそう」と言うと屋内プランに変更し、「2日目にディズニーランドを追加して」と言うと追加、「2日目のディズニーランドを削除して」と言うと削除します。',
    chatPlaceholder: '例: 2日目にディズニーランドを追加して',
    clarificationMessage:
      'どの日にどんな天気か、または何日目にどんなアクティビティを追加・削除したいか教えていただけますか?例: 「2日目は雨が降りそう」「2日目にディズニーランドを追加して」「2日目のディズニーランドを削除して」',
    tripUnavailable: '現在プラン情報を読み込めません。',
    dayNotInTrip: '{{day}}日目はこのプランにありません。1〜{{max}}日目の中から教えてください。',

    unpublish: 'コミュニティから削除',
    publish: 'コミュニティに共有',
    unpublishedNotice: 'コミュニティから削除しました。',
    publishedNotice: 'コミュニティに共有しました!他の人もこのプランを見られます。',

    confirmDeletePrompt: '本当にこのプランを削除しますか?',
    confirmDeleteButton: '削除を確定',
    deleteButton: 'プランを削除',

    noticeRemovedWithReplacement: '「{{activity}}」を削除しました。AIが代わりに「{{added}}」を提案しました。',
    noticeRemoved: '「{{activity}}」をプランから削除しました。',
    noticeSwapped: '「{{oldActivity}}」を「{{newActivity}}」に変更しました。',
    noticeEdited: '「{{oldActivity}}」を「{{newActivity}}」に直接編集しました。',
    noticeDayAdded: '{{n}}日目を追加しました。',
    noticeActivityAdded: '{{day}}日目に「{{activity}}」を追加しました。',
    noticeDayFullShort: '{{day}}日目はすでに予定が一杯です。これ以上追加できません。',
    noticeNoMoreSuggestions: '{{day}}日目にはこれ以上おすすめできるアクティビティがありません。他のスタイルを選んでみてください。',

    chatDayFull: '{{day}}日目はすでに予定が一杯です。これ以上アクティビティを追加できません。',
    chatActivityNotFound: '{{day}}日目に「{{activity}}」はありません。',
    chatRemovedWithReplacement: '{{day}}日目の「{{activity}}」を削除しました。AIが代わりに「{{added}}」を提案しました。',
    chatRemoved: '{{day}}日目の「{{activity}}」を削除しました。',
    chatWeatherClear: '{{day}}日目は{{weather}}とのことでよかったです!プランはそのままにしますね。',
    chatWeatherOutdoorRestored: '{{day}}日目を{{weather}}アクティビティ中心に戻しました。',
    chatWeatherAlreadyIndoor: '{{day}}日目はすでに屋内中心のプランなので、そのままにしますね。',
    chatWeatherAdjusted:
      '{{day}}日目に{{weather}}情報を反映して、屋外観光の代わりにショッピングモールと屋内観光を中心に変更しました。',
  },
}
