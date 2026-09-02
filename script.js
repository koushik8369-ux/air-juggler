const startButton = document.getElementById("start-btn");
const startScreen = document.getElementById("start-screen");
const webcam = document.getElementById("webcam");
const canvas = document.getElementById("output-canvas");
const ctx = canvas.getContext("2d");
const paddle = document.getElementById("paddle");
const ball = document.getElementById("ball");
const gameArea = document.querySelector(".game-area");

let detector = null;
let gameRunning = false;

// Ball physics
let ballX = 300;
let ballY = 100;
let ballVelocityX = 3;
let ballVelocityY = 2;
const gravity = 0.18;
const ballSize = 38;

startButton.addEventListener("click", startGame);

async function startGame() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: 1280,
                height: 720
            },
            audio: false
        });

        webcam.srcObject = stream;

        await new Promise(resolve => {
            webcam.onloadedmetadata = () => resolve();
        });

        webcam.style.display = "block";
        canvas.style.display = "block";
        startScreen.style.display = "none";

        await setupHandDetection();

        gameRunning = true;

        detectHands();
        updateGame();

    } catch (error) {
        console.error("Error:", error);
        alert("Unable to start the camera or hand detection.");
    }
}

async function setupHandDetection() {
    const model = handPoseDetection.SupportedModels.MediaPipeHands;

    const detectorConfig = {
        runtime: "mediapipe",
        modelType: "full",
        solutionPath: "https://cdn.jsdelivr.net/npm/@mediapipe/hands"
    };

    detector = await handPoseDetection.createDetector(
        model,
        detectorConfig
    );
}

async function detectHands() {
    canvas.width = webcam.videoWidth;
    canvas.height = webcam.videoHeight;

    async function render() {
        if (!gameRunning) return;

        const hands = await detector.estimateHands(webcam);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        hands.forEach(hand => {
            drawHandLandmarks(hand);
            movePaddle(hand);
        });

        requestAnimationFrame(render);
    }

    render();
}

function drawHandLandmarks(hand) {
    hand.keypoints.forEach(point => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 7, 0, Math.PI * 2);
        ctx.fillStyle = "#00e5ff";
        ctx.fill();
    });
}

function movePaddle(hand) {
    const indexFingerTip = hand.keypoints[8];

    const handX = indexFingerTip.x;
    const videoWidth = webcam.videoWidth;
    const gameWidth = gameArea.clientWidth;

    const mirroredX = videoWidth - handX;
    const percentage = mirroredX / videoWidth;

    const paddleHalfWidth = paddle.offsetWidth / 2;
    let paddleX = percentage * gameWidth;

    paddleX = Math.max(
        paddleHalfWidth,
        Math.min(gameWidth - paddleHalfWidth, paddleX)
    );

    paddle.style.left = `${paddleX}px`;
}

function updateGame() {
    if (!gameRunning) return;

    const gameWidth = gameArea.clientWidth;
    const gameHeight = gameArea.clientHeight;

    // Apply gravity
    ballVelocityY += gravity;

    // Update ball position
    ballX += ballVelocityX;
    ballY += ballVelocityY;

    // Left and right wall collision
    if (ballX <= 0 || ballX + ballSize >= gameWidth) {
        ballVelocityX *= -1;
        ballX = Math.max(0, Math.min(ballX, gameWidth - ballSize));
    }

    // Ceiling collision
    if (ballY <= 0) {
        ballVelocityY *= -1;
        ballY = 0;
    }

    // Paddle collision
    const paddleRect = paddle.getBoundingClientRect();
    const gameRect = gameArea.getBoundingClientRect();

    const paddleX = paddleRect.left - gameRect.left;
    const paddleY = paddleRect.top - gameRect.top;
    const paddleWidth = paddleRect.width;
    const paddleHeight = paddleRect.height;

    if (
        ballVelocityY > 0 &&
        ballX + ballSize > paddleX &&
        ballX < paddleX + paddleWidth &&
        ballY + ballSize >= paddleY &&
        ballY + ballSize <= paddleY + paddleHeight + 10
    ) {
        ballVelocityY = -Math.abs(ballVelocityY) * 0.95;

        // Change direction based on where ball hits paddle
        const hitPosition =
            (ballX + ballSize / 2 - (paddleX + paddleWidth / 2)) /
            (paddleWidth / 2);

        ballVelocityX = hitPosition * 6;
    }

    // Temporary bottom bounce for testing
    if (ballY + ballSize >= gameHeight) {
        ballVelocityY *= -0.8;
        ballY = gameHeight - ballSize;
    }

    ball.style.left = `${ballX}px`;
    ball.style.top = `${ballY}px`;

    requestAnimationFrame(updateGame);
}