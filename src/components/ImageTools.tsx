import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import imageCompression from 'browser-image-compression';
import { Upload, Download, Image as ImageIcon, Loader2, X, Camera, FileText, Settings2, Crop, RotateCw } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useOperationsCache } from '../utils/operationsCache';
import { SEOHeaders } from './SEOHeaders';
import { AdComponent } from './AdComponent';
import { validateFile, ALLOWED_IMAGE_TYPES, createSecureObjectURL, createSecureDownloadLink, revokeBlobUrl } from '../utils/security';

interface PreviewImage { file: File; preview: string }
interface Point { x: number; y: number }
interface ConversionSettings {
  mode: 'size' | 'quality';
  targetSize: number | null;
  quality: number;
  format: string;
  width: number | null;
  height: number | null;
  maintainAspectRatio: boolean;
}

const formatOptions = [
  { value: 'jpeg', label: 'JPEG', mimeType: 'image/jpeg' },
  { value: 'png', label: 'PNG', mimeType: 'image/png' },
  { value: 'webp', label: 'WebP', mimeType: 'image/webp' },
  { value: 'gif', label: 'GIF', mimeType: 'image/gif' },
  { value: 'svg', label: 'SVG', mimeType: 'image/svg+xml' },
  { value: 'pdf', label: 'PDF', mimeType: 'application/pdf' }
];

const sizeOptions = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2];

export function ImageTools() {
  const { saveOperation } = useOperationsCache();
  const [image, setImage] = useState<PreviewImage | null>(null);
  const [convertedImage, setConvertedImage] = useState<string | null>(null);
  const [convertedBlob, setConvertedBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [rotation, setRotation] = useState(0);
  const [dragState, setDragState] = useState<{ index: number | 'rotate' | null; type: 'move' | 'rotate' | null }>({ index: null, type: null });
  const imgRef = useRef<HTMLImageElement>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<ConversionSettings>({
    mode: 'quality', targetSize: null, quality: 80, format: 'jpeg', width: null, height: null, maintainAspectRatio: true
  });

  const dataURLtoBlob = useCallback((dataURL: string): Blob => {
    const [header, data] = dataURL.split(',');
    const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
    const binary = atob(data);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
    return new Blob([array], { type: mime });
  }, []);

  const blobToDataURL = useCallback((blob: Blob): Promise<string> => 
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    }), []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file || !validateFile(file, ALLOWED_IMAGE_TYPES).isValid) {
      setError('Invalid file type');
      return;
    }
    const previewUrl = createSecureObjectURL(file);
    setCropImageSrc(previewUrl);
    setShowCropModal(true);
    setImage({ file, preview: previewUrl });
    setConvertedImage(null);
    setConvertedBlob(null);
    setError(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'] },
    maxFiles: 1
  });

  const handleCameraCapture = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !validateFile(file, ALLOWED_IMAGE_TYPES).isValid) {
      setError('Invalid file type from camera');
      return;
    }
    const previewUrl = createSecureObjectURL(file);
    setCropImageSrc(previewUrl);
    setShowCropModal(true);
    setImage({ file, preview: previewUrl });
    setConvertedImage(null);
    setConvertedBlob(null);
    setError(null);
    // Reset the input value to allow re-capturing
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  }, []);

  const handleImageLoad = useCallback(() => {
    if (!imgRef.current || !cropContainerRef.current) return;
    const { width, height } = imgRef.current;
    const cropWidth = width * 0.8;
    const cropHeight = height * 0.8;
    const cropX = (width - cropWidth) / 2;
    const cropY = (height - cropHeight) / 2;
    setPoints([
      { x: cropX, y: cropY },
      { x: cropX + cropWidth, y: cropY },
      { x: cropX + cropWidth, y: cropY + cropHeight },
      { x: cropX, y: cropY + cropHeight }
    ]);
  }, []);

  const getEventPosition = useCallback((e: React.MouseEvent | React.TouchEvent, rect: DOMRect) => {
    const isTouch = 'touches' in e;
    const x = isTouch ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = isTouch ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    return { x: Math.max(0, Math.min(x, rect.width)), y: Math.max(0, Math.min(y, rect.height)) };
  }, []);

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent, index: number | 'rotate') => {
    e.preventDefault();
    setDragState({ index, type: index === 'rotate' ? 'rotate' : 'move' });
  }, []);

  const handleDragMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!cropContainerRef.current || dragState.index === null) return;
    e.preventDefault();
    const rect = cropContainerRef.current.getBoundingClientRect();
    const { x, y } = getEventPosition(e, rect);

    if (dragState.type === 'rotate') {
      const center = points.reduce((acc, p) => ({ x: acc.x + p.x / 4, y: acc.y + p.y / 4 }), { x: 0, y: 0 });
      const angle = Math.atan2(y - center.y, x - center.x) - Math.PI / 2;
      const newRotation = (angle * 180) / Math.PI;
      setRotation(newRotation);
      setPoints(prev => prev.map(p => {
        const dx = p.x - center.x;
        const dy = p.y - center.y;
        const radius = Math.sqrt(dx * dx + dy * dy);
        const currentAngle = Math.atan2(dy, dx);
        const newAngle = currentAngle + (newRotation * Math.PI) / 180;
        return { x: center.x + radius * Math.cos(newAngle), y: center.y + radius * Math.sin(newAngle) };
      }));
    } else {
      const draggedIndex = dragState.index as number;
      setPoints(prev => {
        const newPoints = [...prev];
        newPoints[draggedIndex] = { x, y };
        return newPoints;
      });
    }
  }, [dragState, getEventPosition]);

  const handleDragEnd = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setDragState({ index: null, type: null });
  }, []);

  const applyCrop = useCallback(async (imageSrc: string, points: Point[]): Promise<string> => {
    const img = new Image();
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = imageSrc; });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context unavailable');

    const scaleX = img.width / (imgRef.current?.width || img.width);
    const scaleY = img.height / (imgRef.current?.height || img.height);
    const scaledPoints = points.map(p => ({ x: p.x * scaleX, y: p.y * scaleY }));
    const [minX, maxX, minY, maxY] = [
      Math.min(...scaledPoints.map(p => p.x)),
      Math.max(...scaledPoints.map(p => p.x)),
      Math.min(...scaledPoints.map(p => p.y)),
      Math.max(...scaledPoints.map(p => p.y))
    ];
    const cropWidth = maxX - minX;
    const cropHeight = maxY - minY;

    if (cropWidth <= 0 || cropHeight <= 0) throw new Error('Invalid crop dimensions');
    canvas.width = cropWidth;
    canvas.height = cropHeight;

    if (rotation) {
      ctx.translate(cropWidth / 2, cropHeight / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-cropWidth / 2, -cropHeight / 2);
    }
    ctx.drawImage(img, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    return blobToDataURL(await new Promise<Blob>(resolve => canvas.toBlob(resolve as BlobCallback, 'image/jpeg', 1)));
  }, [rotation, blobToDataURL]);

  const handleCropComplete = useCallback(async () => {
    if (!cropImageSrc || points.length !== 4) {
      setError('Invalid crop selection');
      return;
    }
    setLoading(true);
    try {
      const croppedSrc = await applyCrop(cropImageSrc, points);
      const croppedBlob = dataURLtoBlob(croppedSrc);
      const croppedFile = new File([croppedBlob], image?.file.name || 'cropped.jpg', { type: 'image/jpeg' });
      revokeBlobUrl(image?.preview);
      setImage({ file: croppedFile, preview: croppedSrc });
      setShowCropModal(false);
      setCropImageSrc(null);
      setPoints([]);
      setRotation(0);
    } catch (err) {
      setError(`Cropping failed: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [cropImageSrc, points, image, applyCrop, dataURLtoBlob]);

  const handleConversion = useCallback(async () => {
    if (!image) {
      setError('No image selected');
      return;
    }
    setLoading(true);
    try {
      const isPDF = settings.format === 'pdf';
      const resultBlob = isPDF ? await createPDF(image.preview, settings) : await compressImage(image.file, settings);
      revokeBlobUrl(convertedImage);
      const resultUrl = createSecureObjectURL(resultBlob);
      saveOperation({
        type: 'image_conversion',
        metadata: { filename: image.file.name, fileSize: resultBlob.size, format: settings.format, settings },
        preview: resultUrl
      });
      setConvertedImage(resultUrl);
      setConvertedBlob(resultBlob);
    } catch {
      setError('Conversion failed');
    } finally {
      setLoading(false);
    }
  }, [image, settings, convertedImage, saveOperation]);

  const createPDF = async (preview: string, settings: ConversionSettings): Promise<Blob> => {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'px' });
    const img = new Image();
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = preview; });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const aspectRatio = img.width / img.height;
    let width = settings.width || img.width;
    let height = settings.height || img.height;
    if (settings.maintainAspectRatio) {
      if (width / height > aspectRatio) width = height * aspectRatio;
      else height = width / aspectRatio;
    }
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);
    pdf.addImage(canvas.toDataURL('image/jpeg', settings.quality / 100), 'JPEG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), undefined, 'FAST');
    return pdf.output('blob');
  };

  const compressImage = (file: File, settings: ConversionSettings): Promise<Blob> =>
    imageCompression(file, {
      maxSizeMB: settings.mode === 'size' ? settings.targetSize || 1 : undefined,
      maxWidthOrHeight: Math.max(settings.width || 0, settings.height || 0) || undefined,
      initialQuality: settings.quality / 100,
      useWebWorker: true,
      fileType: formatOptions.find(f => f.value === settings.format)?.mimeType || 'image/jpeg'
    });

  const handleDownload = useCallback(() => {
    if (!convertedBlob || !settings.format) return;
    const link = createSecureDownloadLink(convertedBlob, `converted.${settings.format === 'jpeg' ? 'jpg' : settings.format}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [convertedBlob, settings.format]);

  const resetImage = useCallback(() => {
    revokeBlobUrl(image?.preview);
    revokeBlobUrl(convertedImage);
    setImage(null);
    setConvertedImage(null);
    setConvertedBlob(null);
    setError(null);
    setShowCropModal(false);
    setCropImageSrc(null);
    setPoints([]);
    setRotation(0);
  }, [image, convertedImage]);

  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }, []);

  const triggerCamera = useCallback(() => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  }, []);

  return (
    <>
      <SEOHeaders title="Image Tools" description="Convert and compress images" keywords={['image converter', 'compress images']} />
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">Image Tools</h1>
        <AdComponent slot="image-tools-top" className="mb-6" style={{ minHeight: '90px' }} />
        <div className="bg-white rounded-xl shadow-lg p-4">
          {showCropModal && cropImageSrc ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">Crop Image</h3>
              <div
                ref={cropContainerRef}
                className="relative overflow-auto touch-none select-none"
                onMouseMove={handleDragMove}
                onMouseUp={handleDragEnd}
                onMouseLeave={handleDragEnd}
                onTouchMove={handleDragMove}
                onTouchEnd={handleDragEnd}
                onTouchCancel={handleDragEnd}
              >
                <img 
                  ref={imgRef} 
                  src={cropImageSrc} 
                  alt="Crop" 
                  onLoad={handleImageLoad} 
                  className="max-w-full max-h-[70vh]" 
                />
                {points.length === 4 && (
                  <>
                    <svg 
                      className="absolute inset-0 pointer-events-none" 
                      width={imgRef.current?.width || 0} 
                      height={imgRef.current?.height || 0}
                    >
                      <polygon 
                        points={points.map(p => `${p.x},${p.y}`).join(' ')} 
                        fill="rgba(79, 70, 229, 0.3)" 
                        stroke="rgba(79, 70, 229, 1)" 
                        strokeWidth="2" 
                      />
                    </svg>
                    {points.map((point, i) => (
                      <div
                        key={i}
                        className="absolute w-6 h-6 bg-indigo-600 rounded-full -translate-x-1/2 -translate-y-1/2 touch-none cursor-move"
                        style={{ left: `${point.x}px`, top: `${point.y}px` }}
                        onMouseDown={e => handleDragStart(e, i)}
                        onTouchStart={e => handleDragStart(e, i)}
                      />
                    ))}
                    <div
                      className="absolute w-6 h-6 bg-green-600 rounded-full -translate-x-1/2 -translate-y-1/2 touch-none flex items-center justify-center cursor-pointer"
                      style={{ 
                        left: `${(points[0].x + points[1].x) / 2}px`, 
                        top: `${points[0].y - 30}px` 
                      }}
                      onMouseDown={e => handleDragStart(e, 'rotate')}
                      onTouchStart={e => handleDragStart(e, 'rotate')}
                    >
                      <RotateCw className="w-4 h-4 text-white" />
                    </div>
                  </>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button 
                  onClick={resetImage} 
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCropComplete} 
                  disabled={loading} 
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center disabled:opacity-50"
                >
                  {loading ? (
                    <><Loader2 className="w-5 h-5 animate-spin mr-2" />Cropping...</>
                  ) : (
                    <><Crop className="w-5 h-5 mr-2" />Apply Crop</>
                  )}
                </button>
              </div>
            </div>
          ) : !image ? (
            <div>
              <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400'}`}>
                <input {...getInputProps()} />
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">{isDragActive ? 'Drop here' : 'Drag & drop or tap to select'}</p>
                <p className="text-sm text-gray-500 mt-2">JPEG, PNG, WebP, GIF, SVG</p>
              </div>
              <button 
                onClick={triggerCamera} 
                className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center mx-auto"
              >
                <Camera className="w-5 h-5 mr-2" />Capture Document
              </button>
              <input
                type="file"
                ref={cameraInputRef}
                accept="image/*"
                capture="environment"
                onChange={handleCameraCapture}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-800">Preview</h3>
                <button onClick={resetImage} className="text-gray-500 hover:text-gray-700"><X className="w-5 h-5" /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <img src={image.preview} alt="Preview" className="w-full aspect-square object-contain rounded-lg bg-gray-100" />
                  <p className="mt-2 text-sm text-gray-500">Original: {formatFileSize(image.file.size)}</p>
                </div>
                {convertedImage && (
                  <div>
                    <img src={convertedImage} alt="Converted" className="w-full aspect-square object-contain rounded-lg bg-gray-100" />
                    <p className="mt-2 text-sm text-gray-500">Converted: {convertedBlob ? formatFileSize(convertedBlob.size) : 'N/A'}</p>
                  </div>
                )}
              </div>
              {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>}
              <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700">Settings</h3>
                  <Settings2 className="w-5 h-5 text-gray-400" />
                </div>
                <select
                  value={settings.format}
                  onChange={e => setSettings(s => ({ ...s, format: e.target.value }))}
                  className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                >
                  {formatOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <div className="flex gap-2">
                  {['quality', 'size'].map(mode => (
                    <button
                      key={mode}
                      onClick={() => setSettings(s => ({ ...s, mode: mode as 'size' | 'quality' }))}
                      className={`flex-1 px-3 py-2 rounded-lg ${settings.mode === mode ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      {mode === 'quality' ? 'Quality' : 'Size'}
                    </button>
                  ))}
                </div>
                {settings.mode === 'quality' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Quality: {settings.quality}%</label>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={settings.quality}
                      onChange={e => setSettings(s => ({ ...s, quality: +e.target.value }))}
                      className="w-full h-2 bg-gray-200 rounded-lg cursor-pointer accent-indigo-600"
                    />
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {sizeOptions.map(size => (
                      <button
                        key={size}
                        onClick={() => setSettings(s => ({ ...s, targetSize: size }))}
                        className={`px-3 py-1 rounded-full ${settings.targetSize === size ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      >
                        {size < 1 ? `${size * 1000}KB` : `${size}MB`}
                      </button>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="number"
                    value={settings.width || ''}
                    onChange={e => setSettings(s => ({ ...s, width: e.target.value ? +e.target.value : null }))}
                    placeholder="Width"
                    className="rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  <input
                    type="number"
                    value={settings.height || ''}
                    onChange={e => setSettings(s => ({ ...s, height: e.target.value ? +e.target.value : null }))}
                    placeholder="Height"
                    className="rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.maintainAspectRatio}
                    onChange={e => setSettings(s => ({ ...s, maintainAspectRatio: e.target.checked }))}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Maintain aspect ratio</span>
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={handleConversion}
                    disabled={loading || !settings.format || (settings.mode === 'size' && !settings.targetSize)}
                    className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center"
                  >
                    {loading ? <><Loader2 className="w-5 h-5 animate-spin mr-2" />Converting...</> : <>{settings.format === 'pdf' ? <FileText className="w-5 h-5 mr-2" /> : <ImageIcon className="w-5 h-5 mr-2" />}Convert</>}
                  </button>
                  {convertedImage && (
                    <button onClick={handleDownload} className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center">
                      <Download className="w-5 h-5 mr-2" />Download
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