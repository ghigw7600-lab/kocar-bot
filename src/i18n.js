// 손님용 문구 (우즈벡어 · 러시아어) — 짧고 쉬운 표준어, 현지인 검수 권장
export const T = {
  uz: {
    welcome:
      "Assalomu alaykum! 👋\nKOCAR — Koreyadan mashina olib berish xizmati.\n\n🚗 Mashinalarni pastdagi tugmadan ko'ring yoki savolingizni shu yerga yozing.",
    btnCars: "🚗 Mashinalar",
    btnFind: "🔎 Mashina topib bering",
    btnLang: "🌐 Til",
    chooseLang: "Tilni tanlang:",
    msgFirst: "✅ Xabaringiz yetkazildi. Tez orada javob beramiz.\n\n🔒 Maʼlumotlaringiz faqat maslahat uchun ishlatiladi.",
    msgSent: "✅ Yetkazildi.",
    findModel: "🚗 Qaysi mashina kerak?",
    other: "Boshqa",
    findModelType: "✍️ Mashina nomini yozing:",
    findBudget: "💵 Toshkentgacha jami byudjet?",
    findYear: "📅 Yili?",
    any: "Farqi yo'q",
    findDone: "✅ Rahmat! So'rovingizni oldik — mos mashinalarni topib yozamiz.",
    carAsked: "✅ So'rovingiz yuborildi! Bu mashinani tekshirib, tez orada javob beramiz.",
    carGone: "Bu mashina sotilgan bo'lishi mumkin. Shunga o'xshashini topib beramiz — savolingizni yozing 👇",
    total: "Toshkentgacha jami",
  },
  ru: {
    welcome:
      "Здравствуйте! 👋\nKOCAR — авто из Кореи под заказ.\n\n🚗 Смотрите машины по кнопке ниже или напишите свой вопрос здесь.",
    btnCars: "🚗 Машины",
    btnFind: "🔎 Подобрать машину",
    btnLang: "🌐 Язык",
    chooseLang: "Выберите язык:",
    msgFirst: "✅ Сообщение доставлено. Скоро ответим.\n\n🔒 Ваши данные используются только для консультации.",
    msgSent: "✅ Доставлено.",
    findModel: "🚗 Какая машина нужна?",
    other: "Другая",
    findModelType: "✍️ Напишите модель:",
    findBudget: "💵 Бюджет «под ключ» до Ташкента?",
    findYear: "📅 Год?",
    any: "Неважно",
    findDone: "✅ Спасибо! Запрос получили — подберём варианты и напишем.",
    carAsked: "✅ Запрос отправлен! Проверим эту машину и скоро ответим.",
    carGone: "Эта машина, возможно, уже продана. Подберём похожую — напишите вопрос 👇",
    total: "Итого до Ташкента",
  },
};

export const LANGS = ["uz", "ru"];
// 키르기스·카자흐 등 러시아어권 앱은 ru, 나머지는 uz
export const detectLang = (code = "") =>
  /^(ru|ky|kk|be|uk|tg)/i.test(code) ? "ru" : "uz";
export const t = (lang, key) => T[lang]?.[key] ?? T.uz[key] ?? key;
export const allLabels = (key) => LANGS.map((l) => T[l][key]);

export const BUDGETS = ["≤ $30 000", "$30–40 000", "$40 000+"];
export const YEARS = ["2019–2021", "2022–2023", "2024+"];
