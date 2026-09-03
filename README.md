# ✋ AIR JUGGLER

> A futuristic AI-powered gesture-controlled browser game where your hand becomes the controller.

AIR JUGGLER uses real-time computer vision to track hand movements through your webcam and control an in-game paddle. Keep the ball alive, build combos, unlock difficulty levels, and use your head for emergency saves!

---

## 🎮 Live Gameplay

Move your hand in front of the camera to control the paddle.

- 🏀 Keep the ball alive
- ✋ Control using hand gestures
- 🧠 Use your head for emergency saves
- 🔥 Build combos and increase your score
- ⚡ Survive increasingly difficult levels

---

## ✨ Features

### 🤖 AI & Computer Vision

- Real-time hand tracking
- Real-time face tracking
- Gesture-controlled paddle movement
- Smooth hand movement interpolation
- Hand detection monitoring
- Camera permission handling

### 🎮 Game Mechanics

- Physics-based ball movement
- Dynamic paddle collision
- Wall and ceiling collisions
- Head Save mechanic
- Score system
- Combo progression
- Near-miss feedback
- Progressive difficulty levels

### 📈 Difficulty System

| Level | Name | Unlock Score |
|-------|------|--------------|
| 1 | 🟢 EASY | 0 |
| 2 | 🟡 MEDIUM | 6 |
| 3 | 🟠 HARD | 16 |
| 4 | 🔴 INSANE | 31 |

As your score increases, the game becomes faster and more challenging.

---

## 🎨 Visual Effects

- Neon futuristic UI
- Ball motion trail
- Particle explosions
- Screen shake
- Hit flash effects
- Level-up animations
- Combo animations
- Paddle power effects

---

## 🔊 Sound System

- Paddle hit sounds
- Head Save sounds
- Level-up sounds
- Game-over effects

---

## 💾 Game Persistence

- High score saved using LocalStorage
- Best score persists between sessions

---

## ⚙️ Game Controls

| Control | Action |
|---------|--------|
| ✋ Hand Movement | Move Paddle |
| 🧠 Head | Emergency Head Save |
| `P` | Pause / Resume |
| `ESC` | Pause / Resume |

---

## 🛠️ Tech Stack

- HTML5
- CSS3
- JavaScript (ES6+)
- MediaPipe Tasks Vision
- WebRTC / getUserMedia
- Canvas API
- Web Audio API
- LocalStorage

---

## 🧠 AI Technologies

AIR JUGGLER uses MediaPipe computer vision models for real-time tracking:

- Hand Landmarker
- Face Landmarker

The AI processes webcam frames directly in the browser and maps detected landmarks to the game environment.

---

## 📁 Project Structure

```text
air-juggler/
│
├── index.html
├── style.css
├── script.js
└── README.md
```

---

## 🚀 How to Run Locally

### 1. Clone the repository

```bash
git clone https://github.com/koushik8369-ux/air-juggler.git
```

### 2. Navigate to the project folder

```bash
cd air-juggler
```

### 3. Open with a local server

You can use the VS Code **Live Server** extension.

Or open the project folder in VS Code:

```bash
code .
```

Then start `index.html` using Live Server.

> ⚠️ Camera access works best when running through localhost or HTTPS.

---

## 📷 Requirements

- A device with a webcam
- Camera permission enabled
- Modern browser (Chrome or Edge recommended)
- Stable internet connection for loading MediaPipe AI models

---

## 🧪 Testing Checklist

- [x] Camera permission handling
- [x] Hand tracking
- [x] Face tracking
- [x] Paddle movement
- [x] Ball physics
- [x] Head Save mechanic
- [x] Pause and resume
- [x] Difficulty progression
- [x] High score persistence
- [x] Restart functionality
- [x] Desktop responsiveness
- [x] Mobile responsiveness

---

## 🔮 Future Improvements

- Multiple game modes
- Multiplayer support
- Global leaderboard
- Custom ball skins
- Gesture-based power-ups
- Mobile optimization
- Performance analytics
- Sound settings
- Full-screen mode

---

## 👨‍💻 Author

**Koushik Gowda KS**

GitHub: https://github.com/koushik8369-ux

---

## ⭐ Support

If you like this project, consider giving it a ⭐ on GitHub!

---

<p align="center">
  Made with ❤️ using JavaScript and AI Computer Vision
</p>