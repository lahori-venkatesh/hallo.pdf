import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import imageCompression from 'browser-image-compression';
import { Upload, Download, Image as ImageIcon, Loader2, X, Camera, FileText, Settings2, Crop, RotateCw } from 'lucide-react';
import Webcam from 'react-webcam';
import { jsPDF } from 'jspdf';
import { useOperationsCache } from '../utils/operationsCache';
//import { CachedOperation } from '../types/cache';
import { SEOHeaders } from './SEOHeaders';
import { AdComponent } from './AdComponent';
import { 
  validateFile, 
  ALLOWED_IMAGE_TYPES, 
  createSecureObjectURL,
  createSecureDownloadLink,
  revokeBlobUrl 
} from '../utils/security';

interface PreviewImage {
  file: File;
  preview: string;
}

interface ConversionSettings {
  mode: 'size' | 'quality';
  targetSize: number | null;
  quality: number;
  format: string;
  width: number | null;
  height: number | null;
  maintainAspectRatio: boolean;
}

interface Point {
  x: number;
  y: number;
}

const formatOptions = [
  { value: 'jpeg', label: 'JPEG - Best for photos', mimeType: 'image/jpeg' },
  { value: 'png', label: 'PNG - Best for graphics', mimeType: 'image/png' },
  { value: 'webp', label: 'WebP - Modern format, smaller size', mimeType: 'image/webp' },
  { value: 'gif', label: 'GIF - Animated images', mimeType: 'image/gif' },
  { value: 'svg', label: 'SVG - Vector graphics', mimeType: 'image/svg+xml' },
  { value: 'pdf', label: 'PDF - Document format', mimeType: 'application/pdf' }
];

const sizeOptions = [
  { label: '10KB', size: 0.01 },
  { label: '50KB', size: 0.05 },
  { label: '100KB', size: 0.1 },
  { label: '250KB', size: 0.25 },
  { label: '500KB', size: 0.5 },
  { label: '1MB', size: 1 },
  { label: '2MB', size: 2 }
];

export function ImageTools() {
  const { saveOperation } = useOperationsCache();
  const [image, setImage] = useState<PreviewImage | null>(null);
  const [convertedImage, setConvertedImage] = useState<string | null>(null);
  const [convertedBlob, setConvertedBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState<number | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const webcamRef = useRef<Webcam | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const cropContainerRef = useRef<HTMLDivElement | null>(null);
  const [settings, setSettings] = useState<ConversionSettings>({
    mode: 'quality',
    targetSize: null,
    quality: 80,
    format: 'jpeg',
    width: null,
    height: null,
    maintainAspectRatio: true
  });

  const dataURLtoBlob = (dataURL: string): Blob => {
    const [header, data] = dataURL.split(',');
    const mimeMatch = header.match(/:(.*?);/);
    if (!mimeMatch) throw new Error('Invalid data URL');
    const mime = mimeMatch[1];
    const binary = atob(data);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    return new Blob([array], { type: mime });
  };

  const blobToDataURL = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const validation = validateFile(file, ALLOWED_IMAGE_TYPES);
      if (!validation.isValid) {
        if (validation.error) {
          setError(validation.error);
        } else {
          setError('An unknown error occurred'); // or some other default error message
        }
        return;
      }

      const previewUrl = createSecureObjectURL(file);
      setCropImageSrc(previewUrl);
      setShowCropModal(true);
      setImage({
        file,
        preview: previewUrl
      });
      setConvertedImage(null);
      setConvertedBlob(null);
      setError(null);
    }
  }, [image]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']
    },
    maxFiles: 1
  });

  const captureFromCamera = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        fetch(imageSrc)
          .then(res => res.blob())
          .then(blob => {
            const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
            
            const previewUrl = createSecureObjectURL(file);
            setCropImageSrc(previewUrl);
            setShowCropModal(true);
            setImage({
              file,
              preview: previewUrl
            });
            setShowCamera(false);
            setConvertedImage(null);
            setConvertedBlob(null);
            setError(null);
          })
          .catch(err => {
            console.error('Error capturing image from camera:', err);
            setError('Failed to capture image from camera.');
          });
      } else {
        setError('Failed to capture image. Please try again.');
      }
    }
  }, [webcamRef, image]);

  const handleImageLoad = () => {
    if (imgRef.current && cropContainerRef.current) {
      const { width, height } = imgRef.current;

      const cropWidth = width * 0.8;
      const cropHeight = height * 0.8;
      const cropX = (width - cropWidth) / 2;
      const cropY = (height - cropHeight) / 2;

      setPoints([
        { x: cropX, y: cropY },
        { x: cropX + cropWidth, y: cropY },
        { x: cropX + cropWidth, y: cropY + cropHeight },
        { x: cropX, y: cropY + cropHeight },
      ]);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, index: number | 'rotate') => {
    if (index === 'rotate') {
      setIsRotating(true);
    } else {
      setIsDragging(index);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cropContainerRef.current || (isDragging === null && !isRotating)) return;

    const rect = cropContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isRotating) {
      const center = points.reduce(
        (acc, p) => ({ x: acc.x + p.x / 4, y: acc.y + p.y / 4 }),
        { x: 0, y: 0 }
      );
      const angle = Math.atan2(y - center.y, x - center.x) - Math.PI / 2;
      const newRotation = (angle * 180) / Math.PI;
      setRotation(newRotation);

      const newPoints = points.map((p) => {
        const dx = p.x - center.x;
        const dy = p.y - center.y;
        const radius = Math.sqrt(dx * dx + dy * dy);
        const currentAngle = Math.atan2(dy, dx);
        const newAngle = currentAngle + (newRotation * Math.PI) / 180;
        return {
          x: center.x + radius * Math.cos(newAngle),
          y: center.y + radius * Math.sin(newAngle),
        };
      });
      setPoints(newPoints);
    } else if (isDragging !== null) {
      const newPoints = [...points];
      newPoints[isDragging] = { x: Math.max(0, Math.min(x, rect.width)), y: Math.max(0, Math.min(y, rect.height)) };
      setPoints(newPoints);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(null);
    setIsRotating(false);
  };

  const applyCrop = async (imageSrc: string, points: Point[]): Promise<string> => {
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageSrc;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      const scaleX = img.width / (imgRef.current?.width || img.width);
      const scaleY = img.height / (imgRef.current?.height || img.height);

      const scaledPoints = points.map((p) => ({
        x: p.x * scaleX,
        y: p.y * scaleY,
      }));

      const minX = Math.min(...scaledPoints.map(p => p.x));
      const maxX = Math.max(...scaledPoints.map(p => p.x));
      const minY = Math.min(...scaledPoints.map(p => p.y));
      const maxY = Math.max(...scaledPoints.map(p => p.y));

      const cropWidth = maxX - minX;
      const cropHeight = maxY - minY;

      if (cropWidth <= 0 || cropHeight <= 0) {
        throw new Error('Invalid crop dimensions: width or height is zero or negative');
      }

      canvas.width = cropWidth;
      canvas.height = cropHeight;

      // Apply rotation if any
      if (rotation !== 0) {
        ctx.translate(cropWidth / 2, cropHeight / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-cropWidth / 2, -cropHeight / 2);
      }

      ctx.drawImage(
        img,
        minX,
        minY,
        cropWidth,
        cropHeight,
        0,
        0,
        cropWidth,
        cropHeight
      );

      const croppedBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob from canvas'));
          }
        }, 'image/jpeg', 1.0);
      });

      return await blobToDataURL(croppedBlob);
    } catch (err) {
      console.error('Error in applyCrop:', err);
      throw err;
    }
  };

  const handleCropComplete = async () => {
    if (!cropImageSrc || points.length !== 4) {
      setError('Invalid crop selection. Please adjust the crop area and try again.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const croppedSrc = await applyCrop(cropImageSrc, points);
      if (!croppedSrc) {
        throw new Error('Cropped image data is empty');
      }

      const croppedBlob = dataURLtoBlob(croppedSrc);
      const croppedFile = new File([croppedBlob], image?.file.name || 'cropped-image.jpg', { type: 'image/jpeg' });

      const oldPreview = image?.preview;

      setImage({
        file: croppedFile,
        preview: croppedSrc
      });

      if (oldPreview) {
        revokeBlobUrl(oldPreview);
      }

      setShowCropModal(false);
      setCropImageSrc(null);
      setPoints([]);
      setRotation(0);
    } catch (err) {
      console.error('Error in handleCropComplete:', err);
      setError('Cropping failed: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleConversion = async () => {
    if (!image) {
      setError('Please select an image');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let resultBlob: Blob;

      if (settings.format === 'pdf') {
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'px'
        });

        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = image.preview;
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        const aspectRatio = img.width / img.height;
        let width = img.width;
        let height = img.height;
        
        if (settings.width && settings.height && settings.maintainAspectRatio) {
          if (width / height > aspectRatio) {
            width = height * aspectRatio;
          } else {
            height = width / aspectRatio;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        pdf.addImage(
          canvas.toDataURL('image/jpeg', settings.quality / 100),
          'JPEG',
          0,
          0,
          pdf.internal.pageSize.getWidth(),
          pdf.internal.pageSize.getHeight(),
          undefined,
          'FAST'
        );

        resultBlob = pdf.output('blob');
      } else {
        const options = {
          maxSizeMB: settings.mode === 'size' ? settings.targetSize || 1 : undefined,
          maxWidthOrHeight: Math.max(settings.width || 0, settings.height || 0) || undefined,
          initialQuality: settings.quality / 100,
          useWebWorker: true,
          fileType: formatOptions.find(f => f.value === settings.format)?.mimeType || 'image/jpeg'
        };

        const compressedFile = await imageCompression(image.file, options);
        resultBlob = compressedFile;
      }

      if (convertedImage) {
        revokeBlobUrl(convertedImage);
      }

      const resultUrl = createSecureObjectURL(resultBlob);

      saveOperation({
        type: 'image_conversion',
        metadata: {
          filename: image.file.name,
          fileSize: resultBlob.size,
          format: settings.format,
          settings: {
            mode: settings.mode,
            quality: settings.quality,
            targetSize: settings.targetSize
          }
        },
        preview: createSecureObjectURL(resultBlob)
      });

      setConvertedImage(resultUrl);
      setConvertedBlob(resultBlob);
    } catch (err) {
      console.error('Error converting image:', err);
      setError('Error converting image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!convertedBlob || !settings.format) return;

    try {
      const extension = settings.format === 'jpeg' ? 'jpg' : settings.format;
      const link = createSecureDownloadLink(convertedBlob, `converted.${extension}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error downloading image:', err);
      setError('Error downloading image. Please try again.');
    }
  };

  const resetImage = () => {
    if (image?.preview) {
      revokeBlobUrl(image.preview);
    }
    if (convertedImage) {
      revokeBlobUrl(convertedImage);
    }
    setImage(null);
    setConvertedImage(null);
    setConvertedBlob(null);
    setError(null);
    setShowCamera(false);
    setShowCropModal(false);
    setCropImageSrc(null);
    setPoints([]);
    setRotation(0);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const videoConstraints = {
    facingMode: { ideal: 'environment' }
  };

  return (
    <>
      <SEOHeaders 
        title="Free Online Image Tools - Convert, Compress & Optimize Images"
        description="Convert and compress images online for free. Support for JPEG, PNG, WebP, SVG, GIF, and PDF formats."
        keywords={[
          'image converter',
          'compress images',
          'image to pdf',
          'jpg to png',
          'png to svg',
          'webp converter',
          'gif optimizer',
          'image size reducer'
        ]}
      />
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 sm:mb-8 text-center">
          Image Tools
        </h1>

        <AdComponent
          slot="image-tools-top"
          className="mb-6"
          style={{ minHeight: '90px' }}
        />

        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          {showCamera ? (
            <div className="space-y-4">
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  videoConstraints={videoConstraints}
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
          ) : showCropModal && cropImageSrc ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">Crop Image</h3>
              <div
                ref={cropContainerRef}
                className="relative w-full h-full overflow-auto"
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <img
                  ref={imgRef}
                  src={cropImageSrc}
                  alt="Crop"
                  onLoad={handleImageLoad}
                  className="w-auto h-auto max-w-full max-h-[70vh]"
                />
                {points.length === 4 && (
                  <>
                    <svg
                      className="absolute top-0 left-0 pointer-events-none"
                      width={imgRef.current?.width || 0}
                      height={imgRef.current?.height || 0}
                    >
                      <polygon
                        points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                        fill="rgba(79, 70, 229, 0.3)"
                        stroke="rgba(79, 70, 229, 1)"
                        strokeWidth="2"
                      />
                    </svg>
                    {points.map((point, index) => (
                      <div
                        key={index}
                        className="absolute w-4 h-4 bg-indigo-600 rounded-full cursor-move"
                        style={{
                          left: `${point.x}px`,
                          top: `${point.y}px`,
                          transform: 'translate(-50%, -50%)',
                        }}
                        onMouseDown={(e) => handleMouseDown(e, index)}
                      />
                    ))}
                    <div
                      className="absolute w-4 h-4 bg-green-600 rounded-full cursor-pointer"
                      style={{
                        left: `${(points[0].x + points[1].x) / 2}px`,
                        top: `${points[0].y - 30}px`,
                        transform: 'translate(-50%, -50%)',
                      }}
                      onMouseDown={(e) => handleMouseDown(e, 'rotate')}
                    >
                      <RotateCw className="w-4 h-4 text-white" />
                    </div>
                  </>
                )}
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => {
                    setShowCropModal(false);
                    setCropImageSrc(null);
                    setPoints([]);
                    setRotation(0);
                    resetImage();
                  }}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCropComplete}
                  disabled={loading}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Cropping...
                    </>
                  ) : (
                    <>
                      <Crop className="w-5 h-5 mr-2" />
                      Apply Crop
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : !image ? (
            <div>
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
                  Supports JPEG, PNG, WebP, GIF, SVG
                </p>
              </div>
              <div className="mt-4 flex justify-center">
                <button
                  onClick={() => setShowCamera(true)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Use Camera
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-800">Image Preview</h3>
                <button
                  onClick={resetImage}
                  className="text-gray-500 hover:text-gray-700"
                  title="Remove image"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="aspect-square relative rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={image.preview}
                      alt="Preview"
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    Original: {formatFileSize(image.file.size)}
                  </p>
                </div>

                {convertedImage && (
                  <div>
                    <div className="aspect-square relative rounded-lg overflow-hidden bg-gray-100">
                      <img
                        src={convertedImage}
                        alt="Converted"
                        className="absolute inset-0 w-full h-full object-contain"
                      />
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      Converted: {convertedBlob ? formatFileSize(convertedBlob.size) : 'Unknown size'}
                    </p>
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700">Conversion Settings</h3>
                  <Settings2 className="w-5 h-5 text-gray-400" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Output Format
                  </label>
                  <select
                    value={settings.format}
                    onChange={(e) => setSettings(prev => ({ ...prev, format: e.target.value }))}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    {formatOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Conversion Mode
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSettings(prev => ({ ...prev, mode: 'quality' }))}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                        ${settings.mode === 'quality'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                      Quality
                    </button>
                    <button
                      onClick={() => setSettings(prev => ({ ...prev, mode: 'size' }))}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                        ${settings.mode === 'size'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                      Target Size
                    </button>
                  </div>
                </div>

                {settings.mode === 'quality' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quality: {settings.quality}%
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={settings.quality}
                      onChange={(e) => setSettings(prev => ({ ...prev, quality: Number(e.target.value) }))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Target Size
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {sizeOptions.map((option) => (
                        <button
                          key={option.size}
                          onClick={() => setSettings(prev => ({ ...prev, targetSize: option.size }))}
                          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors
                            ${settings.targetSize === option.size
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Width (optional)
                    </label>
                    <input
                      type="number"
                      value={settings.width || ''}
                      onChange={(e) => setSettings(prev => ({ ...prev, width: e.target.value ? Number(e.target.value) : null }))}
                      placeholder="Auto"
                      className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Height (optional)
                    </label>
                    <input
                      type="number"
                      value={settings.height || ''}
                      onChange={(e) => setSettings(prev => ({ ...prev, height: e.target.value ? Number(e.target.value) : null }))}
                      placeholder="Auto"
                      className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="maintainAspectRatio"
                    checked={settings.maintainAspectRatio}
                    onChange={(e) => setSettings(prev => ({ ...prev, maintainAspectRatio: e.target.checked }))}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="maintainAspectRatio" className="ml-2 text-sm text-gray-700">
                    Maintain aspect ratio
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleConversion}
                    disabled={loading || !settings.format || (settings.mode === 'size' && !settings.targetSize)}
                    className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        Converting...
                      </>
                    ) : (
                      <>
                        {settings.format === 'pdf' ? (
                          <FileText className="w-5 h-5 mr-2" />
                        ) : (
                          <ImageIcon className="w-5 h-5 mr-2" />
                        )}
                        Convert
                      </>
                    )}
                  </button>

                  {convertedImage && (
                    <button
                      onClick={handleDownload}
                      className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
                    >
                      <Download className="w-5 h-5 mr-2" />
                      Download
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default ImageTools;