const startButton = document.getElementById("start-btn");
const startScreen = document.getElementById("start-screen");
const webcam = document.getElementById("webcam");
const canvas = document.getElementById("output-canvas");
const ctx = canvas.getContext("2d");

let detector = null;

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

        detectHands();

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
        const hands = await detector.estimateHands(webcam);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        hands.forEach(hand => {
            hand.keypoints.forEach(point => {
                ctx.beginPath();
                ctx.arc(point.x, point.y, 7, 0, 2 * Math.PI);
                ctx.fillStyle = "#00e5ff";
                ctx.fill();
            });
        });

        requestAnimationFrame(render);
    }

    render();
}