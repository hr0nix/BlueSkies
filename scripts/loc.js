(function() {
var enResources = {
        "ms": "m/s",
        "paused": "(paused)",
        "Type address": "Start typing any address here",
        "accuracy trick": "Accuracy trick: you'll land there",
        "controlset": "Points you can reach the landing target from (at the current altitude)",
        "reachset": "The area on the ground still reachable from the current position",
        "share-link": "Get link to current location",

        "uk": "UK",
        "ru": "Russia",
        "other": "Other",

        "uk-sibson": "Sibson",
        "uk-chatteris": "Chatteris",
        "ru-puschino": "Puschino",
        "ru-kolomna": "Kolomna",
        "ru-vatulino": "Vatulino",
        "other-dubai": "Dubai",
        "other-red-square": "Red Square",
        "other-statue-of-liberty": "Statue of Liberty",

        "custom": "From search"
    },
    ruResources = {
        "ms": "м/с",
        "mph": "миль/ч",
        "m": "м",
        "ft": "футов",
        "paused": "", // too long anyway :)
        "Pause": "Пауза",
        "Unpause": "Продолжить",
        "Stop": "Остановить",
        "Type address": "Введите любой адрес",
        "Fullscreen": "Спрятать правую панель",
        "Normal": "Вернуть правую панель",
        "Legend": "Легенда",
        "Got it!": "Дальше",
        "Skip tutor": "Пропустить введение",
        "Share a link": "Ссылка сюда",
        "accuracy trick": "Точка приземления",
        "controlset": "КВК: из каких точек все еще можно попасть в цель (с текущей высоты)",
        "reachset": "Точки на земле, в которые еще можно попасть из текущего положения",
        "share-link": "Получить ссылку на текущую точку",

        "uk": "Англия",
        "ru": "Россия",
        "other": "Другое",

        "uk-sibson": "Сибсон",
        "ru-puschino": "Пущино",
        "ru-kolomna": "Коломна",
        "ru-vatulino": "Ватулино",
        "other-dubai": "Дубай",
        "other-red-square": "Красная площадь",
        "other-statue-of-liberty": "Статуя свободы",

        "custom": "Из поиска"
    },
    langResources = {
        "en": enResources,
        "ru": ruResources
    };

function localize(id) {
    return defaultIfUndefined(
        langResources[viewModel.display.language()][id],    // First, try current language
        defaultIfUndefined(
            langResources['en'][id],                        // then english
            id                                              // else simply use the id itself
        ));
}

function setLanguage(element, language) {
    if (!langResources[language]) {
        return;
    }

    for (var lang in langResources) {
        $(element).find(":lang(" + lang + ")").toggle(lang == language);
    }

    if (isDialogOpen("#legend-dialog")) {
        showLegendDialog("#legend-dialog");
    }

    var $rightclick = $("#tutor-rightclick");
    if (isDialogOpen("#tutor-rightclick")) {
        $rightclick.dialog("option", "position", $rightclick.dialog("option", "position"));
    }
}

// Export
window.localize = localize;
window.setLanguage = setLanguage;

})();
