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
const gameArea = document.querySelector(".game-area");

const particlesContainer = document.getElementById("particles-container");
const comboText = document.getElementById("combo-text");

const scoreElement = document.getElementById("score");
const highScoreElement = document.getElementById("high-score");
const finalScoreElement = document.getElementById("final-score");
const difficultyElement = document.getElementById("difficulty");

// ================= SOUND =================

let audioContext = null;

function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
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
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

    gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
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
    setTimeout(() => playTone(520, 0.06, "sine", 0.1), 40);
}

function playHeadSound() {
    playTone(700, 0.08, "square", 0.14);
    setTimeout(() => playTone(950, 0.15, "sine", 0.16), 70);
}

function playGameOverSound() {
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
        80,
        audioContext.currentTime + 0.5
    );

    gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.5
    );

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.5);
}

// ================= AI =================

let handLandmarker;
let faceLandmarker;

let cameraStarted = false;
let detectionLoopStarted = false;
let lastVideoTime = -1;

let countdownStarted = false;
let smoothX = null;

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

let highScore =
    Number(localStorage.getItem("airJugglerHighScore")) || 0;

highScoreElement.textContent = highScore;

// ================= BALL =================

const gravity = 0.25;
const baseBounceStrength = 9;
const maxBounceStrength = 15;

const baseHorizontalSpeed = 3;
const maxHorizontalSpeed = 10;

let ballX = 0;
let ballY = 0;
let ballVelocityX = 0;
let ballVelocityY = 0;

let lastHitTime = 0;
const collisionCooldown = 120;

// ================= VIDEO MAPPING =================

function getVideoMapping() {

    const videoWidth = webcam.videoWidth;
    const videoHeight = webcam.videoHeight;

    const displayWidth = gameArea.clientWidth;
    const displayHeight = gameArea.clientHeight;

    // Same calculation as CSS object-fit: cover
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

// Convert normalized MediaPipe landmark
// into displayed GAME AREA coordinates

function landmarkToScreen(point) {

    const map = getVideoMapping();

    const videoX =
        point.x * webcam.videoWidth;

    const videoY =
        point.y * webcam.videoHeight;

    let screenX =
        videoX * map.scale +
        map.offsetX;

    let screenY =
        videoY * map.scale +
        map.offsetY;

    // Mirror because webcam is mirrored
    screenX =
        map.displayWidth - screenX;

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

document.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "p") {
        togglePause();
    }
});

window.addEventListener("resize", handleResize);

// ================= START =================

async function startPreparation() {

    gameRunning = false;
    gamePaused = false;

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }

    startScreen.style.display = "none";
    gameOverScreen.style.display = "none";
    pauseScreen.style.display = "none";
    readyScreen.style.display = "flex";

    pauseButton.style.display = "none";

    readyTitle.textContent = "SET YOUR HAND";
    readyText.textContent = "Show your hand clearly to the camera";
    countdownElement.textContent = "";

    countdownStarted = false;

    resetGame();

    if (!cameraStarted) {
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

            alert("Camera or AI tracking failed.");
            startScreen.style.display = "flex";
            readyScreen.style.display = "none";
        }
    }
}

// ================= CAMERA =================

async function setupCamera() {

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

    // Canvas uses GAME AREA coordinate system
    canvas.width = gameArea.clientWidth;
    canvas.height = gameArea.clientHeight;
}

// ================= AI MODELS =================

async function setupAITracking() {

    const vision =
        await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

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

                minHandDetectionConfidence: 0.6,
                minHandPresenceConfidence: 0.6,
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
}

// ================= DETECTION =================

function detectTracking() {

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

            // HAND

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
                }
            }

            // FACE

            if (faceLandmarker) {

                const faceResults =
                    faceLandmarker.detectForVideo(
                        webcam,
                        performance.now()
                    );

                if (faceResults.faceLandmarks?.length > 0) {

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
        [0,1],[1,2],[2,3],[3,4],
        [0,5],[5,6],[6,7],[7,8],
        [0,9],[9,10],[10,11],[11,12],
        [0,13],[13,14],[14,15],[15,16],
        [0,17],[17,18],[18,19],[19,20],
        [5,9],[9,13],[13,17]
    ];

    ctx.strokeStyle = "#00e5ff";
    ctx.lineWidth = 4;
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 12;

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

// ================= HEAD DATA =================

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
        Math.max(faceWidth, faceHeight) * 0.5;
}

// ================= HEAD DRAW =================

function drawHeadOutline(face) {

    const oval = [
        10,338,297,332,284,251,
        389,356,454,323,361,
        288,397,365,379,378,
        400,377,152,148,176,
        149,150,136,172,58,
        132,93,234,127,162,
        21,54,103,67,109,10
    ];

    ctx.strokeStyle = "#a855f7";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#a855f7";
    ctx.shadowBlur = 15;

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

    ctx.stroke();
    ctx.shadowBlur = 0;
}

// ================= PADDLE =================

function controlPaddle(landmarks) {

    const wrist =
        landmarkToScreen(landmarks[0]);

    if (smoothX === null) {
        smoothX = wrist.x;
    } else {
        smoothX +=
            (wrist.x - smoothX) *
            smoothingFactor;
    }

    const paddleWidth =
        paddle.offsetWidth;

    const gameWidth =
        gameArea.clientWidth;

    let paddleX = smoothX;

    paddleX = Math.max(
        paddleWidth / 2,
        Math.min(
            gameWidth - paddleWidth / 2,
            paddleX
        )
    );

    paddle.style.left = `${paddleX}px`;
}

// ================= COUNTDOWN =================

function startCountdown() {

    readyTitle.textContent =
        "HAND DETECTED ✓";

    readyText.textContent =
        "Get ready...";

    let count = 3;

    countdownElement.textContent = count;

    const interval = setInterval(() => {

        count--;

        if (count > 0) {

            countdownElement.textContent =
                count;

        } else {

            clearInterval(interval);

            countdownElement.textContent =
                "GO!";

            setTimeout(() => {

                readyScreen.style.display =
                    "none";

                startActualGame();

            }, 700);
        }

    }, 1000);
}

// ================= GAME START =================

function startActualGame() {

    resetGame();

    gameRunning = true;
    gamePaused = false;

    pauseButton.style.display = "block";

    updateGame();
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

    pauseScreen.style.display = "flex";
    pauseButton.innerHTML = "▶";
}

function resumeGame() {

    if (!gamePaused) return;

    gamePaused = false;

    pauseScreen.style.display = "none";
    pauseButton.innerHTML = "⏸";

    updateGame();
}

// ================= RESET =================

function resetGame() {

    score = 0;
    scoreElement.textContent = score;

    difficultyElement.textContent = "EASY";
    difficultyElement.className =
        "difficulty-easy";

    smoothX = null;
    lastHitTime = 0;
    lastHeadHitTime = 0;

    ballX =
        gameArea.clientWidth / 2 -
        ball.offsetWidth / 2;

    ballY = 60;

    ballVelocityX =
        Math.random() > 0.5
            ? baseHorizontalSpeed
            : -baseHorizontalSpeed;

    ballVelocityY = 1;

    ball.style.left = `${ballX}px`;
    ball.style.top = `${ballY}px`;
}

// ================= DIFFICULTY =================

function updateDifficulty() {

    if (score <= 5) {
        difficultyElement.textContent = "EASY";
        difficultyElement.className = "difficulty-easy";

    } else if (score <= 15) {
        difficultyElement.textContent = "MEDIUM";
        difficultyElement.className = "difficulty-medium";

    } else if (score <= 30) {
        difficultyElement.textContent = "HARD";
        difficultyElement.className = "difficulty-hard";

    } else {
        difficultyElement.textContent = "INSANE";
        difficultyElement.className = "difficulty-insane";
    }
}

// ================= PARTICLES =================

function createParticles(x, y, color = "#00e5ff") {

    for (let i = 0; i < 18; i++) {

        const particle =
            document.createElement("div");

        particle.classList.add("particle");

        const angle =
            Math.random() * Math.PI * 2;

        const distance =
            40 + Math.random() * 70;

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

        setTimeout(
            () => particle.remove(),
            700
        );
    }
}

// ================= COMBO =================

function showCombo(x, y, text = null) {

    if (!text && score < 2) return;

    comboText.textContent =
        text ||
        (score >= 10
            ? `🔥 ${score} COMBO!`
            : `+${score}`);

    comboText.style.left = `${x}px`;
    comboText.style.top = `${y}px`;

    comboText.classList.remove("combo-show");

    void comboText.offsetWidth;

    comboText.classList.add("combo-show");
}

// ================= HEAD COLLISION =================

function checkHeadCollision(ballWidth, ballHeight) {

    if (!headDetected || !gameRunning) {
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
        Math.sqrt(dx * dx + dy * dy);

    const now =
        performance.now();

    if (
        distance < headRadius + ballRadius &&
        ballVelocityY > 0 &&
        now - lastHeadHitTime >
            headCollisionCooldown
    ) {

        lastHeadHitTime = now;

        ballY =
            headCenterY -
            headRadius -
            ballHeight -
            5;

        ballVelocityY = -11;

        ballVelocityX += dx * 0.025;

        ballVelocityX = Math.max(
            -maxHorizontalSpeed,
            Math.min(
                maxHorizontalSpeed,
                ballVelocityX
            )
        );

        score += 2;

        scoreElement.textContent = score;

        updateDifficulty();
        playHeadSound();

        createParticles(
            headCenterX,
            headCenterY,
            "#a855f7"
        );

        showCombo(
            headCenterX - 80,
            headCenterY - headRadius - 40,
            "🧠 HEAD SAVE! +2"
        );

        updateHighScore();

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

function updateGame() {

    if (!gameRunning || gamePaused) return;

    const gameWidth =
        gameArea.clientWidth;

    const gameHeight =
        gameArea.clientHeight;

    const ballWidth =
        ball.offsetWidth;

    const ballHeight =
        ball.offsetHeight;

    ballVelocityY += gravity;

    ballX += ballVelocityX;
    ballY += ballVelocityY;

    // WALLS

    if (ballX <= 0) {
        ballX = 0;
        ballVelocityX = Math.abs(ballVelocityX);
    }

    if (ballX + ballWidth >= gameWidth) {
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

    // HEAD

    checkHeadCollision(
        ballWidth,
        ballHeight
    );

    // PADDLE

    const paddleRect =
        paddle.getBoundingClientRect();

    const gameRect =
        gameArea.getBoundingClientRect();

    const paddleLeft =
        paddleRect.left - gameRect.left;

    const paddleTop =
        paddleRect.top - gameRect.top;

    const paddleRight =
        paddleLeft + paddleRect.width;

    const ballBottom =
        ballY + ballHeight;

    const ballCenterX =
        ballX + ballWidth / 2;

    const previousBallBottom =
        ballBottom - ballVelocityY;

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

        score++;

        scoreElement.textContent = score;

        updateDifficulty();
        playHitSound();

        createParticles(
            ballCenterX,
            paddleTop
        );

        showCombo(
            ballCenterX,
            paddleTop - 30
        );

        const bounceStrength =
            Math.min(
                baseBounceStrength +
                score * 0.3,
                maxBounceStrength
            );

        ballVelocityY =
            -bounceStrength;

        const paddleCenter =
            paddleLeft +
            paddleRect.width / 2;

        const hitOffset =
            (ballCenterX - paddleCenter) /
            (paddleRect.width / 2);

        ballVelocityX =
            hitOffset *
            maxHorizontalSpeed;

        if (
            Math.abs(ballVelocityX) < 1.8
        ) {
            ballVelocityX =
                ballVelocityX < 0
                    ? -1.8
                    : 1.8;
        }

        updateHighScore();
    }

    // GAME OVER

    if (ballY > gameHeight) {

        endGame();
        return;
    }

    ball.style.left = `${ballX}px`;
    ball.style.top = `${ballY}px`;

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

    pauseButton.style.display = "none";

    playGameOverSound();

    finalScoreElement.textContent =
        score;

    gameOverScreen.style.display =
        "flex";
}