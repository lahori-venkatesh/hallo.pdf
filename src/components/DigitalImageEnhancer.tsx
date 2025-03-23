import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import Webcam from 'react-webcam';
import { Upload, Download, Loader2, X, Camera, Wand2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface ImageState {
  original: string;
  preview: string;
  enhanced: string | null;
}

interface Enhancement {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
  denoise: number;
}

const defaultEnhancements: Enhancement = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  sharpness: 0,
  denoise: 0,
};

const formatOptions = [
  { value: 'jpeg', label: 'JPEG - Best for photos' },
  { value: 'png', label: 'PNG - Best for graphics' },
  { value: 'webp', label: 'WebP - Modern format, smaller size' },
];

declare global {
  interface Window {
    cv: any;
    isOpenCvReady: boolean;
  }
}

const initOpenCV = () => {
  console.log('Initializing OpenCV...');
  if (window.cv && window.isOpenCvReady) {
    console.log('OpenCV already loaded and initialized.');
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      console.error('OpenCV initialization timed out after 30 seconds.');
      console.log('window.cv:', window.cv, 'isOpenCvReady:', window.isOpenCvReady);
      reject(new Error('OpenCV initialization timeout'));
    }, 30000); // Increased to 30 seconds

    window.addEventListener('opencv-ready', function onReady() {
      console.log('OpenCV ready event received.');
      window.removeEventListener('opencv-ready', onReady);
      clearTimeout(timeoutId);
      if (window.cv) {
        console.log('window.cv confirmed available:', window.cv.getBuildInformation?.());
        resolve();
      } else {
        console.error('opencv-ready fired but window.cv is undefined');
        reject(new Error('OpenCV loaded but window.cv is undefined'));
      }
    });

    // Fallback: Check periodically
    const checkInterval = setInterval(() => {
      if (window.cv && window.isOpenCvReady) {
        console.log('Fallback: OpenCV detected manually');
        clearInterval(checkInterval);
        clearTimeout(timeoutId);
        resolve();
      }
    }, 500);
  });
};

const waitForCvReady = () => {
  return new Promise<void>((resolve) => {
    if (cvReady) {
      console.log('cvReady already true, proceeding immediately');
      resolve();
    } else {
      console.log('Waiting for cvReady to become true...');
      const interval = setInterval(() => {
        if (cvReady) {
          clearInterval(interval);
          console.log('cvReady became true, proceeding');
          resolve();
        }
      }, 500);
      // Timeout after 60 seconds to prevent infinite wait
      setTimeout(() => {
        clearInterval(interval);
        console.error('waitForCvReady timed out after 60 seconds');
        resolve(); // Resolve anyway to avoid hanging
      }, 60000);
    }
  });
};

export function DigitalImageEnhancer() {
  const { user } = useAuth();
  const [image, setImage] = useState<ImageState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [enhancements, setEnhancements] = useState<Enhancement>(defaultEnhancements);
  const [outputFormat, setOutputFormat] = useState('jpeg');
  const webcamRef = useRef<Webcam | null>(null);
  const [cvReady, setCvReady] = useState(false);
  const [initializingCV, setInitializingCV] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        await initOpenCV();
        if (mounted) {
          setCvReady(true);
          setInitializingCV(false);
          console.log('OpenCV initialization complete');
        }
      } catch (err) {
        if (mounted) {
          setError('Failed to load image processing library. Please refresh the page.');
          setInitializingCV(false);
          console.error('OpenCV initialization failed:', err);
        }
      }
    };

    initialize();

    return () => {
      mounted = false;
    };
  }, []);

  const waitForCvReady = () => {
    return new Promise<void>((resolve) => {
      if (cvReady) {
        console.log('cvReady already true, proceeding immediately');
        resolve();
      } else {
        console.log('Waiting for cvReady to become true...');
        const interval = setInterval(() => {
          if (cvReady) {
            clearInterval(interval);
            console.log('cvReady became true, proceeding');
            resolve();
          }
        }, 500); // Check every 500ms
      }
    });
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImage({
          original: reader.result as string,
          preview: reader.result as string,
          enhanced: null,
        });
        handleAutoEnhance(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.tiff'],
    },
    maxFiles: 1,
  });

  const captureFromCamera = useCallback(() => {
    if (!/Mobi|Android|iPhone/i.test(navigator.userAgent)) {
      alert('Camera capture is only available on mobile devices.');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.style.display = 'none';

    input.onchange = (event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files ? target.files[0] : null;
      if (file) {
        const newImage = {
          id: Math.random().toString(36).substr(2, 9),
          file,
          preview: URL.createObjectURL(file),
        };
        setImage({
          original: newImage.preview,
          preview: newImage.preview,
          enhanced: null,
        });
        handleAutoEnhance(newImage.preview);
        setShowCamera(false);
      }
    };

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  }, []);

  const handleAutoEnhance = useCallback(
    async (imageSrc: string) => {
      console.log('handleAutoEnhance called with imageSrc:', imageSrc);
      if (!cvReady) {
        console.log('OpenCV not ready, waiting for initialization...');
        setLoading(true);
        await waitForCvReady();
        setLoading(false);
        if (!cvReady) {
          setError('Image processing library failed to load after waiting. Please refresh.');
          return;
        }
      }
  
      setLoading(true);
      setError(null);
      console.log('Starting enhancement process, cvReady:', cvReady);
  
      try {
        console.log('Creating worker...');
        const worker = new Worker(new URL('../workers/imageProcessor.worker.js', import.meta.url));
  
        console.log('Preparing image data...');
        const img = await createImageBitmap(await (await fetch(imageSrc)).blob());
        const canvas = new OffscreenCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
        console.log('Posting message to worker...');
        worker.postMessage(
          {
            imageData,
            enhancements,
            outputFormat,
          },
          [imageData.data.buffer]
        );
  
        const workerTimeout = setTimeout(() => {
          console.error('Worker timed out after 30 seconds');
          worker.terminate();
          setError('Image processing took too long. Please try again.');
          setLoading(false);
        }, 30000);
  
        worker.onmessage = ({ data }) => {
          clearTimeout(workerTimeout);
          if (data.error) {
            console.error('Worker error:', data.error);
            setError(data.error);
          } else {
            console.log('Enhanced image URL received:', data.result);
            setImage((prev) => ({
              ...prev!,
              enhanced: data.result,
            }));
          }
          worker.terminate();
          setLoading(false);
        };
  
        worker.onerror = (error) => {
          clearTimeout(workerTimeout);
          console.error('Worker error:', error.message);
          setError('Image processing failed: ' + error.message);
          worker.terminate();
          setLoading(false);
        };
      } catch (err) {
        console.error('Error in handleAutoEnhance:', err);
        setError('Error enhancing image: ' + err.message);
        setLoading(false);
      }
    },
    [cvReady, enhancements, outputFormat]
  );

  const handleEnhancementChange = (key: keyof Enhancement, value: number) => {
    setEnhancements((prev) => ({
      ...prev,
      [key]: value,
    }));

    if (image) {
      handleAutoEnhance(image.original);
    }
  };

  const handleDownload = () => {
    if (!image?.enhanced) return;

    const link = document.createElement('a');
    link.href = image.enhanced;
    link.download = `enhanced-image.${outputFormat}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetImage = () => {
    setImage(null);
    setEnhancements(defaultEnhancements);
    setError(null);
  };

  if (initializingCV) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading image processing library...</p>
            <p className="text-sm text-gray-500">This may take a few moments. Please wait.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {showCamera ? (
            <div className="space-y-4">
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>
              <div className="flex justify-center gap-2">
                <button
                  onClick={captureFromCamera}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Capture
                </button>
                <button
                  onClick={() => setShowCamera(false)}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : !image ? (
            <>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-6 sm:p-8 text-center cursor-pointer transition-colors
                  ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400'}`}
              >
                <input {...getInputProps()} />
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">
                  {isDragActive ? 'Drop the image here' : 'Drag & drop an image here, or tap to select'}
                </p>
                <p className="text-sm text-gray-500 mt-2">Supports JPEG, PNG, WebP, TIFF</p>
              </div>
              <div className="flex justify-center">
                <button
                  onClick={() => setShowCamera(true)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Use Camera
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-800">Original Image</h2>
                <button
                  onClick={resetImage}
                  className="text-gray-500 hover:text-gray-700"
                  title="Remove image"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
                <img
                  src={image.preview}
                  alt="Original"
                  className="absolute inset-0 w-full h-full object-contain"
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {image && (
            <>
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-800">Enhanced Image</h2>
                <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
                  {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                      <p className="ml-2 text-gray-600">Processing image...</p>
                    </div>
                  ) : image.enhanced ? (
                    <img
                      src={image.enhanced}
                      alt="Enhanced"
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                      No enhanced image available.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6 bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700">Enhancement Controls</h3>
                  <button
                    onClick={() => {
                      setEnhancements(defaultEnhancements);
                      handleAutoEnhance(image.original);
                    }}
                    className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                  >
                    Reset
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Brightness: {enhancements.brightness}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      value={enhancements.brightness}
                      onChange={(e) => handleEnhancementChange('brightness', Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contrast: {enhancements.contrast}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      value={enhancements.contrast}
                      onChange={(e) => handleEnhancementChange('contrast', Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Saturation: {enhancements.saturation}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      value={enhancements.saturation}
                      onChange={(e) => handleEnhancementChange('saturation', Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sharpness: {enhancements.sharpness}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={enhancements.sharpness}
                      onChange={(e) => handleEnhancementChange('sharpness', Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Noise Reduction: {enhancements.denoise}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={enhancements.denoise}
                      onChange={(e) => handleEnhancementChange('denoise', Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Output Format</label>
                    <select
                      value={outputFormat}
                      onChange={(e) => setOutputFormat(e.target.value)}
                      className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    >
                      {formatOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between pt-4">
                    <button
                      onClick={() => handleAutoEnhance(image.original)}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-5 h-5 mr-2" />
                          Auto Enhance
                        </>
                      )}
                    </button>

                    {image.enhanced && (
                      <button
                        onClick={handleDownload}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center"
                      >
                        <Download className="w-5 h-5 mr-2" />
                        Download
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
}