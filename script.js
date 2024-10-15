// Get elements
const videoElement = document.getElementById('camera-preview');
const canvasElement = document.getElementById('canvas');
const resultElement = document.getElementById('scan-result');
const scanQRButton = document.getElementById('scan-qr');
const scanBarcodeButton = document.getElementById('scan-barcode');
let activeScanner = null;  // To track which scanner is active (QR or Barcode)
let cameraStream = null;   // Keep track of the camera stream

// Initialize canvas for QR code detection
const canvasContext = canvasElement.getContext('2d');

// Function to start the camera once and reuse it for both scanning types
async function startCamera() {
    if (!cameraStream) {
        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            videoElement.srcObject = cameraStream;
            await videoElement.play();
        } catch (err) {
            resultElement.innerText = 'Error accessing camera: ' + err;
        }
    }
    videoElement.style.display = 'block';
}

// Function to stop the camera stream
function stopCamera() {
    if (cameraStream) {
        let tracks = cameraStream.getTracks();
        tracks.forEach((track) => track.stop());
        cameraStream = null;
    }
    videoElement.style.display = 'none';
}

// Switch to QR code scanning
scanQRButton.addEventListener('click', async () => {
    if (activeScanner !== 'QR') {
        stopBarcodeScanner(); // Stop any active barcode scanning
        await startCamera();
        activeScanner = 'QR';
        resultElement.innerText = 'Scanning for QR Code...';
        scanBarcodeButton.disabled = true;
        scanQRButton.innerText = 'Scan Again';  // Change button to "Scan Again"

        // Read QR code from the video feed
        const scanQRCode = () => {
            if (activeScanner !== 'QR') return;
            canvasContext.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
            const imageData = canvasContext.getImageData(0, 0, canvasElement.width, canvasElement.height);
            const code = jsQR(imageData.data, canvasElement.width, canvasElement.height);

            if (code) {
                const qrData = code.data;
                resultElement.innerText = `QR Code Result: ${qrData}`;

                // Check if the scanned data is a URL
                if (isValidURL(qrData)) {
                    window.open(qrData, '_blank');  // Open the URL in a new tab
                }

                stopCamera();
                activeScanner = null; // Stop scanning
            } else {
                requestAnimationFrame(scanQRCode);
            }
        };

        requestAnimationFrame(scanQRCode);
    }
});

// Function to validate if the scanned data is a URL
function isValidURL(str) {
    const pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
      '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}|'+ // domain name
      '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
      '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
      '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
      '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
    return !!pattern.test(str);
}

// Switch to Barcode scanning
scanBarcodeButton.addEventListener('click', async () => {
    if (activeScanner !== 'BARCODE') {
        stopQRScanner(); // Stop any active QR scanning
        await startCamera();
        activeScanner = 'BARCODE';
        resultElement.innerText = 'Scanning for Barcode...';
        scanQRButton.disabled = true;

        // Initialize QuaggaJS for barcode scanning
        Quagga.init({
            inputStream: {
                name: 'Live',
                type: 'LiveStream',
                target: videoElement,
                constraints: {
                    facingMode: 'environment',
                },
            },
            decoder: {
                readers: ['code_128_reader', 'ean_reader', 'ean_8_reader', 'code_39_reader', 'upc_reader'],
            },
        }, (err) => {
            if (err) {
                console.error(err); // Log any errors for debugging
                return;
            }
            Quagga.start();
        });

        Quagga.onDetected((data) => {
            if (activeScanner === 'BARCODE') {
                resultElement.innerText = `Barcode Result: ${data.codeResult.code}`;
                activeScanner = null; // Stop scanning
                Quagga.stop();
                stopCamera(); // Stop the camera after detecting the barcode
                scanQRButton.disabled = false; // Enable QR button again
            }
        });
    }
});

// Stop QR scanning
function stopQRScanner() {
    if (activeScanner === 'QR') {
        activeScanner = null;
        scanBarcodeButton.disabled = false;
        // Additional cleanup for QR scanner if needed
    }
}

// Stop Barcode scanning
function stopBarcodeScanner() {
    if (activeScanner === 'BARCODE') {
        Quagga.stop();
        activeScanner = null;
        // Cleanup QuaggaJS
    }
}

// Stop the camera if the user closes or navigates away from the app
window.addEventListener('beforeunload', stopCamera);

// CSS Styles for long barcode camera holder (Add this to your CSS file)
const cameraHolderStyle = document.createElement('style');
cameraHolderStyle.innerHTML = `
    #camera-preview {
        width: 100%; /* Adjust to your needs */
        height: auto; /* Maintain aspect ratio */
        object-fit: cover;
        max-height: 80vh; /* Limit max height for the camera holder */
    }
    #canvas {
        width: 100%; /* Adjust to your needs */
        height: auto; /* Maintain aspect ratio */
        max-height: 80vh; /* Limit max height for the canvas */
    }
`;
document.head.appendChild(cameraHolderStyle);
