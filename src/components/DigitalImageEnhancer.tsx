import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import Webcam from 'react-webcam';
import {
  Upload,
  Download,
  Loader2,
  X,
  Camera,
  Wand2
} from 'lucide-react';
import { setCache, getCache, CACHE_KEYS, CACHE_EXPIRY } from '../utils/cache';
import { useAuth } from '../contexts/AuthContext';
import { SEOHeaders } from './SEOHeaders';
import { AdComponent } from './AdComponent';

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
  { value: 'webp', label: 'WebP - Modern format, smaller size' }
];

declare global {
  interface Window {
    cv: any;
    isOpenCvReady: boolean;
  }
}

// Pre-initialize OpenCV
const initOpenCV = () => {
  if (window.cv) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    // Set a timeout for initialization
    const timeoutId = setTimeout(() => {
      reject(new Error('OpenCV initialization timeout'));
    }, 5000);

    // Listen for OpenCV ready event
    window.addEventListener('opencv-ready', function onReady() {
      window.removeEventListener('opencv-ready', onReady);
      clearTimeout(timeoutId);
      resolve();
    });
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
        }
      } catch (err) {
        if (mounted) {
          setError('Failed to load image processing library. Please refresh the page.');
          setInitializingCV(false);
        }
      }
    };

    initialize();

    return () => {
      mounted = false;
    };
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImage({
          original: reader.result as string,
          preview: reader.result as string,
          enhanced: null
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
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.tiff']
    },
    maxFiles: 1
  });

  const captureFromCamera = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setImage({
          original: imageSrc,
          preview: imageSrc,
          enhanced: null
        });
        handleAutoEnhance(imageSrc);
        setShowCamera(false);
      }
    }
  }, []);

  const handleAutoEnhance = async (imageSrc: string) => {
    if (!cvReady) {
      setError('Image processing library is loading. Please wait a moment and try again.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const img = new Image();
      img.src = imageSrc;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const src = window.cv.matFromImageData(imageData);
      const dst = new window.cv.Mat();

      // Apply enhancements
      src.convertTo(dst, -1, enhancements.contrast / 100, enhancements.brightness - 100);

      // Apply saturation
      if (enhancements.saturation !== 100) {
        const hsv = new window.cv.Mat();
        window.cv.cvtColor(dst, hsv, window.cv.COLOR_BGR2HSV);
        const channels = new window.cv.MatVector();
        window.cv.split(hsv, channels);
        channels.get(1).convertTo(channels.get(1), -1, enhancements.saturation / 100, 0);
        window.cv.merge(channels, hsv);
        window.cv.cvtColor(hsv, dst, window.cv.COLOR_HSV2BGR);
        hsv.delete();
        channels.delete();
      }

      // Apply sharpening
      if (enhancements.sharpness > 0) {
        const kernel = new window.cv.Mat(3, 3, window.cv.CV_32F, [-1, -1, -1, -1, 9, -1, -1, -1, -1]);
        window.cv.filter2D(dst, dst, -1, kernel, new window.cv.Point(-1, -1), 0, window.cv.BORDER_DEFAULT);
        kernel.delete();
      }

      // Apply denoising
      if (enhancements.denoise > 0) {
        window.cv.fastNlMeansDenoisingColored(dst, dst);
      }

      // Display result
      window.cv.imshow(canvas, dst);

      // Cleanup
      src.delete();
      dst.delete();

      // Convert to desired format
      const enhancedImage = canvas.toDataURL(`image/${outputFormat}`);
      setImage(prev => ({
        ...prev!,
        enhanced: enhancedImage
      }));

    } catch (err) {
      console.error('Error enhancing image:', err);
      setError('Error enhancing image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEnhancementChange = (key: keyof Enhancement, value: number) => {
    setEnhancements(prev => ({
      ...prev,
      [key]: value
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
                <p className="text-sm text-gray-500 mt-2">
                  Supports JPEG, PNG, WebP, TIFF
                </p>
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
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                    </div>
                  ) : image.enhanced ? (
                    <img
                      src={image.enhanced}
                      alt="Enhanced"
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                      Processing image...
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Output Format
                    </label>
                    <select
                      value={outputFormat}
                      onChange={(e) => setOutputFormat(e.target.value)}
                      className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    >
                      {formatOptions.map(option => (
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