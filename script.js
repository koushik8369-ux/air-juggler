import {
    FilesetResolver,
    HandLandmarker,
    FaceLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

// ================= DOM =================

const startButton = document.getElementById("start-btn");
const restartButton = document.getElementById("restart-btn");
const pauseButton = document.getElementById("pause-btn");
const resumeButton = document.getElementById("resume-btn");

const startScreen = document.getElementById("start-screen");
const readyScreen = document.getElementById("ready-screen");
const pauseScreen = document.getElementById("pause-screen");
const gameOverScreen = document.getElementById("game-over-screen");

const readyTitle = document.getElementById("ready-title");
const readyText = document.getElementById("ready-text");
const countdownElement = document.getElementById("countdown");

const webcam = document.getElementById("webcam");
const canvas = document.getElementById("output-canvas");
const ctx = canvas.getContext("2d");

const paddle = document.getElementById("paddle");
const ball = document.getElementById("ball");
const gameArea = document.getElementById("game-area");

const particlesContainer = document.getElementById("particles-container");
const comboText = document.getElementById("combo-text");
const ballTrail = document.getElementById("ball-trail");
const hitFlash = document.getElementById("hit-flash");
const trackingStatus = document.getElementById("tracking-status");
const cameraError = document.getElementById("camera-error");
const retryButton = document.getElementById("retry-btn");
const levelUpText = document.getElementById("level-up-text");
const levelUpName = document.getElementById("level-up-name");

const scoreElement = document.getElementById("score");
const highScoreElement = document.getElementById("high-score");
const finalScoreElement = document.getElementById("final-score");
const difficultyElement = document.getElementById("difficulty");
const finalBestElement = document.getElementById("final-best");
const finalLevelElement = document.getElementById("final-level");
const performanceMessage = document.getElementById("performance-message");

// ================= SOUND =================

let audioContext = null;

function initAudio() {
    if (!audioContext) {
        audioContext = new (
            window.AudioContext || window.webkitAudioContext
        )();
    }

    if (audioContext.state === "suspended") {
        audioContext.resume();
    }
}

function playTone(frequency, duration, type = "sine", volume = 0.15) {
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(
        frequency,
        audioContext.currentTime
    );

    gainNode.gain.setValueAtTime(
        volume,
        audioContext.currentTime
    );

    gainNode.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + duration
    );

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
}

function playHitSound() {
    playTone(320, 0.08, "sine", 0.18);

    setTimeout(() => {
        playTone(520, 0.06, "sine", 0.1);
    }, 40);
}

function playHeadSound() {
    playTone(700, 0.08, "square", 0.14);

    setTimeout(() => {
        playTone(950, 0.15, "sine", 0.16);
    }, 70);
}

function playLevelUpSound() {
    playTone(440, 0.1, "sine", 0.12);

    setTimeout(() => {
        playTone(660, 0.1, "sine", 0.14);
    }, 100);

    setTimeout(() => {
        playTone(880, 0.2, "sine", 0.18);
    }, 200);
}

function playGameOverSound() {
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = "sawtooth";

    oscillator.frequency.setValueAtTime(
        300,
        audioContext.currentTime
    );

    oscillator.frequency.exponentialRampToValueAtTime(
        80,
        audioContext.currentTime + 0.5
    );

    gainNode.gain.setValueAtTime(
        0.15,
        audioContext.currentTime
    );

    gainNode.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.5
    );

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.5);
}

// ================= AI TRACKING =================

let handLandmarker;
let faceLandmarker;

let cameraStarted = false;
let detectionLoopStarted = false;
let lastVideoTime = -1;

let countdownStarted = false;
let countdownTimer = null;
let countdownFinishTimer = null;
let smoothX = null;
let handLastSeenTime = 0;
let levelUpInProgress = false;
let gameLoopActive = false;
let cameraSetupInProgress = false;

const handWarningDelay = 3000;

const smoothingFactor = 0.35;

// ================= HEAD =================

let headDetected = false;
let headCenterX = 0;
let headCenterY = 0;
let headRadius = 0;

let lastHeadHitTime = 0;
const headCollisionCooldown = 700;

// ================= GAME =================

let gameRunning = false;
let gamePaused = false;
let animationFrameId = null;

let score = 0;
let currentLevel = 1;
let lastFrameTime = 0;

let highScore =
    Number(localStorage.getItem("airJugglerHighScore")) || 0;

highScoreElement.textContent = highScore;

// ================= LEVEL SYSTEM =================

const levels = [
    {
        level: 1,
        name: "EASY",
        minScore: 0,
        gravity: 0.28,
        bounce: 9,
        multiplier: 1,
        className: "difficulty-easy"
    },
    {
        level: 2,
        name: "MEDIUM",
        minScore: 6,
        gravity: 0.36,
        bounce: 11,
        multiplier: 1.3,
        className: "difficulty-medium"
    },
    {
        level: 3,
        name: "HARD",
        minScore: 16,
        gravity: 0.46,
        bounce: 13,
        multiplier: 1.65,
        className: "difficulty-hard"
    },
    {
        level: 4,
        name: "INSANE",
        minScore: 31,
        gravity: 0.58,
        bounce: 15,
        multiplier: 2.05,
        className: "difficulty-insane"
    }
];

function getLevelFromScore() {
    let selectedLevel = levels[0];

    for (const level of levels) {
        if (score >= level.minScore) {
            selectedLevel = level;
        }
    }

    return selectedLevel;
}

function updateLevel() {
    const levelData = getLevelFromScore();

    if (levelData.level !== currentLevel) {
        currentLevel = levelData.level;

        playLevelUpSound();

        showLevelUp(levelData);

        createParticles(
            gameArea.clientWidth / 2,
            gameArea.clientHeight / 2,
            "#ffd000",
            40
        );
    }

    difficultyElement.textContent = levelData.name;
    difficultyElement.className = levelData.className;

    if (score >= 5) {
        paddle.classList.add("power");
    } else {
        paddle.classList.remove("power");
    }
}

function showLevelUp(levelData) {
    if (levelUpInProgress) return;

    levelUpInProgress = true;
    levelUpName.textContent = levelData.name;
    levelUpText.classList.remove("show");
    void levelUpText.offsetWidth;
    levelUpText.classList.add("show");

    setTimeout(() => {
        levelUpText.classList.remove("show");
        levelUpInProgress = false;
    }, 1800);
}

// ================= BALL =================

let ballX = 0;
let ballY = 0;

let ballVelocityX = 0;
let ballVelocityY = 0;

let lastHitTime = 0;
const collisionCooldown = 140;

let lastTrailTime = 0;
let lastNearMissTime = 0;
const nearMissCooldown = 500;

// ================= VIDEO MAPPING =================

function getVideoMapping() {
    const videoWidth = webcam.videoWidth;
    const videoHeight = webcam.videoHeight;

    const displayWidth = gameArea.clientWidth;
    const displayHeight = gameArea.clientHeight;

    if (!videoWidth || !videoHeight) {
        return {
            scale: 1,
            offsetX: 0,
            offsetY: 0,
            displayWidth,
            displayHeight
        };
    }

    const scale = Math.max(
        displayWidth / videoWidth,
        displayHeight / videoHeight
    );

    const renderedWidth = videoWidth * scale;
    const renderedHeight = videoHeight * scale;

    const offsetX =
        (displayWidth - renderedWidth) / 2;

    const offsetY =
        (displayHeight - renderedHeight) / 2;

    return {
        scale,
        offsetX,
        offsetY,
        displayWidth,
        displayHeight
    };
}

function landmarkToScreen(point) {
    const map = getVideoMapping();

    const videoX = point.x * webcam.videoWidth;
    const videoY = point.y * webcam.videoHeight;

    let screenX =
        videoX * map.scale + map.offsetX;

    const screenY =
        videoY * map.scale + map.offsetY;

    screenX = map.displayWidth - screenX;

    return {
        x: screenX,
        y: screenY
    };
}

// ================= EVENTS =================

startButton.addEventListener("click", () => {
    initAudio();
    startPreparation();
});

restartButton.addEventListener("click", () => {
    initAudio();
    startPreparation();
});

pauseButton.addEventListener("click", togglePause);
resumeButton.addEventListener("click", resumeGame);
retryButton.addEventListener("click", startPreparation);

document.addEventListener("keydown", event => {
    if (event.key.toLowerCase() === "p" || event.key === "Escape") {
        togglePause();
    }
});

window.addEventListener("resize", handleResize);

// ================= START =================

async function startPreparation() {
    clearCountdown();
    gameRunning = false;
    gamePaused = false;
    cameraError.textContent = "";
    retryButton.classList.remove("show");

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }

    startScreen.style.display = "none";
    gameOverScreen.style.display = "none";
    pauseScreen.style.display = "none";
    readyScreen.style.display = "flex";

    pauseButton.style.display = "none";

    readyTitle.textContent = "SET YOUR HAND";
    readyText.textContent =
        "Show your hand clearly to the camera";

    countdownElement.textContent = "";
    countdownStarted = false;

    resetGame();

    if (!cameraStarted && !cameraSetupInProgress) {
        cameraSetupInProgress = true;
        try {
            await setupCamera();
            await setupAITracking();

            cameraStarted = true;

            if (!detectionLoopStarted) {
                detectionLoopStarted = true;
                detectTracking();
            }

        } catch (error) {
            console.error(error);

            cameraStarted = false;
            stopCameraStream();
            const message = error.name === "NotAllowedError"
                ? "Camera permission was denied. Please allow camera access and try again."
                : error.name === "NotFoundError"
                    ? "No webcam was found. Connect a camera and try again."
                    : error.message?.includes("AI_TRACKING")
                        ? "AI tracking failed to load. Please check your internet connection."
                        : "Camera access is required to play Air Juggler.";

            cameraError.textContent = message;
            retryButton.classList.add("show");

            startScreen.style.display = "flex";
            readyScreen.style.display = "none";
        } finally {
            cameraSetupInProgress = false;
        }
    }
}

// ================= CAMERA =================

async function setupCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
        const error = new Error("Camera unavailable");
        error.name = "NotFoundError";
        throw error;
    }

    const stream =
        await navigator.mediaDevices.getUserMedia({
            video: {
                width: 1280,
                height: 720,
                facingMode: "user"
            },
            audio: false
        });

    webcam.srcObject = stream;

    await new Promise(resolve => {
        webcam.onloadedmetadata = resolve;
    });

    await webcam.play();

    webcam.style.display = "block";
    canvas.style.display = "block";

    handleResize();
}

function stopCameraStream() {
    const stream = webcam.srcObject;

    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        webcam.srcObject = null;
    }

    webcam.style.display = "none";
    canvas.style.display = "none";
}

// ================= AI MODELS =================

async function setupAITracking() {
    const vision =
        await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

    try {
        handLandmarker =
            await HandLandmarker.createFromOptions(
            vision,
            {
                baseOptions: {
                    modelAssetPath:
                        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                    delegate: "GPU"
                },

                runningMode: "VIDEO",
                numHands: 1,

                minHandDetectionConfidence: 0.65,
                minHandPresenceConfidence: 0.65,
                minTrackingConfidence: 0.7
            }
            );

        faceLandmarker =
            await FaceLandmarker.createFromOptions(
            vision,
            {
                baseOptions: {
                    modelAssetPath:
                        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                    delegate: "GPU"
                },

                runningMode: "VIDEO",
                numFaces: 1
            }
            );
    } catch (error) {
        error.message = `AI_TRACKING: ${error.message}`;
        throw error;
    }
}

// ================= DETECTION LOOP =================

function detectTracking() {
    if (detectionLoopStarted && animationFrameId === null) {
        lastVideoTime = -1;
    }

    function predict() {
        if (
            webcam.readyState >= 2 &&
            lastVideoTime !== webcam.currentTime
        ) {
            lastVideoTime = webcam.currentTime;

            ctx.clearRect(
                0,
                0,
                canvas.width,
                canvas.height
            );

            if (handLandmarker) {
                const handResults =
                    handLandmarker.detectForVideo(
                        webcam,
                        performance.now()
                    );

                if (handResults.landmarks?.length > 0) {
                    const landmarks =
                        handResults.landmarks[0];

                    drawHandSkeleton(landmarks);
                    handLastSeenTime = performance.now();
                    setTrackingStatus("");

                    if (!gamePaused) {
                        controlPaddle(landmarks);
                    }

                    if (
                        !countdownStarted &&
                        !gameRunning &&
                        !gamePaused &&
                        readyScreen.style.display === "flex"
                    ) {
                        countdownStarted = true;
                        startCountdown();
                    }
                } else if (gameRunning && !gamePaused) {
                    const handMissingFor = performance.now() - handLastSeenTime;
                    setTrackingStatus(
                        handMissingFor > handWarningDelay
                            ? "HAND LOST - SHOW YOUR HAND"
                            : "HAND LOST"
                    );
                }
            }

            if (faceLandmarker) {
                const faceResults =
                    faceLandmarker.detectForVideo(
                        webcam,
                        performance.now()
                    );

                if (
                    faceResults.faceLandmarks?.length > 0
                ) {
                    headDetected = true;

                    const face =
                        faceResults.faceLandmarks[0];

                    updateHeadData(face);
                    drawHeadOutline(face);

                } else {
                    headDetected = false;
                }
            }
        }

        requestAnimationFrame(predict);
    }

    predict();
}

// ================= HAND DRAW =================

function drawHandSkeleton(landmarks) {
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],
        [0, 5], [5, 6], [6, 7], [7, 8],
        [0, 9], [9, 10], [10, 11], [11, 12],
        [0, 13], [13, 14], [14, 15], [15, 16],
        [0, 17], [17, 18], [18, 19], [19, 20],
        [5, 9], [9, 13], [13, 17]
    ];

    ctx.strokeStyle = "#00e5ff";
    ctx.lineWidth = 3;

    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 10;

    connections.forEach(([a, b]) => {
        const p1 =
            landmarkToScreen(landmarks[a]);

        const p2 =
            landmarkToScreen(landmarks[b]);

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
    });

    ctx.shadowBlur = 0;
}

// ================= HEAD =================

function updateHeadData(face) {
    const left =
        landmarkToScreen(face[234]);

    const right =
        landmarkToScreen(face[454]);

    const top =
        landmarkToScreen(face[10]);

    const bottom =
        landmarkToScreen(face[152]);

    headCenterX =
        (left.x + right.x) / 2;

    headCenterY =
        (top.y + bottom.y) / 2;

    const faceWidth =
        Math.abs(right.x - left.x);

    const faceHeight =
        Math.abs(bottom.y - top.y);

    headRadius =
        Math.max(faceWidth, faceHeight) * 0.48;
}

function drawHeadOutline(face) {
    const oval = [
        10, 338, 297, 332, 284,
        251, 389, 356, 454, 323,
        361, 288, 397, 365, 379,
        378, 400, 377, 152, 148,
        176, 149, 150, 136, 172,
        58, 132, 93, 234, 127,
        162, 21, 54, 103, 67,
        109, 10
    ];

    ctx.strokeStyle = "#a855f7";
    ctx.lineWidth = 3;

    ctx.shadowColor = "#a855f7";
    ctx.shadowBlur = 12;

    ctx.beginPath();

    oval.forEach((index, i) => {
        const point =
            landmarkToScreen(face[index]);

        if (i === 0) {
            ctx.moveTo(point.x, point.y);
        } else {
            ctx.lineTo(point.x, point.y);
        }
    });

    ctx.closePath();
    ctx.stroke();

    ctx.shadowBlur = 0;
}

// ================= PADDLE CONTROL =================

function controlPaddle(landmarks) {
    const wrist =
        landmarkToScreen(landmarks[0]);

    const middleBase =
        landmarkToScreen(landmarks[9]);

    const targetX =
        (wrist.x + middleBase.x) / 2;

    if (smoothX === null) {
        smoothX = targetX;
    } else {
        smoothX +=
            (targetX - smoothX) *
            smoothingFactor;
    }

    const paddleWidth =
        paddle.offsetWidth;

    const gameWidth =
        gameArea.clientWidth;

    const minX =
        paddleWidth / 2;

    const maxX =
        gameWidth - paddleWidth / 2;

    const paddleX =
        Math.max(
            minX,
            Math.min(maxX, smoothX)
        );

    paddle.style.left = `${paddleX}px`;
}

// ================= COUNTDOWN =================

function startCountdown() {
    clearCountdown();

    readyTitle.textContent =
        "HAND DETECTED ✓";

    readyText.textContent =
        "Get ready...";

    let count = 3;

    countdownElement.textContent = count;

    countdownTimer = setInterval(() => {
        count--;

        if (count > 0) {
            countdownElement.textContent = count;
        } else {
            clearCountdown();

            countdownElement.textContent = "GO!";

            countdownFinishTimer = setTimeout(() => {
                readyScreen.style.display = "none";
                startActualGame();
            }, 650);
        }
    }, 1000);
}

function clearCountdown() {
    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }

    if (countdownFinishTimer) {
        clearTimeout(countdownFinishTimer);
        countdownFinishTimer = null;
    }

    countdownStarted = false;
}

function setTrackingStatus(message) {
    if (trackingStatus.textContent === message) return;

    trackingStatus.textContent = message;
    trackingStatus.classList.toggle("show", Boolean(message));
}

// ================= GAME START =================

function startActualGame() {
    if (gameLoopActive) return;

    resetGame();

    gameRunning = true;
    gamePaused = false;

    lastFrameTime = performance.now();

    pauseButton.style.display = "block";

    gameLoopActive = true;
    updateGame(lastFrameTime);
}

// ================= PAUSE =================

function togglePause() {
    if (!gameRunning) return;

    if (gamePaused) {
        resumeGame();
    } else {
        pauseGame();
    }
}

function pauseGame() {
    if (!gameRunning) return;

    gamePaused = true;

    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;

    pauseScreen.style.display = "flex";
    pauseButton.innerHTML = "▶";
}

function resumeGame() {
    if (!gamePaused) return;

    gamePaused = false;

    pauseScreen.style.display = "none";
    pauseButton.innerHTML = "⏸";

    lastFrameTime = performance.now();

    gameLoopActive = false;
    updateGame(lastFrameTime);
}

// ================= RESET =================

function resetGame() {
    clearCountdown();
    score = 0;
    currentLevel = 1;

    scoreElement.textContent = score;

    difficultyElement.textContent = "EASY";
    difficultyElement.className =
        "difficulty-easy";

    smoothX = null;

    lastHitTime = 0;
    lastHeadHitTime = 0;
    lastTrailTime = 0;
    lastNearMissTime = 0;
    handLastSeenTime = performance.now();
    setTrackingStatus("");
    levelUpText.classList.remove("show");
    levelUpInProgress = false;

    paddle.classList.remove("power");

    ballX =
        gameArea.clientWidth / 2 -
        ball.offsetWidth / 2;

    ballY = 70;

    ballVelocityX =
        Math.random() > 0.5 ? 3.5 : -3.5;

    ballVelocityY = 1;

    ball.style.left = `${ballX}px`;
    ball.style.top = `${ballY}px`;

    if (ballTrail) {
        ballTrail.innerHTML = "";
    }

    particlesContainer.innerHTML = "";
}

// ================= SCORE =================

function addScore(points) {
    score += points;

    scoreElement.textContent = score;

    updateLevel();
    updateHighScore();
}

// ================= PARTICLES =================

function createParticles(
    x,
    y,
    color = "#00e5ff",
    amount = 18
) {
    const maxParticles = 80;

    while (particlesContainer.children.length + amount > maxParticles) {
        particlesContainer.firstElementChild?.remove();
    }

    for (let i = 0; i < amount; i++) {
        const particle =
            document.createElement("div");

        particle.classList.add("particle");

        const angle =
            Math.random() * Math.PI * 2;

        const distance =
            35 + Math.random() * 75;

        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;

        particle.style.background = color;

        particle.style.boxShadow =
            `0 0 10px ${color}`;

        particle.style.setProperty(
            "--x",
            `${Math.cos(angle) * distance}px`
        );

        particle.style.setProperty(
            "--y",
            `${Math.sin(angle) * distance}px`
        );

        particlesContainer.appendChild(particle);

        setTimeout(() => {
            particle.remove();
        }, 700);
    }
}

// ================= COMBO =================

function showCombo(x, y, text = null) {
    if (!text && score < 2) return;

    const comboMessage = score >= 20
        ? "LEGENDARY!"
        : score >= 10
            ? "UNSTOPPABLE!"
            : score >= 5
                ? "ON FIRE!"
                : score >= 2
                    ? "DOUBLE!"
                    : `+${score}`;

    comboText.textContent =
        text || comboMessage;

    comboText.style.left = `${x}px`;
    comboText.style.top = `${y}px`;

    comboText.classList.remove("combo-show");

    void comboText.offsetWidth;

    comboText.classList.add("combo-show");
}

// ================= EFFECTS =================

function triggerHitFlash() {
    if (!hitFlash) return;

    hitFlash.classList.remove("active");

    void hitFlash.offsetWidth;

    hitFlash.classList.add("active");
}

function triggerScreenShake() {
    gameArea.classList.remove("shake");

    void gameArea.offsetWidth;

    gameArea.classList.add("shake");
}

function createTrail() {
    if (!ballTrail) return;

    const now = performance.now();

    const speed =
        Math.sqrt(
            ballVelocityX * ballVelocityX +
            ballVelocityY * ballVelocityY
        );

    const interval =
        Math.max(18, 65 - speed * 2.5);

    if (now - lastTrailTime < interval) return;

    lastTrailTime = now;

    const dot =
        document.createElement("div");

    dot.classList.add("trail-dot");

    const ballCenterX =
        ballX + ball.offsetWidth / 2;

    const ballCenterY =
        ballY + ball.offsetHeight / 2;

    const size =
        Math.min(30, 10 + speed * 1.3);

    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;
    dot.style.left = `${ballCenterX}px`;
    dot.style.top = `${ballCenterY}px`;

    ballTrail.appendChild(dot);

    while (ballTrail.children.length > 35) {
        ballTrail.firstElementChild?.remove();
    }

    setTimeout(() => {
        dot.remove();
    }, 450);
}

// ================= HEAD COLLISION =================

function checkHeadCollision(
    ballWidth,
    ballHeight
) {
    if (
        !headDetected ||
        !gameRunning
    ) {
        return false;
    }

    const ballCenterX =
        ballX + ballWidth / 2;

    const ballCenterY =
        ballY + ballHeight / 2;

    const ballRadius =
        ballWidth / 2;

    const dx =
        ballCenterX - headCenterX;

    const dy =
        ballCenterY - headCenterY;

    const distance =
        Math.sqrt(
            dx * dx +
            dy * dy
        );

    const now = performance.now();

    if (
        distance <
        headRadius + ballRadius &&
        ballVelocityY > 0 &&
        now - lastHeadHitTime >
        headCollisionCooldown
    ) {
        lastHeadHitTime = now;

        ballY =
            headCenterY -
            headRadius -
            ballHeight -
            8;

        const levelData =
            getLevelFromScore();

        ballVelocityY =
            -11 * levelData.multiplier;

        ballVelocityX += dx * 0.04;

        const maxSpeed =
            11 * levelData.multiplier;

        ballVelocityX =
            Math.max(
                -maxSpeed,
                Math.min(
                    maxSpeed,
                    ballVelocityX
                )
            );

        addScore(2);

        playHeadSound();

        triggerHitFlash();
        triggerScreenShake();

        createParticles(
            headCenterX,
            headCenterY,
            "#a855f7",
            28
        );

        showCombo(
            headCenterX - 85,
            headCenterY -
            headRadius - 35,
            "🧠 HEAD SAVE! +2"
        );

        return true;
    }

    return false;
}

// ================= HIGH SCORE =================

function updateHighScore() {
    if (score > highScore) {
        highScore = score;

        highScoreElement.textContent =
            highScore;

        localStorage.setItem(
            "airJugglerHighScore",
            highScore
        );
    }
}

// ================= GAME LOOP =================

function updateGame(timestamp) {
    if (!gameRunning || gamePaused) return;

    gameLoopActive = true;

    let delta =
        (timestamp - lastFrameTime) / 16.666;

    lastFrameTime = timestamp;

    delta = Math.min(Math.max(delta, 0), 2);

    const gameWidth =
        gameArea.clientWidth;

    const gameHeight =
        gameArea.clientHeight;

    const ballWidth =
        ball.offsetWidth;

    const ballHeight =
        ball.offsetHeight;

    const levelData =
        getLevelFromScore();

    // Physics changes noticeably at every level
    ballVelocityY +=
        levelData.gravity * delta;

    const maxVelocity = 15 * levelData.multiplier;
    ballVelocityY = Math.max(
        -maxVelocity,
        Math.min(maxVelocity, ballVelocityY)
    );

    ballX +=
        ballVelocityX * delta;

    ballY +=
        ballVelocityY * delta;

    // WALL COLLISION
    if (ballX <= 0) {
        ballX = 0;
        ballVelocityX =
            Math.abs(ballVelocityX);

    } else if (
        ballX + ballWidth >= gameWidth
    ) {
        ballX =
            gameWidth - ballWidth;

        ballVelocityX =
            -Math.abs(ballVelocityX);
    }

    // CEILING
    if (ballY <= 0) {
        ballY = 0;

        ballVelocityY =
            Math.abs(ballVelocityY);
    }

    // HEAD COLLISION
    checkHeadCollision(
        ballWidth,
        ballHeight
    );

    // PADDLE COLLISION
    const paddleRect =
        paddle.getBoundingClientRect();

    const gameRect =
        gameArea.getBoundingClientRect();

    const paddleLeft =
        paddleRect.left -
        gameRect.left;

    const paddleTop =
        paddleRect.top -
        gameRect.top;

    const paddleRight =
        paddleLeft +
        paddleRect.width;

    const ballBottom =
        ballY + ballHeight;

    const ballCenterX =
        ballX + ballWidth / 2;

    const previousBallBottom =
        ballBottom -
        ballVelocityY * delta;

    const isFalling =
        ballVelocityY > 0;

    const withinPaddle =
        ballCenterX >= paddleLeft &&
        ballCenterX <= paddleRight;

    const crossedPaddle =
        previousBallBottom <= paddleTop &&
        ballBottom >= paddleTop;

    const now =
        performance.now();

    if (
        isFalling &&
        withinPaddle &&
        crossedPaddle &&
        now - lastHitTime >
        collisionCooldown
    ) {
        lastHitTime = now;

        ballY =
            paddleTop - ballHeight;

        addScore(1);

        const newLevelData =
            getLevelFromScore();

        playHitSound();
        triggerHitFlash();

        if (score >= 8) {
            triggerScreenShake();
        }

        createParticles(
            ballCenterX,
            paddleTop,
            "#00e5ff",
            18
        );

        showCombo(
            ballCenterX - 20,
            paddleTop - 35
        );

        // Stronger and faster ball at higher levels
        const bounceStrength =
            newLevelData.bounce +
            Math.min(score * 0.18, 4);

        ballVelocityY =
            -bounceStrength;

        const paddleCenter =
            paddleLeft +
            paddleRect.width / 2;

        const hitOffset =
            (ballCenterX - paddleCenter) /
            (paddleRect.width / 2);

        const horizontalPower =
            7.5 *
            newLevelData.multiplier;

        ballVelocityX =
            hitOffset *
            horizontalPower;

        const minimumHorizontalSpeed =
            2.2 *
            newLevelData.multiplier;

        if (
            Math.abs(ballVelocityX) <
            minimumHorizontalSpeed
        ) {
            ballVelocityX =
                ballVelocityX < 0
                    ? -minimumHorizontalSpeed
                    : minimumHorizontalSpeed;
        }
    } else if (
        isFalling &&
        crossedPaddle &&
        Math.abs(ballCenterX - (paddleLeft + paddleRect.width / 2)) <
        paddleRect.width * 0.85 &&
        now - lastNearMissTime > nearMissCooldown
    ) {
        lastNearMissTime = now;
        showCombo(ballCenterX - 25, paddleTop - 25, "CLOSE!");
    }

    // GAME OVER
    if (ballY > gameHeight) {
        endGame();
        return;
    }

    // DRAW BALL
    ball.style.left = `${ballX}px`;
    ball.style.top = `${ballY}px`;

    createTrail();

    animationFrameId =
        requestAnimationFrame(updateGame);
}

// ================= RESIZE =================

function handleResize() {
    if (!cameraStarted) return;

    canvas.width =
        gameArea.clientWidth;

    canvas.height =
        gameArea.clientHeight;
}

// ================= GAME OVER =================

function endGame() {
    gameRunning = false;
    gamePaused = false;

    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
    gameLoopActive = false;

    pauseButton.style.display = "none";

    playGameOverSound();

    finalScoreElement.textContent =
        score;

    finalBestElement.textContent = highScore;
    finalLevelElement.textContent = getLevelFromScore().name;
    performanceMessage.textContent = score >= 31
        ? "LEGENDARY PERFORMANCE!"
        : score >= 16
            ? "You're becoming a pro!"
            : score >= 6
                ? "Great reflexes!"
                : "Nice start! Keep practicing.";

    gameOverScreen.style.display =
        "flex";
}