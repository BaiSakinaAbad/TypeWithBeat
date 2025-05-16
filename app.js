"use strict";

// Character sets for input validation
const LETTERS_LOWER = "abcdefghijklmnopqrstuvwxyz"; 
const LETTERS_UPPER = LETTERS_LOWER.toUpperCase(); 
const DIGITS = "0123456789";
const PUNCTUATION = "`~!@#$%^&*()_+-=[]\\{}|;':\",./<>?";

//Utility Functions Picks a random item from a collection (e.g., array or string)
function randomChoice(collection) {
  return collection[Math.floor(Math.random() * collection.length)];
}

// Saves a value to localStorage as JSON
function setLocal(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

// Retrieves and parses a value from localStorage, returns undefined if not found
function getLocal(key) {
  const item = window.localStorage.getItem(key);
  return item === null ? undefined : JSON.parse(item);
}

// Escapes special characters in a string for use in regular expressions
function escapeSpecialRegExpChars(str) {
  return str.replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, "\\$&");
}

// Selects a single DOM element by CSS selector
function rootSelector(selector) {
  return document.querySelector(selector);
}

// Selects all DOM elements matching a CSS selector
function rootSelectorAll(selector) {
  return document.querySelectorAll(selector);
}

// Gets the value of a CSS variable (e.g., --color) from the document's root
function getCSSVariableValue(variableName) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim();
}

// Main class for the typing game
class TypingPractice {
  constructor(root) {
    // Store references to DOM elements for easy access
    this.dom = {
      root: root, 
      given: root.querySelector(".given"), 
      typed: root.querySelector(".typed"), 
      input: root.querySelector("input"), 
      count: root.querySelector(".count"), 
      wpm: document.querySelector("#wpmValue"), 
      accuracy: document.querySelector("#accuracyValue"), 
      beatDeviation: document.querySelector("#beatDeviationValue"), 
      timer: document.querySelector("#mainTimer"), 
      preCountdown: document.querySelector("#preCountdown"), 
      wpmChart: document.querySelector("#wpmChart"), 
      accuracyChart: document.querySelector("#accuracyChart"), 
      beatDeviationChart: document.querySelector("#beatDeviationChart"), 
      beatFeedback: document.querySelector("#beatFeedback"), 
      startButton: rootSelector("#startBtn"),
    };

    // Initialize game state and settings
    this.bufferSize = 35; // Number of characters to display at once
    this.focused = false; // Tracks if input field is focused
    this.maxWordLength = 10;
    this.totalCharsTyped = 0; 
    this.gameState = "welcome"; // Current game state (welcome, pre-countdown, playing, results)
    this.words = { english: [], filipino: [], japanese: [] }; // Arrays of words for each language
    this.currentLanguage = "english"; 
    this.timerDuration = 30;
    this.modeBPM = { easy: 150, medium: 180, hard: 210, impossible: 300 };
    this.currentMode = "medium"; 
    this.keyPresses = []; // Array of key press objects (char, time, deviation, correct)
    this.beatTimes = []; // Array of metronome beat timestamps
    this.correctChars = 0; 
    this.startTime = null; // Timestamp when game starts
    this._timerInterval = null; // Interval ID for game timer
    this.charts = {};

    // Set up event listeners and load word lists
    this._initEvents();
    this._loadWords();
  }

  // Load word lists from text files for each language
  async _loadWords() {
    try {
      const [englishRes, filipinoRes, japaneseRes] = await Promise.all([
        fetch("assets/englishWords.txt"),
        fetch("assets/filipinoWords.txt"),
        fetch("assets/japaneseWords.txt")
      ]);

      // Parse text files into arrays, filtering out empty lines
      this.words.english = (await englishRes.text()).split("\n").filter(w => w);
      this.words.filipino = (await filipinoRes.text()).split("\n").filter(w => w);
      this.words.japanese = (await japaneseRes.text()).split("\n").filter(w => w);

      // Initialize word buffer and render initial UI
      this._initBuffers();
      this.render();
    } catch (error) {
      console.error("Error loading word lists:", error);
    }
  }

  // Set up event listeners for user interactions
  _initEvents() {
    this.dom.input.addEventListener("focus", () => {
      this.focused = true;
      this.render(); // Update UI to show focus state
    });

    // Handle input field blur
    this.dom.input.addEventListener("blur", () => {
      this.focused = false;
      this.render(); // Update UI to remove focus state
    });

    // Regular expression for valid input characters (letters, digits, punctuation)
    this._charsetRegExp = new RegExp(
      `^[a-zA-Z0-9 ${escapeSpecialRegExpChars(PUNCTUATION)}]$`
    );

    // Handle keydown events for typing
    this.dom.input.addEventListener("keydown", (e) => {
      if (this.gameState !== "playing") return; // Only process input during gameplay
      if (e.key === "Backspace") {
        this.backup(); // Remove last typed character
      } else if (!e.ctrlKey && e.key.match(this._charsetRegExp)) {
        this.advance(e.key); // Process valid key press
      } else {
        return; // Ignore invalid keys
      }
      e.preventDefault(); // Prevent default browser behavior
    });

    // Handle dropdown menu selections (language and timer)
    rootSelectorAll(".dropdown-content a").forEach(link => {
      link.addEventListener("click", (e) => {
        const parent = e.target.closest(".dropdown");
        const btn = parent.querySelector(".dropbtn");
        btn.textContent = e.target.textContent; // Update dropdown button text
        const rawText = e.target.textContent.trim();
        const text = rawText.replace(/^[^\w]+/, "").toLowerCase();

        // Update language and refresh word buffer
        if (["english", "filipino", "japanese"].includes(text)) {
          this.currentLanguage = text;
          this._initBuffers();
          this.render();
        // Update timer duration
        } else if (/^\d+(s)?$/.test(text)) {
          const num = parseInt(text);
          if (!isNaN(num)) {
            this.timerDuration = num;
          }
        }
      });
    });

    // Handle difficulty mode selection
    rootSelectorAll("#difficultyOptions a").forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const mode = e.target.getAttribute("data-mode"); // Get difficulty mode
        this.currentMode = mode;
        metronome.bpm = this.modeBPM[mode]; // Update metronome speed

        // Update dropdown button text
        const dropdownBtn = e.target.closest(".dropdown").querySelector(".dropbtn");
        dropdownBtn.textContent = e.target.textContent;
      });
    });

    // Start game when start button is clicked
    this.dom.startButton.addEventListener("click", () => {
      this.startGame();
    });

    // Reset game when retry button is clicked
    rootSelector("#retryBtn").addEventListener("click", () => {
      this.resetGame();
    });
  }

  // Initialize the word buffer with random words for typing
  _initBuffers() {
    if (!this.words[this.currentLanguage].length) return; // Exit if no words loaded
    const words = [];
    // Build a string of words until it exceeds buffer size
    while (words.join(" ").length < this.bufferSize * 5) {
      words.push(randomChoice(this.words[this.currentLanguage]));
    }
    // Join words into a single string, normalize spaces
    this.given = words.join(" ").replace(/\s+/g, " ").trim();
    this.typed = ""; // Clear typed input
  }

  // Display a 3-second countdown 
  startPreCountdown(callback) {
    let count = 3;
    this.dom.preCountdown.textContent = count;
    this.dom.timer.textContent = "";
    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        this.dom.preCountdown.textContent = count; // Show countdown number
      } else if (count === 0) {
        this.dom.preCountdown.textContent = "GO"; // Show "GO"
      } else {
        this.dom.preCountdown.textContent = ""; // Clear countdown
        clearInterval(interval);
        callback(); // Start main game logic
      }
    }, 1000);
  }

  // Start the main game timer countdown
  startCountdown() {
    let remaining = this.timerDuration; // Initialize with game duration
    this.dom.timer.textContent = remaining;
    this.dom.preCountdown.textContent = ""; // Clear pre-countdown text

    // Update timer every second
    this._timerInterval = setInterval(() => {
      if (remaining > 0) {
        remaining--;
        this.dom.timer.textContent = remaining; // Update timer display
      }
      if (remaining <= 0) {
        clearInterval(this._timerInterval); // Stop timer when done
      }
    }, 1000);
  }

  // Reset game state to initial values
  resetGame() {
    this.gameState = "welcome"; // Return to welcome screen
    this.keyPresses = []; 
    this.beatTimes = []; 
    this.correctChars = 0; 
    this.totalCharsTyped = 0; 
    this.startTime = null; // Clear start time
    this.dom.beatFeedback.textContent = ""; // Clear beat feedback
    this._initBuffers(); // Reload words
    this.dom.startButton.disabled = false; // Re-enable start button
    this.dom.preCountdown.textContent = ""; 
    this.dom.timer.textContent = this.timerDuration;
    this.render(); // Update UI
  }

  // Start a new game session
  startGame() {
    this.dom.startButton.disabled = true; // Disable start button to prevent multiple starts
    this.gameState = "pre-countdown"; // Enter pre-countdown state
    this.startPreCountdown(() => {
      // Main game logic after countdown
      this.gameState = "playing"; 
      this.startTime = performance.now(); // Record start time
      this.keyPresses = []; 
      this.beatTimes = []; 
      this.correctChars = 0; 
      this.totalCharsTyped = 0; 
      this.dom.beatFeedback.textContent = ""; 
      this._initBuffers(); // Load new words
      metronome.start(); // Start metronome
      this.focus(); // Focus input field
      this.startCountdown();
      // End game after timer duration
      setTimeout(() => this.endGame(), this.timerDuration * 1000);
    });
  }

  // End the game and show results
  endGame() {
    this.gameState = "results"; // Enter results state
    metronome.stop();
    if (this._timerInterval) clearInterval(this._timerInterval); // Stop timer
    this.dom.beatFeedback.textContent = "";
    this.dom.preCountdown.textContent = ""; 
    this.calculateResults(); // Compute WPM, accuracy, and beat deviation
    this.dom.startButton.disabled = false; // Re-enable start button
    this.render(); 
    this.renderCharts(); 
  }

  // Provide feedback on how well a key press matches the metronome beat
  getBeatSyncFeedback(deviation) {
    if (this.beatTimes.length === 0) return ""; // No beats yet
    if (deviation <= 75) return "Perfect!"; // Within 75ms
    if (deviation <= 200) return "Good"; // Within 200ms
    if (deviation <= 300) return "Slow"; // Within 300ms
    return "Bad"; // Over 300ms
  }

  // Process a key press and update game state
  advance(key) {
    const currentTime = performance.now(); // Get current timestamp

    // Handle first key press or no beats
    if (this.beatTimes.length === 0) {
      this.keyPresses.push({
        char: key, // Typed character
        time: currentTime, // Timestamp
        deviation: 0, // No deviation if no beats
        correct: key === this.given[this.typed.length] // Check if key matches expected character
      });
      this.dom.beatFeedback.textContent = "Waiting for beat...";
    } else {
      // Find the closest metronome beat
      const nearestBeat = this.beatTimes.reduce((prev, curr) =>
        Math.abs(curr - currentTime) < Math.abs(prev - currentTime) ? curr : prev
      );
      const deviation = Math.abs(currentTime - nearestBeat); // Calculate time difference

      // Record key press details
      this.keyPresses.push({
        char: key,
        time: currentTime,
        deviation: deviation,
        correct: key === this.given[this.typed.length] // String matching: compare typed key to expected
      });

      // Show beat sync feedback
      const feedback = this.getBeatSyncFeedback(deviation);
      this.dom.beatFeedback.textContent = feedback;
    }

    // Increment correct character count if key matches
    if (key === this.given[this.typed.length]) {
      this.correctChars++;
    }

    // Update typed string and total count
    this.typed += key;
    this.totalCharsTyped++;
    this.render();

    // If all words are typed, load new words
    if (this.typed.length >= this.given.length) {
      this._initBuffers();
      this.typed = "";
    }
  }

  // Handle backspace to remove last typed character
  backup() {
    if (this.typed.length > 0) {
      this.typed = this.typed.slice(0, -1); // Remove last character
      this.keyPresses.pop(); // Remove last key press
      this.totalCharsTyped--; // Decrement total count
      this.render();
    }
  }

  // Calculate and display game results
  calculateResults() {
    const durationMinutes = this.timerDuration / 60; // Convert seconds to minutes
    // Calculate Words Per Minute (WPM): (correct chars / 5) / minutes
    const wpm = Math.round((this.correctChars / 5) / durationMinutes);
    // Calculate accuracy: (correct chars / total key presses) * 100
    const accuracy = this.keyPresses.length
      ? Math.round((this.correctChars / this.keyPresses.length) * 100)
      : 0;
    // Calculate average beat deviation: sum of deviations / key presses
    const avgDeviation = this.keyPresses.length
      ? Math.round(
          (this.keyPresses.reduce((sum, kp) => sum + kp.deviation, 0) /
            this.keyPresses.length) * 100
        ) / 100 // Round to two decimal places
      : NaN;

    // Update DOM with results
    this.dom.wpm.textContent = wpm;
    this.dom.accuracy.textContent = accuracy;
    this.dom.beatDeviation.textContent = isNaN(avgDeviation) ? "N/A" : avgDeviation;

    return { wpm, accuracy, avgDeviation }; // Return results for charting
  }

  // Render result charts using Chart.js
  renderCharts() {
    const { wpm, accuracy, avgDeviation } = this.calculateResults();
    // Destroy existing charts to prevent overlap
    Object.values(this.charts).forEach(chart => chart.destroy());

    // Resolve CSS variables for chart colors
    const chartWpmColor = getCSSVariableValue('--wpm-green');
    const chartAccuracyColor = getCSSVariableValue('--chart-accuracy');
    const neutralGrayColor = getCSSVariableValue('--neutral-gray');
    const wpmGreenColor = getCSSVariableValue('--chart-wpm');

    // Plugin to display text in the center of doughnut charts
    const centerTextPlugin = {
      id: 'centerText',
      afterDraw(chart) {
        const { ctx, chartArea: { width, height } } = chart;
        const centerX = width / 2;
        const centerY = height / 2;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 18px sans-serif';
        const value = chart.config.options.plugins.centerText.value;
        ctx.fillStyle = chart.data.datasets[0].backgroundColor[0];
        ctx.fillText(value, centerX, centerY);
        ctx.restore();
      }
    };

    // Set chart color based on beat deviation
    const getDeviationColor = (dev) => {
      if (isNaN(dev)) return neutralGrayColor; // No typing
      if (dev <= 75) return '#4CAF50'; // Excellent
      if (dev <= 200) return '#FFC107'; // Good
      return '#F44336'; // Poor
    };

    // Set feedback label based on beat deviation
    const getDeviationLabel = (dev) => {
      if (isNaN(dev)) return 'No Typing';
      if (dev <= 75) return 'Excellent Timing';
      if (dev <= 200) return 'Moderate Rhythm';
      return 'Off-beat, more practice';
    };

    // Update beat feedback display
    const deviationColor = getDeviationColor(avgDeviation);
    const deviationFeedback = getDeviationLabel(avgDeviation);
    this.dom.beatFeedback.textContent = deviationFeedback;

    // Show confetti animation for excellent timing
    if (!isNaN(avgDeviation) && avgDeviation <= 75) {
      const confetti = document.createElement('div');
      confetti.classList.add('confetti');
      confetti.textContent = '🎉';
      confetti.style.position = 'fixed';
      confetti.style.top = '30%';
      confetti.style.left = '50%';
      confetti.style.fontSize = '3rem';
      confetti.style.zIndex = 9999;
      confetti.style.transform = 'translate(-50%, -50%) scale(1)';
      confetti.style.transition = 'opacity 1s ease-out, transform 1s ease-out';
      document.body.appendChild(confetti);
      setTimeout(() => {
        confetti.style.opacity = 0;
        confetti.style.transform = 'translate(-50%, -50%) scale(2)';
      }, 200);
      setTimeout(() => confetti.remove(), 1200);
    }

    // Create WPM chart
    this.charts.wpm = new Chart(this.dom.wpmChart, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [wpm, Math.max(0, 100 - wpm)], // WPM and complement to 100
          backgroundColor: [chartWpmColor, wpmGreenColor],
          borderWidth: 0
        }]
      },
      options: {
        cutout: '70%', // Doughnut hole size
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
          centerText: { value: `${wpm}` } // Display WPM in center
        },
        maintainAspectRatio: false
      },
      plugins: [centerTextPlugin]
    });

    // Create accuracy chart
    this.charts.accuracy = new Chart(this.dom.accuracyChart, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [accuracy, Math.max(0, 100 - accuracy)], // Accuracy and complement
          backgroundColor: [chartAccuracyColor, neutralGrayColor],
          borderWidth: 0
        }]
      },
      options: {
        cutout: '70%',
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
          centerText: { value: `${accuracy}%` } // Display accuracy in center
        },
        maintainAspectRatio: false
      },
      plugins: [centerTextPlugin]
    });

    // Create beat deviation chart
    const deviationScore = isNaN(avgDeviation) ? 0 : Math.max(0, 500 - avgDeviation);
    const deviationComplement = isNaN(avgDeviation) ? 500 : 500 - deviationScore;
    this.charts.beatDeviation = new Chart(this.dom.beatDeviationChart, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [deviationScore, deviationComplement], // Deviation score and complement
          backgroundColor: [deviationColor, neutralGrayColor],
          borderWidth: 0
        }]
      },
      options: {
        cutout: '70%',
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
          centerText: { value: isNaN(avgDeviation) ? "N/A" : `${avgDeviation}ms` } // Display deviation
        },
        maintainAspectRatio: false
      },
      plugins: [centerTextPlugin]
    });
  }

  // Reset the display grid for given and typed text
  _resetCells() {
    const bs = this.bufferSize;
    // Reset a container's cells to match buffer size
    const reset = (parent) => {
      const cells = parent.querySelectorAll("div");
      if (cells.length !== bs) {
        cells.forEach(c => c.remove());
        // Create new cells
        parent.append(
          ...[...new Array(bs)].map(() => document.createElement("div"))
        );
      } else {
        // Clear existing cells
        cells.forEach(c => {
          c.className = "";
          c.innerHTML = "";
        });
      }
    };
    reset(this.dom.given); // Reset given text grid
    reset(this.dom.typed); // Reset typed text grid
  }

  // Render the game UI
  render() {
    this._resetCells(); // Reset display grids
    const bs = this.bufferSize;
    const mid = Math.floor(bs / 2); // Center point of buffer
    const d = this.typed.length - mid; // Offset for scrolling text
    // Slice text to fit buffer
    const given = d < 0 ? this.given.slice(0, bs) : this.given.slice(d, d + bs);
    const typed = d < 0 ? this.typed : this.typed.slice(d);

    // Get DOM cells
    let cellsGiven = this.dom.given.querySelectorAll("div");
    let cellsTyped = this.dom.typed.querySelectorAll("div");

    // Populate cells with characters
    [...given].forEach((c, i) => (cellsGiven[i].innerHTML = c));
    [...typed].forEach((c, i) => (cellsTyped[i].innerHTML = c));

    // Highlight next character to type
    cellsGiven[typed.length].classList.add("hl");
    // Animate cursor when focused and playing
    if (this.focused && this.gameState === "playing") {
      cellsTyped[typed.length].replaceWith(document.createElement("div"));
      cellsTyped = this.dom.typed.querySelectorAll("div");
      cellsTyped[typed.length].classList.add("hl", "animated");
    }

    // Mark incorrect characters
    [...typed].forEach((c, i) => {
      if (given[i] !== c) {
        cellsGiven[i].classList.add("err");
        cellsTyped[i].classList.add("err");
      }
    });

    // Update total character count display
    this.dom.count.textContent = this.totalCharsTyped;
    // Show/hide welcome and results screens
    rootSelector("#welcome").style.display = this.gameState === "welcome" ? "block" : "none";
    rootSelector("#results").style.display = this.gameState === "results" ? "block" : "none";
  }

  // Focus the input field
  focus() {
    this.dom.input.focus();
    this.focused = true;
    this.render(); // Update UI to reflect focus
  }
}

// Metronome class for beat synchronization
class Metronome {
  constructor(root, practice) {
    // Store DOM elements for metronome controls
    this.dom = {
      root: root, // Metronome container
      text: root.querySelector("span"), 
      btnToggle: root.querySelector(".toggle"),
      btnFaster: root.querySelector(".faster"), 
      btnSlower: root.querySelector(".slower"), 
    };
    this.practice = practice; 
    this.bpm = getLocal("metronomeBPM") || 90; // Initial BPM (beats per minute)
    this._intervalID = null; 
    this._ac = null; // AudioContext for sound
    this._nextTickTime = 0; // Time of next beat
    this._startTime = 0; // Start time of metronome
    this._initEvents(); // Set up event listeners
    this.render(); 
  }

  // Set up event listeners for metronome controls
  _initEvents() {
    // Toggle metronome on/off
    this.dom.btnToggle.addEventListener("click", () => {
      if (!this.ticking) {
        this.practice.startGame(); // Start game and metronome
      } else {
        this.practice.endGame(); // End game and stop metronome
      }
    });

    // Increase BPM by 30
    this.dom.btnFaster.addEventListener("click", () => {
      this.bpm = this._bpm + 30;
    });

    // Decrease BPM by 30
    this.dom.btnSlower.addEventListener("click", () => {
      this.bpm = this._bpm - 30;
    });
  }

  // Get current BPM
  get bpm() {
    return this._bpm;
  }

  // Set BPM, constrain between 150 and 300, and save to localStorage
  set bpm(value) {
    const v = Math.min(Math.max(parseInt(value), 150), 300);
    this._bpm = v;
    setLocal("metronomeBPM", v);
    this.render();
  }

  // Check if metronome is running
  get ticking() {
    return this._intervalID !== null;
  }

  // Schedule a metronome tick with sound
  _scheduleTick(time) {
    const adjustedTime = this._startTime + (time * 1000); // Convert to milliseconds
    this.practice.beatTimes.push(adjustedTime); // Store beat timestamp
    // Create oscillator for tick sound
    const osc = this._ac.createOscillator();
    const envelope = this._ac.createGain();
    osc.frequency.value = 800; // Set pitch
    envelope.gain.value = 1;
    envelope.gain.exponentialRampToValueAtTime(1, time + 0.001);
    envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.02);
    osc.connect(envelope);
    envelope.connect(this._ac.destination);
    osc.start(time);
    osc.stop(time + 0.03); // Short tick sound
  }

  // Start the metronome
  start() {
    if (this.ticking) return; // Prevent multiple starts
    this._ac = new (window.AudioContext || window.webkitAudioContext)(); // Initialize audio
    this._startTime = performance.now(); // Record start time
    this._nextTickTime = this._ac.currentTime + 60 / this.bpm; // Schedule first tick
    // Schedule ticks every 25ms
    this._intervalID = setInterval(() => {
      while (this._nextTickTime < this._ac.currentTime + 0.1) {
        this._scheduleTick(this._nextTickTime);
        this._nextTickTime += 60 / this.bpm; // Schedule next tick
      }
    }, 25);
    this.render(); // Update UI
  }

  // Stop the metronome
  stop() {
    if (this.ticking) {
      clearInterval(this._intervalID); // Stop scheduling
      this._ac.close(); // Close audio context
      this._ac = null;
      this._nextTickTime = 0;
      this._startTime = 0;
      this._intervalID = null;
    }
    this.render(); 
  }

  // Toggle metronome on/off
  toggle() {
    return this.ticking ? this.stop() : this.start();
  }

  // Update metronome UI
  render() {
    this.dom.root.className = this.ticking ? "on" : "off"; // Update toggle state
    this.dom.text.innerHTML = this.ticking ? `${this.bpm} BPM` : "metronome";
  }
}

// Initialize the game
const practice = new TypingPractice(document.getElementById("practice")); // Create game instance
const metronome = new Metronome(document.getElementById("metronome"), practice); // Create metronome instance
practice.focus();