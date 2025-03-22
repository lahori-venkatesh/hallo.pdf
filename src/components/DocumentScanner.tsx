import React, { useState, useCallback, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, Download, Loader2, X, Image as ImageIcon } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { useOperationsCache } from '../utils/operationsCache';
import { CachedOperation, CachedSettings } from '../types/cache';
import { SEOHeaders } from './SEOHeaders';
import { AdComponent } from './AdComponent';
import { validateFile, ALLOWED_IMAGE_TYPES, createSecureDownloadLink } from '../utils/security';

interface CapturedImage {
  dataUrl: string;
  timestamp: number;
}

export function DocumentScanner() {
  const { saveOperation, getRecentOperations, saveSettings, getSettings } = useOperationsCache();
  const [recentOperations, setRecentOperations] = useState<CachedOperation[]>([]);
  const webcamRef = useRef<Webcam | null>(null);
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  useEffect(() => {
    // Check if the browser supports the MediaDevices API
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Camera access is not supported by your browser');
      return;
    }

    // Request camera permission
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(() => setCameraEnabled(true))
      .catch(() => setError('Camera access denied'));

    return () => {
      // Clean up camera stream when component unmounts
      if (webcamRef.current) {
        const stream = webcamRef.current.video?.srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      }
    };
  }, []);

  // Load cached settings on mount
  useEffect(() => {
    const settings = getSettings('scanner');
    if (settings?.camera) {
      setFacingMode(settings.camera.facingMode);
    }
    setRecentOperations(getRecentOperations());
  }, []);

  // Save camera settings when they change
  useEffect(() => {
    saveSettings('scanner', {
      camera: {
        facingMode,
        resolution: {
          width: 1280,
          height: 720
        }
      }
    });
  }, [facingMode]);

  const capture = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setImages(prev => [...prev, {
          dataUrl: imageSrc,
          timestamp: Date.now()
        }]);
      }
    }
  }, [webcamRef]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const validation = validateFile(file, ALLOWED_IMAGE_TYPES);
      if (!validation.isValid) {
        setError(validation.error);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setImages(prev => [...prev, {
          dataUrl: reader.result as string,
          timestamp: Date.now()
        }]);
      };
      reader.readAsDataURL(file);
      setError(null);
    }
  }, []);

  const toggleCamera = useCallback(() => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }, []);

  const removeImage = (timestamp: number) => {
    setImages(prev => prev.filter(img => img.timestamp !== timestamp));
  };

  const processImages = async () => {
    if (images.length === 0) {
      setError('Please capture at least one image');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const processedImages = await Promise.all(images.map(async (image) => {
        const response = await fetch(image.dataUrl);
        const blob = await response.blob();
        
        const compressedFile = await imageCompression(
          new File([blob], 'scanned-document.jpg', { type: 'image/jpeg' }),
          {
            maxSizeMB: 1,
            maxWidthOrHeight: 2048,
            useWebWorker: true
          }
        );

        saveOperation({
          type: 'document_scan',
          metadata: {
            filename: `scan-${new Date(image.timestamp).toISOString()}.jpg`,
            fileSize: compressedFile.size
          },
          preview: URL.createObjectURL(compressedFile)
        });

        return { blob: compressedFile, timestamp: image.timestamp };
      }));

      // Download all processed images
      processedImages.forEach(({ blob, timestamp }) => {
        const filename = `scanned-document-${new Date(timestamp).toISOString()}.jpg`;
        const link = createSecureDownloadLink(blob, filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
    } catch (err) {
      setError('Error processing images. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode
  };

  return (
    <>
      <SEOHeaders 
        title="Free Online Document Scanner - Scan to PDF with Your Camera"
        description="Turn your device's camera into a document scanner. Scan documents, receipts, and photos directly to PDF. Free online scanning tool."
        keywords={[
          'document scanner online',
          'scan to pdf free',
          'mobile document scanner',
          'receipt scanner app',
          'photo to pdf scanner',
          'web scanner tool',
          'camera scanner online',
          'document digitizer'
        ]}
      />
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 sm:mb-8 text-center">
          Document Scanner
        </h1>

        {/* Top Ad */}
        <AdComponent
          slot="scanner-top"
          className="mb-6"
          style={{ minHeight: '90px' }}
        />

        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          {error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          ) : cameraEnabled ? (
            <div className="space-y-6">
              {/* Camera Preview */}
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  videoConstraints={videoConstraints}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                  <button
                    onClick={capture}
                    className="bg-white text-gray-900 px-4 py-2 rounded-full shadow-lg hover:bg-gray-100 transition-colors flex items-center"
                  >
                    <Camera className="w-5 h-5 mr-2" />
                    Capture
                  </button>
                  <button
                    onClick={toggleCamera}
                    className="bg-white text-gray-900 px-4 py-2 rounded-full shadow-lg hover:bg-gray-100 transition-colors"
                  >
                    Switch Camera
                  </button>
                </div>
              </div>

              {/* Captured Images */}
              {images.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Captured Images</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {images.map((image) => (
                      <div key={image.timestamp} className="relative aspect-[3/4]">
                        <img
                          src={image.dataUrl}
                          alt={`Captured at ${new Date(image.timestamp).toLocaleTimeString()}`}
                          className="absolute inset-0 w-full h-full object-cover rounded-lg"
                        />
                        <button
                          onClick={() => removeImage(image.timestamp)}
                          className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-lg hover:bg-gray-100 transition-colors"
                        >
                          <X className="w-4 h-4 text-gray-700" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex justify-center">
                    <button
                      onClick={processImages}
                      disabled={loading}
                      className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Download className="w-5 h-5 mr-2" />
                          Download All
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 text-gray-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Requesting camera access...</p>
            </div>
          )}
        </div>

        {/* Middle Ad - After Camera/Upload Area */}
        {(images.length > 0 || cameraEnabled) && (
          <AdComponent
            slot="scanner-middle"
            className="my-6"
            style={{ minHeight: '250px' }}
          />
        )}

        {/* Captured Images Section */}
        {images.length > 0 && (
          <div className="mt-6">
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Captured Images</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {images.map((image) => (
                  <div key={image.timestamp} className="relative aspect-[3/4]">
                    <img
                      src={image.dataUrl}
                      alt={`Captured at ${new Date(image.timestamp).toLocaleTimeString()}`}
                      className="absolute inset-0 w-full h-full object-cover rounded-lg"
                    />
                    <button
                      onClick={() => removeImage(image.timestamp)}
                      className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-lg hover:bg-gray-100 transition-colors"
                    >
                      <X className="w-4 h-4 text-gray-700" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Ad - After Images */}
            <AdComponent
              slot="scanner-bottom"
              className="mt-6"
              style={{ minHeight: '250px' }}
            />
          </div>
        )}

        {/* Recent Scans */}
        {recentOperations.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Scans</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {recentOperations.map(op => (
                <div
                  key={op.id}
                  className="relative aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden"
                >
                  {op.preview && (
                    <img
                      src={op.preview}
                      alt={op.metadata.filename}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-black bg-opacity-50 p-2">
                    <p className="text-xs text-white">
                      {new Date(op.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}