"use strict";

// ==========================================
// POMODORO STUDIO — JavaScript
// ==========================================

// Durations are expressed in seconds.
const FOCUS_TIME = 25 * 60;
const SHORT_BREAK_TIME = 5 * 60;
const LONG_BREAK_TIME = 15 * 60;
const SETTINGS_KEY = "pomodoro-studio-settings";

// HTML elements
const themeSelect = document.getElementById("theme");
const clockTypeSelect = document.getElementById("clock-type");
const cyclesInput = document.getElementById("cycles");
const languageButton = document.getElementById("language-button");
const currentLanguage = document.getElementById("current-language");

const sessionType = document.getElementById("session-type");
const digitalClock = document.getElementById("digital-clock");
const analogClock = document.getElementById("analog-clock");
const minutesElement = document.getElementById("minutes");
const secondsElement = document.getElementById("seconds");
const cycleCounter = document.getElementById("cycle-counter");

const startButton = document.getElementById("start-button");
const pauseButton = document.getElementById("pause-button");
const resetButton = document.getElementById("reset-button");

// Translations (English is the default language).
const translations = {
    en: {
        settings: "Settings",
        theme: "Visual Theme:",
        clockType: "Clock Type:",
        digital: "Digital",
        analog: "Analog",
        cycles: "Number of Cycles:",
        focus: "Focus Session",
        shortBreak: "Short Break",
        longBreak: "Long Break",
        completed: "Session Complete!",
        cycleCounter: (current, total) => `Cycle ${current} of ${total}`,
        finishedCounter: (total) => `${total} of ${total} cycles completed`,
        start: "Start",
        resume: "Resume",
        pause: "Pause",
        reset: "Reset",
        changeLanguage: "Change language"
    },
    es: {
        settings: "Configuración",
        theme: "Tema visual:",
        clockType: "Tipo de reloj:",
        digital: "Digital",
        analog: "Analógico",
        cycles: "Cantidad de ciclos:",
        focus: "Concentración",
        shortBreak: "Descanso corto",
        longBreak: "Descanso largo",
        completed: "¡Sesión completada!",
        cycleCounter: (current, total) => `Ciclo ${current} de ${total}`,
        finishedCounter: (total) => `${total} de ${total} ciclos completados`,
        start: "Iniciar",
        resume: "Reanudar",
        pause: "Pausar",
        reset: "Reiniciar",
        changeLanguage: "Cambiar idioma"
    }
};

// Timer state
let language = "en";
let totalCycles = 4;
let completedCycles = 0;
let phase = "focus";          // focus | shortBreak | longBreak
let status = "idle";          // idle | running | paused | completed
let remainingSeconds = FOCUS_TIME;
let remainingMilliseconds = FOCUS_TIME * 1000;
let endTime = 0;
let intervalId = null;

// ==========================================
// SETTINGS AND LANGUAGE
// ==========================================

function saveSettings() {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({
            language,
            theme: themeSelect.value,
            clockType: clockTypeSelect.value,
            cycles: totalCycles
        }));
    } catch (error) {
        // The app still works if the browser blocks localStorage.
    }
}

function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
        if (!saved || typeof saved !== "object") return;

        if (["en", "es"].includes(saved.language)) {
            language = saved.language;
        }
        if (["vaporwave", "zen", "rain"].includes(saved.theme)) {
            themeSelect.value = saved.theme;
        }
        if (["digital", "analog"].includes(saved.clockType)) {
            clockTypeSelect.value = saved.clockType;
        }
        if (Number.isInteger(saved.cycles) && saved.cycles >= 1 && saved.cycles <= 12) {
            totalCycles = saved.cycles;
        }
    } catch (error) {
        // Missing or invalid saved preferences: keep the defaults.
    }

    cyclesInput.value = totalCycles;
}

function applyLanguage() {
    const text = translations[language];

    document.documentElement.lang = language;
    currentLanguage.textContent = language.toUpperCase();
    languageButton.setAttribute("aria-label", text.changeLanguage);
    languageButton.title = text.changeLanguage;

    document.querySelectorAll("[data-i18n]").forEach((element) => {
        const key = element.dataset.i18n;
        if (typeof text[key] === "string") {
            element.textContent = text[key];
        }
    });

    render();
}

function applyTheme() {
    document.body.dataset.theme = themeSelect.value;
    saveSettings();
}

function applyClockType() {
    const isDigital = clockTypeSelect.value === "digital";
    digitalClock.hidden = !isDigital;
    analogClock.hidden = isDigital;
    saveSettings();
}

// ==========================================
// ANALOG CLOCK — generated inside the existing div
// ==========================================

const SVG_NS = "http://www.w3.org/2000/svg";
let progressCircle;
let clockHand;
let analogTimeText;

function createSvgElement(name, attributes) {
    const element = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attributes)) {
        element.setAttribute(key, value);
    }
    return element;
}

function buildAnalogClock() {
    const svg = createSvgElement("svg", {
        viewBox: "0 0 240 240",
        width: "100%",
        height: "100%",
        role: "img"
    });

    // Clock face: twelve hour marks.
    for (let index = 0; index < 12; index++) {
        const angle = (index * Math.PI) / 6 - Math.PI / 2;
        const x1 = 120 + 84 * Math.cos(angle);
        const y1 = 120 + 84 * Math.sin(angle);
        const x2 = 120 + 94 * Math.cos(angle);
        const y2 = 120 + 94 * Math.sin(angle);

        svg.appendChild(createSvgElement("line", {
            x1, y1, x2, y2,
            stroke: "var(--muted)",
            "stroke-width": 2,
            "stroke-linecap": "round"
        }));
    }

    // Progress ring: the colored arc shrinks as time runs out.
    const circumference = 2 * Math.PI * 103;
    progressCircle = createSvgElement("circle", {
        cx: 120, cy: 120, r: 103,
        fill: "none",
        stroke: "var(--accent)",
        "stroke-width": 4,
        "stroke-dasharray": circumference,
        transform: "rotate(-90 120 120)"
    });
    svg.appendChild(progressCircle);

    clockHand = createSvgElement("line", {
        x1: 120, y1: 120, x2: 120, y2: 48,
        stroke: "var(--text)",
        "stroke-width": 4,
        "stroke-linecap": "round"
    });
    svg.appendChild(clockHand);

    svg.appendChild(createSvgElement("circle", {
        cx: 120, cy: 120, r: 5,
        fill: "var(--accent)"
    }));

    analogTimeText = createSvgElement("text", {
        x: 120, y: 172,
        "text-anchor": "middle",
        fill: "var(--text)",
        "font-size": 19,
        "font-weight": "600"
    });
    svg.appendChild(analogTimeText);
    analogClock.appendChild(svg);
}

function phaseDuration() {
    if (phase === "shortBreak") return SHORT_BREAK_TIME;
    if (phase === "longBreak") return LONG_BREAK_TIME;
    return FOCUS_TIME;
}

function drawAnalogClock(displayTime) {
    const fractionRemaining = Math.max(0, Math.min(1, remainingSeconds / phaseDuration()));
    const angle = -Math.PI / 2 + (1 - fractionRemaining) * 2 * Math.PI;
    const circumference = 2 * Math.PI * 103;

    clockHand.setAttribute("x2", 120 + 72 * Math.cos(angle));
    clockHand.setAttribute("y2", 120 + 72 * Math.sin(angle));
    progressCircle.setAttribute("stroke-dashoffset", circumference * (1 - fractionRemaining));
    analogTimeText.textContent = displayTime;
    analogClock.querySelector("svg").setAttribute(
        "aria-label", `${translations[language][phase] || translations[language].completed}: ${displayTime}`
    );
}

// ==========================================
// TIMER AND CONTROLS
// ==========================================

function setClockNumber(element, number) {
    const value = String(number).padStart(2, "0");
    if (element.textContent === value) return;

    element.textContent = value;
    element.classList.remove("flip-change");
    void element.offsetWidth; // Restart the CSS flip animation.
    element.classList.add("flip-change");
}

function render() {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const displayTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    const text = translations[language];

    setClockNumber(minutesElement, minutes);
    setClockNumber(secondsElement, seconds);
    drawAnalogClock(displayTime);

    sessionType.textContent = status === "completed" ? text.completed : text[phase];

    if (status === "completed") {
        cycleCounter.textContent = text.finishedCounter(totalCycles);
    } else {
        const currentCycle = phase === "focus" ? completedCycles + 1 : completedCycles;
        cycleCounter.textContent = text.cycleCounter(currentCycle, totalCycles);
    }

    startButton.textContent = status === "paused" ? text.resume : text.start;
    pauseButton.textContent = text.pause;
    resetButton.textContent = text.reset;
    startButton.disabled = status === "running";
    pauseButton.disabled = status !== "running";
    cyclesInput.disabled = status === "running" || status === "paused";
}

function stopInterval() {
    if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

function resetTimer() {
    stopInterval();
    status = "idle";
    phase = "focus";
    completedCycles = 0;
    remainingSeconds = FOCUS_TIME;
    remainingMilliseconds = FOCUS_TIME * 1000;
    endTime = 0;
    render();
}

// Called each time a focus or break period ends.
function nextPhase(finishedAt) {
    if (phase === "focus") {
        completedCycles++;

        if (completedCycles >= totalCycles) {
            status = "completed";
            remainingSeconds = 0;
            remainingMilliseconds = 0;
            stopInterval();
            return;
        }

        phase = completedCycles % 4 === 0 ? "longBreak" : "shortBreak";
    } else {
        phase = "focus";
    }

    // Anchor the next deadline to the previous deadline, avoiding drift.
    remainingMilliseconds = phaseDuration() * 1000;
    endTime = finishedAt + remainingMilliseconds;
}

function updateTimer() {
    if (status !== "running") return;

    const now = Date.now();

    // Catch up accurately if the browser throttled timers in another tab.
    while (status === "running" && now >= endTime) {
        const finishedAt = endTime;
        nextPhase(finishedAt);
    }

    if (status === "running") {
        remainingMilliseconds = Math.max(0, endTime - now);
        remainingSeconds = Math.ceil(remainingMilliseconds / 1000);
    }

    render();
}

function startTimer() {
    if (status === "running") return;

    if (status === "completed") {
        resetTimer();
    }

    status = "running";
    endTime = Date.now() + remainingMilliseconds;
    stopInterval();
    intervalId = setInterval(updateTimer, 250);
    render();
}

function pauseTimer() {
    if (status !== "running") return;

    updateTimer();
    if (status !== "running") return;

    remainingMilliseconds = Math.max(0, endTime - Date.now());
    remainingSeconds = Math.ceil(remainingMilliseconds / 1000);
    status = "paused";
    stopInterval();
    render();
}

// ==========================================
// EVENTS AND INITIALIZATION
// ==========================================

themeSelect.addEventListener("change", applyTheme);
clockTypeSelect.addEventListener("change", applyClockType);

cyclesInput.addEventListener("change", () => {
    const chosen = Number(cyclesInput.value);
    totalCycles = Number.isFinite(chosen) ? Math.max(1, Math.min(12, Math.floor(chosen))) : 4;
    cyclesInput.value = totalCycles;
    saveSettings();
    resetTimer();
});

languageButton.addEventListener("click", () => {
    language = language === "en" ? "es" : "en";
    applyLanguage();
    saveSettings();
});

startButton.addEventListener("click", startTimer);
pauseButton.addEventListener("click", pauseTimer);
resetButton.addEventListener("click", resetTimer);

// Keep the screen updated on returning to a background tab.
document.addEventListener("visibilitychange", updateTimer);
window.addEventListener("pageshow", updateTimer);

loadSettings();
buildAnalogClock();
applyTheme();
applyClockType();
applyLanguage();
resetTimer();
