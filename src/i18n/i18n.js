(function () {
  const config = window.GUNS_CONFIG?.i18n || {};
  const fallbackLanguage = config.fallbackLanguage || "en";
  const defaultLanguage = config.defaultLanguage || fallbackLanguage;
  const storageKey = config.storageKey || "guns.language";

  const dictionaries = {
    en: {
      "start.aria": "GUNS start screen",
      "start.nickPlaceholder": "PILOT",
      "start.play": "GO",
      "base.roomGo": "GO",
      "room.main.title": "Main Arena",
      "room.main.description": "Classic public arena",
      "room.guns-market.title": "Guns Market",
      "room.guns-market.description": "Portable weapons shop",
      "start.tutorial": "TUTORIAL",
      "start.versionAria": "Game version",
      "tutorial.aria": "GUNS tutorial",
      "tutorial.exit": "EXIT",
      "tutorial.lesson1Done": "GOOD JOB",
      "tutorial.next": "NEXT",
      "language.aria": "Language",
      "language.ru": "РУССКИЙ",
      "language.en": "ENGLISH",
      "unsupported.title": "DESKTOP ONLY",
      "unsupported.message": "Sorry, GUNS.GS currently supports only desktop systems with a mouse and keyboard.",
      "skin.aria": "Skin",
      "pilot.defaultNick": "PILOT",
      "cannon.free": "FREE",
      "cannon.lock": "LOCK",
      "cannon.wait": "WAIT",
      "hint.cannonRequiresScore": "CANNON REQUIRES {score} SCORE",
      "scoreboard.rank": "#",
      "scoreboard.pilot": "PILOT",
      "scoreboard.score": "SCORE",
      "mode.fly": "FLY MODE",
      "mode.dead": "YOU ARE DEAD",
      "death.continue": "CONTINUE",
      "death.exit": "EXIT",
      "tutorial.progress": "TUTORIAL {step}/{total}",
      "tutorial.moveToCannon": "Move your pilot to the FREE cannon.",
      "tutorial.driveAndAim": "You are inside. Move the mouse to drive and aim.",
      "tutorial.breakTarget": "Hold the left mouse button and break the target cannon.",
      "tutorial.pickAmmo": "Ammo is marked 30. Drive over it to reload.",
      "tutorial.eject": "Press Z to eject from the cannon.",
      "tutorial.fly": "Now press F. Fly mode lets the pilot cross danger safely.",
      "tutorial.ready": "READY FOR BATTLE"
    },

    ru: {
      "start.aria": "GUNS стартовый экран",
      "start.nickPlaceholder": "ПИЛОТ",
      "start.play": "ПОЕХАЛИ",
      "base.roomGo": "\u041f\u041e\u0415\u0425\u0410\u041b\u0418",
      "room.main.title": "\u0413\u043b\u0430\u0432\u043d\u0430\u044f \u0430\u0440\u0435\u043d\u0430",
      "room.main.description": "\u041a\u043b\u0430\u0441\u0441\u0438\u0447\u0435\u0441\u043a\u0430\u044f \u043f\u0443\u0431\u043b\u0438\u0447\u043d\u0430\u044f \u0430\u0440\u0435\u043d\u0430",
      "room.guns-market.title": "\u041e\u0440\u0443\u0436\u0435\u0439\u043d\u044b\u0439 \u0440\u044b\u043d\u043e\u043a",
      "room.guns-market.description": "\u041c\u0430\u0433\u0430\u0437\u0438\u043d \u043d\u043e\u0441\u0438\u043c\u043e\u0433\u043e \u043e\u0440\u0443\u0436\u0438\u044f",
      "start.tutorial": "ТУТОРИАЛ",
      "start.versionAria": "Версия",
      "tutorial.aria": "\u0422\u0443\u0442\u043e\u0440\u0438\u0430\u043b GUNS",
      "tutorial.exit": "\u0412\u042b\u0425\u041e\u0414",
      "tutorial.lesson1Done": "\u041c\u041e\u041b\u041e\u0414\u0415\u0426",
      "tutorial.next": "\u0414\u0410\u041b\u0415\u0415",
      "language.aria": "Язык",
      "language.ru": "РУССКИЙ",
      "language.en": "ENGLISH",
      "unsupported.title": "\u0422\u041e\u041b\u042c\u041a\u041e \u0414\u0415\u0421\u041a\u0422\u041e\u041f",
      "unsupported.message": "\u0418\u0437\u0432\u0438\u043d\u0438\u0442\u0435, GUNS.GS \u043f\u043e\u043a\u0430 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442 \u0442\u043e\u043b\u044c\u043a\u043e \u0434\u0435\u0441\u043a\u0442\u043e\u043f\u043d\u044b\u0435 \u0441\u0438\u0441\u0442\u0435\u043c\u044b \u0441 \u043c\u044b\u0448\u044c\u044e \u0438 \u043a\u043b\u0430\u0432\u0438\u0430\u0442\u0443\u0440\u043e\u0439.",
      "mode.dead": "\u0422\u042b \u041c\u0415\u0420\u0422\u0412",
      "death.continue": "\u041f\u0420\u041e\u0414\u041e\u041b\u0416\u0418\u0422\u042c",
      "death.exit": "\u0412\u042b\u0425\u041e\u0414",
      "skin.aria": "Скин",
      "pilot.defaultNick": "ПИЛОТ",
      "cannon.free": "СВОБОДНО",
      "cannon.lock": "ЗАКРЫТО",
      "cannon.wait": "ЧИНИТСЯ",
      "hint.cannonRequiresScore": "ТРЕБУЕТСЯ ОЧКОВ: {score}",
      "scoreboard.rank": "#",
      "scoreboard.pilot": "ПИЛОТ",
      "scoreboard.score": "ОЧКИ",
      "mode.fly": "РЕЖИМ ПОЛЁТА",
      "tutorial.progress": "ТУТОРИАЛ {step}/{total}",
      "tutorial.moveToCannon": "Подведи пилота к свободной пушке.",
      "tutorial.driveAndAim": "Ты внутри. Двигай мышью, чтобы ехать и целиться.",
      "tutorial.breakTarget": "Зажми левую кнопку мыши и сломай учебную пушку.",
      "tutorial.pickAmmo": "Патроны отмечены числом 30. Наедь на них для перезарядки.",
      "tutorial.eject": "Нажми Z, чтобы катапультироваться из пушки.",
      "tutorial.fly": "Теперь нажми F. Режим полёта позволяет безопасно пересекать опасные зоны.",
      "tutorial.ready": "ГОТОВ К БОЮ"
    }
  };

  function normalizeLanguage(value) {
    const shortCode = String(value || "")
      .trim()
      .toLowerCase()
      .split("-")[0];

    return dictionaries[shortCode] ? shortCode : "";
  }

  const forcedLanguage = normalizeLanguage(config.forcedLanguage);
  let language =
    forcedLanguage ||
    normalizeLanguage(localStorage.getItem(storageKey)) ||
    defaultLanguage;

  if (forcedLanguage) {
    localStorage.setItem(storageKey, forcedLanguage);
  }

  function format(template, params) {
    return String(template).replace(/\{(\w+)\}/g, (match, key) => {
      return Object.prototype.hasOwnProperty.call(params || {}, key)
        ? String(params[key])
        : match;
    });
  }

  function t(key, params = {}) {
    const activeDictionary = dictionaries[language] || dictionaries[fallbackLanguage] || {};
    const fallbackDictionary = dictionaries[fallbackLanguage] || {};
    const template = activeDictionary[key] || fallbackDictionary[key] || key;
    return format(template, params);
  }

  function apply(root = document) {
    if (document.documentElement) {
      document.documentElement.lang = language;
    }

    root.querySelectorAll("[data-i18n]").forEach(element => {
      element.textContent = t(element.dataset.i18n);
    });

    root.querySelectorAll("[data-i18n-placeholder]").forEach(element => {
      element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder));
    });

    root.querySelectorAll("[data-i18n-aria]").forEach(element => {
      element.setAttribute("aria-label", t(element.dataset.i18nAria));
    });
  }

  function setLanguage(nextLanguage) {
    language = forcedLanguage || normalizeLanguage(nextLanguage) || fallbackLanguage;
    localStorage.setItem(storageKey, language);
    apply();
    window.dispatchEvent(new CustomEvent("guns:languagechange", { detail: { language } }));
    return language;
  }

  window.GUNS_I18N = {
    dictionaries,
    get language() {
      return language;
    },
    setLanguage,
    t,
    apply
  };
})();
