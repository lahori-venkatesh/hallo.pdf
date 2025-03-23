// Load OpenCV.js in the worker
self.importScripts('https://docs.opencv.org/4.5.5/opencv.js');

console.log('OpenCV.js loading started in worker');

// Wait for OpenCV.js to initialize
self.cvReady = false;
self.Module = {
  onRuntimeInitialized: () => {
    console.log('OpenCV.js fully loaded in worker:', !!self.cv);
    self.cvReady = true;
  }
};

// Handle messages from the main thread
self.onmessage = async (e) => {
  console.log('Worker received message:', e.data);
  const { imageData, enhancements, outputFormat } = e.data;

  try {
    // Wait for OpenCV.js to be ready
    if (!self.cvReady) {
      console.log('Waiting for OpenCV.js to initialize...');
      await new Promise((resolve) => {
        const checkCv = setInterval(() => {
          if (self.cvReady) {
            clearInterval(checkCv);
            resolve();
          }
        }, 100);
      });
    }

    console.log('Processing image with enhancements:', enhancements);

    let blob;
    if (self.cv && self.cvReady) {
      // ===== [1] Load Image Data with OpenCV.js =====
      const src = self.cv.matFromImageData(imageData);
      console.log('OpenCV mat created from image data');

      // ===== [2] Create Destination Matrix =====
      const dst = new self.cv.Mat();

      // ===== [3] Apply Enhancements =====
      console.log('Applying OpenCV enhancements...');
      src.convertTo(dst, -1, enhancements.contrast / 100, enhancements.brightness - 100);
      // Add more enhancements (e.g., saturation, sharpness, denoise) here if needed

      // ===== [4] Convert to Blob =====
      const canvas = new OffscreenCanvas(imageData.width, imageData.height);
      self.cv.imshow(canvas, dst);
      console.log('Converting to', outputFormat, 'format');
      blob = await canvas.convertToBlob({ type: `image/${outputFormat}` });

      // ===== [5] Cleanup Memory =====
      src.delete();
      dst.delete();
      console.log('OpenCV mats released');
    } else {
      // Fallback: If OpenCV.js isn’t available, return the original image
      console.warn('OpenCV.js not ready, using fallback processing');
      const canvas = new OffscreenCanvas(imageData.width, imageData.height);
      const ctx = canvas.getContext('2d');
      ctx.putImageData(imageData, 0, 0);
      blob = await canvas.convertToBlob({ type: `image/${outputFormat}` });
    }

    // ===== [6] Send Result =====
    const url = URL.createObjectURL(blob);
    console.log('Worker sending result:', url);
    self.postMessage({ result: url });
  } catch (error) {
    console.error('Worker processing error:', error);
    self.postMessage({ 
      error: `Image processing failed: ${error.message}`,
      stack: error.stack 
    });
  }
};