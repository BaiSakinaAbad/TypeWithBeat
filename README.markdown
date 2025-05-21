# Type with Beat

## Introduction
**Type with Beat** is a web-based typing game that combines typing speed, accuracy, and rhythmic timing for an engaging and challenging experience. Developed as a final project for the Design and Analysis of Algorithms (DAA) course, this game introduces a unique twist to traditional typing tests by incorporating a metronome beat. Players type words in sync with a predefined tempo, making it feel like a dance for their fingers! Built using HTML, CSS, and JavaScript, Type with Beat offers a fun way to improve typing skills while keeping rhythm.

The game challenges players to:
- Type words correctly and in sync with a steady metronome beat.
- View detailed post-test analytics, including Words Per Minute (WPM), Accuracy, and KeyStroke timing (beat deviation).

Whether you're a beginner typist or a seasoned pro, Type with Beat provides a dynamic and rhythmic way to enhance your skills.

## Author
- **Bai Sakina Abad**  
  Created as a final project for the Design and Analysis of Algorithms (DAA) course.

## Features
- **Multi-Language Support**: Choose from English, Filipino, or Japanese word lists to practice typing in different languages. Will include more language soon!
- **Customizable Timer**: Select game durations of 15, 30, or 60 seconds to suit your practice needs.
- **Tempo Modes**: Play in various metronome speeds:
  - Easy (150 BPM)
  - Medium (180 BPM)
  - Hard (210 BPM)
  - Impossible (300 BPM)
- **Rhythmic Typing**: Type in sync with a metronome beat, with real-time feedback on how close your keystrokes are to the tempo (e.g., "Perfect!", "Good", or "Slow").
- **Post-Game Analytics**: View detailed results, including:
  - **Words Per Minute (WPM)**: Measures typing speed.
  - **Accuracy**: Percentage of correct keystrokes.
  - **Beat Deviation**: Average time difference between keystrokes and metronome beats, shown in milliseconds.
- **Visual Feedback**: Errors are highlighted in red, and the next character to type is marked, making it easy to follow along.
- **Interactive Charts**: Results are displayed in colorful doughnut charts (powered by Chart.js) for WPM, accuracy, and beat deviation.
- **Responsive Design**: Works seamlessly on desktop browsers, with a clean and intuitive interface.

## UI Preview
Below is a preview of the Type with Beat user interface, showcasing the gameplay, settings, and result charts:

![Type with Beat Gameplay](typing-practice\assets\welcomUI.png)

*Note*: Ensure the `typewithbeat_preview.gif` file is placed in the `assets` folder of the repository. If you haven't created the GIF yet, you can record a short clip of the game (e.g., selecting a language, typing to the beat, and viewing results) using a screen recording tool and convert it to GIF format.

## How to Clone and Run
Follow these steps to set up and run Type with Beat on your local machine:

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/BaiSakinaAbad/TypeWithBeat.git
   ```
   This downloads the project files to your computer.

2. **Navigate to the Project Folder**:
   ```bash
   cd TypeWithBeat
   ```

3. **Serve the Project**:
   Since Type with Beat is a web-based application, you need a local server to run it. You can use a simple HTTP server like Python's built-in server:
   - If you have Python installed, run:
     ```bash
     python -m http.server 8000
     ```
   - Alternatively, use tools like `Live Server` in Visual Studio Code or any other local server.

4. **Open in a Browser**:
   - Open your web browser and go to `http://localhost:8000` (or the port specified by your server).
   - The game should load, allowing you to select a language, timer, and tempo mode to start playing.

5. **Dependencies**:
   - No external installations are required beyond a modern web browser.
   - The project includes Chart.js (loaded via CDN in `index.html`) for result charts.
   - Word lists (`englishWords.txt`, `filipinoWords.txt`, `japaneseWords.txt`) are included in the `assets` folder.

## License
This project is licensed under the **MIT License**. You are free to use, modify, and distribute the code, provided you include the original license file (`LICENSE`) and give credit to the author. See the [LICENSE](LICENSE) file in the repository for full details.

## Acknowledgments
- Developed for the Design and Analysis of Algorithms (DAA) course.
- Built with HTML, CSS, JavaScript, and Chart.js.
- Inspired by the goal of combining typing practice with rhythmic challenges.

Enjoy typing to the beat, and happy coding! 🎵