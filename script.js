const startButton = document.getElementById("start-btn");
const startScreen = document.getElementById("start-screen");
const webcam = document.getElementById("webcam");

startButton.addEventListener("click", startWebcam);

async function startWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
        });

        webcam.srcObject = stream;

        webcam.style.display = "block";
        startScreen.style.display = "none";

    } catch (error) {
        console.error("Webcam error:", error);
        alert("Unable to access webcam. Please allow camera permission.");
    }
}