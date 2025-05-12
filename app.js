"use strict";

const LETTERS_LOWER = "abcdefghijklmnopqrstuvwxyz";
const LETTERS_UPPER = LETTERS_LOWER.toUpperCase();
const DIGITS = "0123456789";
const PUNCTUATION = "`~!@#$%^&*()_+-=[]\\{}|;':\",./<>?";

// Utility functions
function randomChoice(collection) {
  return collection[Math.floor(Math.random() * collection.length)];
}

function setLocal(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function getLocal(key) {
  const item = window.localStorage.getItem(key);
  return item === null ? undefined : JSON.parse(item);
}

function escapeSpecialRegExpChars(str) {
  return str.replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, "\\$&");
}

function rootSelector(selector) {
  return document.querySelector(selector);
}

function rootSelectorAll(selector) {
  return document.querySelectorAll(selector);
}

class TypingPractice {
  constructor(root) {
    this.dom = {
      root: root,
      given: root.querySelector(".given"),
      typed: root.querySelector(".typed"),
      input: root.querySelector("input"),
      count: root.querySelector(".count"),
      wpm: document.querySelector("#wpm span"),
      accuracy: document.querySelector("#accuracy span"),
      beatDeviation: document.querySelector("#beatDeviation span"),
    };

    this.bufferSize = 35;
    this.focused = false;
    this.maxWordLength = 9;
    this.totalCharsTyped = getLocal("totalCharsTyped") || 0;
    this.gameState = "welcome";
    this.words = { english: [], filipino: [] };
    this.currentLanguage = "english";
    this.timerDuration = 30;
    this.modeBPM = { easy: 60, medium: 90, hard: 120 };
    this.currentMode = "medium";
    this.keyPresses = [];
    this.beatTimes = [];
    this.correctChars = 0;
    this.startTime = null;

    this._initEvents();
    this._loadWords();
  }

  async _loadWords() {
    try {
      const [englishRes, filipinoRes] = await Promise.all([
        fetch("assets/englishWords.txt"),
        fetch("assets/filipinoWords.txt")
      ]);
      this.words.english = (await englishRes.text()).split("\n").filter(w => w);
      this.words.filipino = (await filipinoRes.text()).split("\n").filter(w =>w);
      this._initBuffers();
      this.render();
    } catch (error) {
      console.error("Error loading word lists:", error);
    }
  }

  _initEvents() {
    this.dom.input.addEventListener("focus", () => {
      this.focused = true;
      this.render();
    });

    this.dom.input.addEventListener("blur", () => {
      this.focused = false;
      this.render();
    });

    this._charsetRegExp = new RegExp(
      `^[a-zA-Z0-9 ${escapeSpecialRegExpChars(PUNCTUATION)}]$`
    );

    this.dom.input.addEventListener("keydown", (e) => {
      if (this.gameState !== "playing") return;
      if (e.key === "Backspace") {
        this.backup();
      } else if (!e.ctrlKey && e.key.match(this._charsetRegExp)) {
        this.advance(e.key);
      } else {
        return;
      }
      e.preventDefault();
    });

    rootSelectorAll(".dropdown-content a").forEach(link => {
      link.addEventListener("click", (e) => {
        const parent = e.target.closest(".dropdown");
        const btn = parent.querySelector(".dropbtn");
        btn.textContent = e.target.textContent;
        if (btn.textContent.toLowerCase().includes("english") || btn.textContent.toLowerCase().includes("filipino")) {
          this.currentLanguage = e.target.textContent.toLowerCase();
          this._initBuffers();
          this.render();
        } else {
          this.timerDuration = parseInt(e.target.textContent);
        }
      });
    });

    rootSelector("#gameMode").addEventListener("click", (e) => {
      if (e.target.tagName === "A") {
        this.currentMode = e.target.getAttribute("data-mode");
        metronome.bpm = this.modeBPM[this.currentMode];
      }
    });

    rootSelector("#startBtn").addEventListener("click", () => {
      this.startGame();
    });

    rootSelector("#retryBtn").addEventListener("click", () => {
      this.startGame();
    });
  }

  _initBuffers() {
    if (!this.words[this.currentLanguage].length) return;
    const words = [];
    while (words.join(" ").length < this.bufferSize * 5) {
      words.push(randomChoice(this.words[this.currentLanguage]));
    }
    this.given = words.join(" ");
    this.typed = "";
  }

  startGame() {
    this.gameState = "playing";
    this.startTime = performance.now();
    this.keyPresses = [];
    this.beatTimes = [];
    this.correctChars = 0;
    this._initBuffers();
    metronome.start();
    this.focus();
    setTimeout(() => this.endGame(), this.timerDuration * 1000);
  }

  endGame() {
    this.gameState = "results";
    metronome.stop();
    this.calculateResults();
    this.render();
  }

  advance(key) {
    const currentTime = performance.now();
    const nearestBeat = this.beatTimes.reduce((prev, curr) =>
      Math.abs(curr - currentTime) < Math.abs(prev - currentTime) ? curr : prev
    );
    const deviation = Math.abs(currentTime - nearestBeat);

    this.keyPresses.push({
      char: key,
      time: currentTime,
      deviation: deviation,
      correct: key === this.given[this.typed.length]
    });

    if (key === this.given[this.typed.length]) {
      this.correctChars++;
    }

    this.typed += key;
    this.totalCharsTyped++;
    this.render();

    if (this.typed.length >= this.given.length) {
      this._initBuffers();
      this.typed = "";
    }
  }

  backup() {
    if (this.typed.length > 0) {
      this.typed = this.typed.slice(0, -1);
      this.keyPresses.pop();
      this.totalCharsTyped--;
      this.render();
    }
  }

  calculateResults() {
    const durationMinutes = this.timerDuration / 60;
    const wpm = Math.round((this.correctChars / 5) / durationMinutes);
    const accuracy = this.keyPresses.length
      ? Math.round((this.correctChars / this.keyPresses.length) * 100)
      : 0;
    const avgDeviation = this.keyPresses.length
      ? Math.round(
          (this.keyPresses.reduce((sum, kp) => sum + kp.deviation, 0) /
            this.keyPresses.length) * 100
        ) / 100
      : 0;

    this.dom.wpm.textContent = wpm;
    this.dom.accuracy.textContent = accuracy;
    this.dom.beatDeviation.textContent = avgDeviation;
  }

  _resetCells() {
    const bs = this.bufferSize;
    const reset = (parent) => {
      const cells = parent.querySelectorAll("div");
      if (cells.length !== bs) {
        cells.forEach(c => c.remove());
        parent.append(
          ...[...new Array(bs)].map(() => document.createElement("div"))
        );
      } else {
        cells.forEach(c => {
          c.className = "";
          c.innerHTML = "";
        });
      }
    };
    reset(this.dom.given);
    reset(this.dom.typed);
  }

  render() {
    this._resetCells();
    const bs = this.bufferSize;
    const mid = Math.floor(bs / 2);
    const d = this.typed.length - mid;
    const given = d < 0 ? this.given.slice(0, bs) : this.given.slice(d, d + bs);
    const typed = d < 0 ? this.typed : this.typed.slice(d);

    let cellsGiven = this.dom.given.querySelectorAll("div");
    let cellsTyped = this.dom.typed.querySelectorAll("div");

    [...given].forEach((c, i) => (cellsGiven[i].innerHTML = c));
    [...typed].forEach((c, i) => (cellsTyped[i].innerHTML = c));

    cellsGiven[typed.length].classList.add("hl");
    if (this.focused && this.gameState === "playing") {
      cellsTyped[typed.length].replaceWith(document.createElement("div"));
      cellsTyped = this.dom.typed.querySelectorAll("div");
      cellsTyped[typed.length].classList.add("hl", "animated");
    }

    [...typed].forEach((c, i) => {
      if (given[i] !== c) {
        cellsGiven[i].classList.add("err");
        cellsTyped[i].classList.add("err");
      }
    });

    this.dom.count.innerHTML = this.totalCharsTyped;
    rootSelector("#welcome").style.display =
      this.gameState === "welcome" ? "block" : "none";
    rootSelector("#results").style.display =
      this.gameState === "results" ? "block" : "none";
  }

  focus() {
    this.dom.input.focus();
    this.focused = true;
    this.render();
  }
}

class Metronome {
  constructor(root, practice) {
    this.dom = {
      root: root,
      text: root.querySelector("span"),
      btnToggle: root.querySelector(".toggle"),
      btnFaster: root.querySelector(".faster"),
      btnSlower: root.querySelector(".slower"),
    };
    this.practice = practice;
    this.bpm = getLocal("metronomeBPM") || 90;
    this._intervalID = null;
    this._ac = null;
    this._nextTickTime = 0;
    this._initEvents();
    this.render();
  }

  _initEvents() {
    this.dom.btnToggle.addEventListener("click", () => {
      if (!this.ticking) {
        this.practice.startGame();
      } else {
        this.practice.endGame();
      }
    });
    this.dom.btnFaster.addEventListener("click", () => (this.bpm += 30));
    this.dom.btnSlower.addEventListener("click", () => (this.bpm -= 30));
  }

  get bpm() {
    return this._bpm;
  }

  set bpm(value) {
    const v = parseInt(value);
    if (v >= 15 && v <= 600) {
      this._bpm = v;
      setLocal("metronomeBPM", v);
      this.render();
    }
  }

  get ticking() {
    return this._intervalID !== null;
  }

  _scheduleTick(time) {
    this.practice.beatTimes.push(time * 1000);
    const osc = this._ac.createOscillator();
    const envelope = this._ac.createGain();
    osc.frequency.value = 800;
    envelope.gain.value = 1;
    envelope.gain.exponentialRampToValueAtTime(1, time + 0.001);
    envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.02);
    osc.connect(envelope);
    envelope.connect(this._ac.destination);
    osc.start(time);
    osc.stop(time + 0.03);
  }

  start() {
    if (this.ticking) return;
    this._ac = new (window.AudioContext || window.webkitAudioContext)();
    this._nextTickTime = this._ac.currentTime + 60 / this.bpm;
    this._intervalID = setInterval(() => {
      while (this._nextTickTime < this._ac.currentTime + 0.1) {
        this._scheduleTick(this._nextTickTime);
        this._nextTickTime += 60 / this.bpm;
      }
    }, 25);
    this.render();
  }

  stop() {
    if (this.ticking) {
      clearInterval(this._intervalID);
      this._ac.close();
      this._ac = null;
      this._nextTickTime = 0;
      this._intervalID = null;
    }
    this.render();
  }

  toggle() {
    return this.ticking ? this.stop() : this.start();
  }

  render() {
    this.dom.root.className = this.ticking ? "on" : "off";
    this.dom.text.innerHTML = this.ticking ? `${this.bpm} BPM` : "metronome";
  }
}

// Initialize
const practice = new TypingPractice(document.getElementById("practice"));
const metronome = new Metronome(document.getElementById("metronome"), practice);

practice.focus();
