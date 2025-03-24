import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { PDFDocument } from 'pdf-lib';
import { pdfjsLib } from '../utils/pdfjs';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { Document, Packer, Paragraph } from 'docx';
import { Upload, Download, Loader2, X, FileText, FilePlus, Split, Images, GripVertical } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import {
  DndContext,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy
} from '@dnd-kit/sortable';
import { useOperationsCache } from '../utils/operationsCache';
import type { CachedOperation } from '../types/cache';
import { SEOHeaders } from './SEOHeaders';
import { AdComponent } from './AdComponent';
import { 
  validateFile, 
  ALLOWED_PDF_TYPES, 
  ALLOWED_IMAGE_TYPES, 
  createSecureObjectURL,
  createSecureDownloadLink,
  revokeBlobUrl
} from '../utils/security';

interface PDFFile {
  file: File;
  preview?: string;
}

interface ImageItem {
  id: string;
  file: File;
  preview: string;
}

interface PreviewSizes {
  original: number | null;
  compressed: number | null;
}

interface SortableImageProps {
  id: string;
  preview: string;
  onRemove: (id: string) => void;
  index: number;
}

function SortableImage({ id, preview, onRemove, index }: SortableImageProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    zIndex: isDragging ? 10 : 0,
    opacity: isDragging ? 0.7 : 1,
    scale: isDragging ? 1.1 : 1,
  };

  const handleRemoveClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRemove(id);
  };

  return (
    <div
      ref={setNodeRef}
      className="relative aspect-[3/4] bg-white rounded-lg shadow-md flex items-center justify-center"
      style={style}
      {...attributes}
    >
      <img
        src={preview}
        alt={`Image ${index + 1}`}
        className="absolute inset-0 w-full h-full object-cover rounded-lg"
        loading="lazy"
        onError={(e) => {
          (e.currentTarget as HTMLElement).style.display = 'none';
          (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block';
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center text-red-500 hidden">
        Failed to load image
      </div>
      <button
        className="absolute left-1 top-1 bg-white rounded-full p-2 cursor-move z-20 pointer-events-auto hover:bg-gray-300 transition-colors touch-none"
        {...listeners}
        aria-label={`Drag to reorder image ${index + 1}`}
      >
        <GripVertical className="w-5 h-5 text-indigo-700" />
      </button>
      <button
        onClick={handleRemoveClick}
        onTouchEnd={handleRemoveClick}
        className="absolute top-2 right-2 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-colors z-20 pointer-events-auto"
        type="button"
        aria-label={`Remove image ${index + 1}`}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <X className="w-4 h-4 text-gray-700" />
      </button>
    </div>
  );
}

const tabs = [
  { id: 'create', label: 'Create PDF', icon: FileText },
  { id: 'merge', label: 'Merge PDFs', icon: FilePlus },
  { id: 'split', label: 'Split PDF', icon: Split },
  { id: 'to-images', label: 'PDF to Images', icon: Images },
  { id: 'compress', label: 'Compress PDF', icon: FileText },
  { id: 'to-excel', label: 'PDF to Excel', icon: FileText },
  { id: 'to-word', label: 'PDF to Word', icon: FileText },
  { id: 'word-to-pdf', label: 'Word to PDF', icon: FileText },
  { id: 'excel-to-pdf', label: 'Excel to PDF', icon: FileText },
];

export function PDFTools() {
  const { saveOperation } = useOperationsCache();
  const [recentOperations] = useState<CachedOperation[]>([]);
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'create');
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [splitPages, setSplitPages] = useState<string>('');
  const [compressionLevel, setCompressionLevel] = useState<number>(80);
  const [previewSize, setPreviewSize] = useState<PreviewSizes>({
    original: null,
    compressed: null
  });

  const [createQualityLevel, setCreateQualityLevel] = useState<number>(80);
  const [createFileSizes, setCreateFileSizes] = useState<{
    original: number | null;
    estimated: number | null;
    final: number | null;
  }>({
    original: null,
    estimated: null,
    final: null,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 0,
        distance: 0,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 0,
        tolerance: 10,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const allowedTypes = activeTab === 'create' ? ALLOWED_IMAGE_TYPES : 
                    activeTab === 'word-to-pdf' ? [...Object.values({ 'application/msword': ['.doc', '.docx'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] })].flat() :
                    activeTab === 'excel-to-pdf' ? [...Object.values({ 'application/vnd.ms-excel': ['.xls'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] })].flat() :
                    ALLOWED_PDF_TYPES;

    const validFiles = acceptedFiles.filter(file => {
      const validation = validateFile(file, allowedTypes);
      if (!validation.isValid) {
        setError(validation.error || 'Invalid file type');
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) {
      setError(`No valid files were uploaded. Please upload ${activeTab === 'create' ? 'images (JPEG, PNG, WebP)' : 
             activeTab === 'word-to-pdf' ? 'Word documents (.doc, .docx)' : 
             activeTab === 'excel-to-pdf' ? 'Excel files (.xls, .xlsx)' : 'PDF files'}.`);
      return;
    }

    if (activeTab === 'create') {
      const newImages = validFiles.map(file => {
        try {
          const preview = createSecureObjectURL(file);
          return {
            id: `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            file,
            preview
          };
        } catch (err) {
          setError(`Failed to create preview for ${file.name}: ${(err as Error).message}`);
          return null;
        }
      }).filter((img): img is ImageItem => img !== null);

      setImages(prev => {
        const updatedImages = [...prev, ...newImages].slice(0, 30);
        const totalOriginalSize = updatedImages.reduce((sum, img) => sum + img.file.size, 0);
        const estimatedSize = totalOriginalSize * (createQualityLevel / 100);
        setCreateFileSizes({
          original: totalOriginalSize,
          estimated: estimatedSize,
          final: null,
        });
        return updatedImages;
      });
    } else {
      const newFiles = validFiles.map(file => ({
        file,
        preview: createSecureObjectURL(file)
      }));
      setFiles(prev => [...prev, ...newFiles]);

      if (activeTab === 'compress' && validFiles.length === 1) {
        setPreviewSize({
          original: validFiles[0].size,
          compressed: null
        });
      }
    }
    setResult(null);
    setResultBlob(null);
    if (validFiles.length > 0) setError(null);
  }, [activeTab, createQualityLevel]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: activeTab === 'create' ? { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] } :
            activeTab === 'word-to-pdf' ? { 
              'application/msword': ['.doc'], 
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] 
            } :
            activeTab === 'excel-to-pdf' ? { 
              'application/vnd.ms-excel': ['.xls'], 
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] 
            } :
            { 'application/pdf': ['.pdf'] },
    multiple: activeTab === 'create' || activeTab === 'merge',
    maxFiles: activeTab === 'create' ? 30 : undefined
  });

  const handleDragStart = useCallback((event: DragStartEvent) => {
    console.log('Drag started:', event);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    if (active.id !== over.id) {
      setImages((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, []);

  const handleRemoveImage = useCallback((id: string) => {
    setImages(prev => {
      const imageToRemove = prev.find(img => img.id === id);
      if (imageToRemove) {
        revokeBlobUrl(imageToRemove.preview);
      }
      const updatedImages = prev.filter(img => img.id !== id);
      const totalOriginalSize = updatedImages.reduce((sum, img) => sum + img.file.size, 0);
      const estimatedSize = totalOriginalSize * (createQualityLevel / 100);
      setCreateFileSizes({
        original: totalOriginalSize,
        estimated: estimatedSize,
        final: null,
      });
      return updatedImages;
    });
  }, [createQualityLevel]);

  const handleCreatePDF = async () => {
    if (images.length === 0) {
      setError('Please select at least one image');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const pdfDoc = await PDFDocument.create();

      for (const image of images) {
        const imageBytes = await image.file.arrayBuffer();
        const img = new Image();
        img.src = URL.createObjectURL(new Blob([imageBytes], { type: image.file.type }));

        await new Promise((resolve) => {
          img.onload = resolve;
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to get canvas context');

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const quality = createQualityLevel / 100;
        const compressedImageData = canvas.toDataURL('image/jpeg', quality);
        const compressedImageBytes = await fetch(compressedImageData).then(res => res.blob()).then(blob => blob.arrayBuffer());

        let pdfImage = await pdfDoc.embedJpg(compressedImageBytes);
        const page = pdfDoc.addPage();
        const { width, height } = page.getSize();
        const aspectRatio = pdfImage.width / pdfImage.height;

        let drawWidth = width - 40;
        let drawHeight = drawWidth / aspectRatio;

        if (drawHeight > height - 40) {
          drawHeight = height - 40;
          drawWidth = drawHeight * aspectRatio;
        }

        page.drawImage(pdfImage, {
          x: (width - drawWidth) / 2,
          y: (height - drawHeight) / 2,
          width: drawWidth,
          height: drawHeight,
        });

        URL.revokeObjectURL(img.src);
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });

      if (result) revokeBlobUrl(result);
      const newResult = createSecureObjectURL(blob);
      setResult(newResult);
      setResultBlob(blob);

      setCreateFileSizes(prev => ({
        ...prev,
        final: pdfBytes.length,
      }));

      saveOperation({
        type: 'create_pdf',
        metadata: {
          filename: 'document.pdf',
          fileSize: pdfBytes.length,
          settings: { imageCount: images.length, qualityLevel: createQualityLevel }
        },
        preview: createSecureObjectURL(blob)
      });
    } catch (err) {
      setError('Error creating PDF. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMergePDF = async () => {
    if (files.length < 2) {
      setError('Please select at least two PDF files');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const mergedPdf = await PDFDocument.create();

      for (const file of files) {
        const pdfBytes = await file.file.arrayBuffer();
        const pdf = await PDFDocument.load(pdfBytes);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });

      if (result) revokeBlobUrl(result);
      const newResult = createSecureObjectURL(blob);
      setResult(newResult);
      setResultBlob(blob);

      saveOperation({
        type: 'merge_pdf',
        metadata: {
          filename: 'merged.pdf',
          fileSize: mergedPdfBytes.length,
          settings: { fileCount: files.length }
        },
        preview: createSecureObjectURL(blob)
      });
    } catch (err) {
      setError('Error merging PDFs. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSplitPDF = async () => {
    if (files.length !== 1) {
      setError('Please select one PDF file');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const pdfBytes = await files[0].file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pageCount = pdfDoc.getPageCount();

      const pageRanges = splitPages
        .split(',')
        .map(range => range.trim())
        .map(range => {
          const [start, end] = range.split('-').map(num => parseInt(num));
          return end ? { start: start - 1, end } : { start: start - 1, end: start };
        })
        .filter(range => range.start >= 0 && range.end <= pageCount);

      const splitPdfs = await Promise.all(pageRanges.map(async (range) => {
        const newPdf = await PDFDocument.create();
        const pages = await newPdf.copyPages(pdfDoc, Array.from(
          { length: range.end - range.start },
          (_, i) => range.start + i
        ));
        pages.forEach(page => newPdf.addPage(page));
        return newPdf.save();
      }));

      const blobs = splitPdfs.map(pdfBytes => 
        new Blob([pdfBytes], { type: 'application/pdf' })
      );

      if (result) revokeBlobUrl(result);
      const newResult = createSecureObjectURL(blobs[0]);
      setResult(newResult);
      setResultBlob(blobs[0]);

      saveOperation({
        type: 'split_pdf',
        metadata: {
          filename: files[0].file.name,
          fileSize: blobs[0].size,
          settings: { pageRanges }
        },
        preview: createSecureObjectURL(blobs[0])
      });
    } catch (err) {
      setError('Error splitting PDF. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePDFToImages = async () => {
    if (files.length !== 1) {
      setError('Please select one PDF file');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const pdfFile = files[0].file;
      if (!pdfFile.type.includes('pdf')) {
        throw new Error('Invalid file type - only PDF files are supported');
      }

      const pdfData = await pdfFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({
        data: pdfData,
        verbosity: 0
      }).promise;
      const zip = new JSZip();
      const imageBlobs: Blob[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error(`Failed to get 2D context for page ${i}`);
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => {
              if (b) resolve(b);
              else reject(new Error(`Failed to convert page ${i} to blob`));
            },
            'image/png',
            1.0
          );
        });

        imageBlobs.push(blob);
        zip.file(`page-${i}.png`, blob);
      }

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
      });

      if (result) revokeBlobUrl(result);
      const newResult = createSecureObjectURL(zipBlob);
      setResult(newResult);
      setResultBlob(zipBlob);

      if (imageBlobs.length > 0) {
        saveOperation({
          type: 'pdf_to_images',
          metadata: {
            filename: files[0].file.name,
            fileSize: zipBlob.size,
            settings: { pageCount: pdf.numPages },
          },
          preview: createSecureObjectURL(imageBlobs[0]),
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred during conversion';
      setError(`PDF to images failed: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCompressPDF = async () => {
    if (files.length !== 1) {
      setError('Please select one PDF file');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const pdfBytes = await files[0].file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pageCount = pdfDoc.getPageCount();

      const compressedPdf = await PDFDocument.create();

      for (let i = 0; i < pageCount; i++) {
        const page = pdfDoc.getPage(i);
        const [copiedPage] = await compressedPdf.copyPages(pdfDoc, [i]);
        compressedPdf.addPage(copiedPage);
      }

      const compressedBytes = await compressedPdf.save({
        useObjectStreams: false,
        addDefaultPage: false,
      });

      const blob = new Blob([compressedBytes], { type: 'application/pdf' });

      if (result) revokeBlobUrl(result);
      const newResult = createSecureObjectURL(blob);
      setResult(newResult);
      setResultBlob(blob);

      setPreviewSize(prev => ({
        ...prev,
        compressed: compressedBytes.length
      }));

      saveOperation({
        type: 'compress_pdf',
        metadata: {
          filename: files[0].file.name,
          fileSize: compressedBytes.length,
          settings: { compressionLevel }
        },
        preview: createSecureObjectURL(blob)
      });
    } catch (err) {
      setError('Error compressing PDF. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePDFToExcel = async () => {
    if (files.length !== 1) {
      setError('Please select one PDF file');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const pdfFile = files[0].file;
      const pdfData = await pdfFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sheet1');

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const textItems = textContent.items.map(item => 'text' in item ? item.text : '');
        worksheet.addRow([`Page ${i}`]);
        textItems.forEach(text => worksheet.addRow([text]));
        worksheet.addRow([]); // Empty row between pages
      }

      const excelBuffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      if (result) revokeBlobUrl(result);
      const newResult = createSecureObjectURL(blob);
      setResult(newResult);
      setResultBlob(blob);

      saveOperation({
        type: 'pdf_to_excel',
        metadata: {
          filename: files[0].file.name.replace('.pdf', '.xlsx'),
          fileSize: blob.size,
          settings: { pageCount: pdf.numPages }
        },
        preview: undefined
      });
    } catch (err) {
      setError('Error converting PDF to Excel. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePDFToWord = async () => {
    if (files.length !== 1) {
      setError('Please select one PDF file');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const pdfFile = files[0].file;
      const pdfData = await pdfFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
      const doc = new Document({
        sections: []
      });
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const textItems = textContent.items.map(item => 'text' in item ? item.text : '');
        doc.sections.push({
          children: [
            new Paragraph(`Page ${i}`),
            ...textItems.map(text => new Paragraph(text)),
            new Paragraph('')
          ]
        });
      }

      const docBuffer = await Packer.toBuffer(doc);
      const blob = new Blob([docBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

      if (result) revokeBlobUrl(result);
      const newResult = createSecureObjectURL(blob);
      setResult(newResult);
      setResultBlob(blob);

      saveOperation({
        type: 'pdf_to_word',
        metadata: {
          filename: files[0].file.name.replace('.pdf', '.docx'),
          fileSize: blob.size,
          settings: { pageCount: pdf.numPages }
        },
        preview: null
      });
    } catch (err) {
      setError('Error converting PDF to Word. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleWordToPDF = async () => {
    if (files.length !== 1) {
      setError('Please select one Word document');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const wordFile = files[0].file;
      const text = await wordFile.text(); // Simplified; for .docx, you'd need a parser like mammoth
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const { width, height } = page.getSize();
      const fontSize = 12;

      page.drawText(text, {
        x: 50,
        y: height - 50,
        size: fontSize,
        maxWidth: width - 100,
        lineHeight: fontSize * 1.2
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });

      if (result) revokeBlobUrl(result);
      const newResult = createSecureObjectURL(blob);
      setResult(newResult);
      setResultBlob(blob);

      saveOperation({
        type: 'word_to_pdf',
        metadata: {
          filename: files[0].file.name.replace(/\.(doc|docx)$/, '.pdf'),
          fileSize: blob.size,
          settings: {}
        },
        preview: createSecureObjectURL(blob)
      });
    } catch (err) {
      setError('Error converting Word to PDF. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExcelToPDF = async () => {
    if (files.length !== 1) {
      setError('Please select one Excel file');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const excelFile = files[0].file;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await excelFile.arrayBuffer());
      let textContent = '';

      workbook.eachSheet((sheet) => {
        textContent += `Sheet: ${sheet.name}\n`;
        sheet.eachRow((row) => {
          textContent += row.values?.filter(Boolean).join(' ') + '\n';
        });
        textContent += '\n';
      });

      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const { width, height } = page.getSize();
      const fontSize = 12;

      page.drawText(textContent, {
        x: 50,
        y: height - 50,
        size: fontSize,
        maxWidth: width - 100,
        lineHeight: fontSize * 1.2
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });

      if (result) revokeBlobUrl(result);
      const newResult = createSecureObjectURL(blob);
      setResult(newResult);
      setResultBlob(blob);

      saveOperation({
        type: 'excel_to_pdf',
        metadata: {
          filename: files[0].file.name.replace(/\.(xls|xlsx)$/, '.pdf'),
          fileSize: blob.size,
          settings: {}
        },
        preview: createSecureObjectURL(blob)
      });
    } catch (err) {
      setError('Error converting Excel to PDF. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = () => {
    switch (activeTab) {
      case 'create':
        handleCreatePDF();
        break;
      case 'merge':
        handleMergePDF();
        break;
      case 'split':
        handleSplitPDF();
        break;
      case 'to-images':
        handlePDFToImages();
        break;
      case 'compress':
        handleCompressPDF();
        break;
      case 'to-excel':
        handlePDFToExcel();
        break;
      case 'to-word':
        handlePDFToWord();
        break;
      case 'word-to-pdf':
        handleWordToPDF();
        break;
      case 'excel-to-pdf':
        handleExcelToPDF();
        break;
    }
  };

  const handleDownload = async () => {
    if (!resultBlob) return;

    try {
      const filename = activeTab === 'to-images' ? 'pdf-images.zip' :
                      activeTab === 'to-excel' ? `${files[0]?.file.name.replace('.pdf', '') || 'converted'}.xlsx` :
                      activeTab === 'to-word' ? `${files[0]?.file.name.replace('.pdf', '') || 'converted'}.docx` :
                      `processed-${activeTab}.pdf`;
      const link = createSecureDownloadLink(resultBlob, filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error downloading file:', err);
      setError('Error downloading file. Please try again.');
    }
  };

  const resetFiles = useCallback(() => {
    images.forEach(image => revokeBlobUrl(image.preview));
    files.forEach(file => file.preview && revokeBlobUrl(file.preview));
    if (result) revokeBlobUrl(result);

    setFiles([]);
    setImages([]);
    setResult(null);
    setResultBlob(null);
    setError(null);
    setPreviewSize({ original: null, compressed: null });
    setCreateFileSizes({ original: null, estimated: null, final: null });
  }, [images, files, result]);

  const formatFileSize = (bytes: number | null) => {
    if (bytes === null) return 'Unknown';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const calculateReduction = () => {
    if (!previewSize.original || !previewSize.compressed) return null;
    const reduction = ((previewSize.original - previewSize.compressed) / previewSize.original) * 100;
    return Math.round(reduction);
  };

  const calculateCreateReduction = () => {
    if (!createFileSizes.original || !createFileSizes.final) return null;
    const reduction = ((createFileSizes.original - createFileSizes.final) / createFileSizes.original) * 100;
    return Math.round(reduction);
  };

  const handleQualityChange = (newQuality: number) => {
    setCreateQualityLevel(newQuality);
    if (createFileSizes.original) {
      const estimatedSize = createFileSizes.original * (newQuality / 100);
      setCreateFileSizes(prev => ({
        ...prev,
        estimated: estimatedSize,
      }));
    }
  };

  const renderImageGrid = () => {
    if (activeTab !== 'create' || images.length === 0) return null;

    return (
      <div className="mt-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">
            Selected Images ({images.length}/30)
          </h3>
          <button
            onClick={resetFiles}
            className="text-gray-500 hover:text-gray-700"
            title="Remove all images"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={rectIntersection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={images.map(img => img.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {images.map((image, idx) => (
                <SortableImage
                  key={image.id}
                  id={image.id}
                  preview={image.preview}
                  onRemove={handleRemoveImage}
                  index={idx}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    );
  };

  return (
    <>
      <SEOHeaders 
        title="Free Online PDF Tools - Merge, Split, Convert, Compress, Excel & Word"
        description="Convert PDFs to Excel, Word, images, merge, split, compress, and convert Word/Excel to PDF online for free. No registration required."
        keywords={[
          'merge pdf files free',
          'split pdf online',
          'compress pdf size',
          'convert pdf to jpg',
          'pdf merger online',
          'combine pdf files',
          'pdf splitter free',
          'reduce pdf file size',
          'pdf compression tool',
          'pdf to image converter',
          'pdf to excel converter',
          'pdf to word converter',
          'word to pdf converter',
          'excel to pdf converter'
        ]}
      />
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 sm:mb-8 text-center">
          PDF Tools
        </h1>

        <AdComponent
          slot="pdf-tools-top"
          className="mb-6"
          style={{ minHeight: '90px' }}
        />

        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                resetFiles();
              }}
              className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${activeTab === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-6 sm:p-8 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400'}`}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">
              {isDragActive
                ? 'Drop the files here'
                : `Drag & drop ${activeTab === 'create' ? 'images' : 
                   activeTab === 'merge' ? 'PDF files' : 
                   activeTab === 'word-to-pdf' ? 'Word documents' :
                   activeTab === 'excel-to-pdf' ? 'Excel files' :
                   'a file'} here, or tap to select`}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {activeTab === 'create' ? 'Supports images (JPEG, PNG, WebP)' :
               activeTab === 'word-to-pdf' ? 'Supports Word (.doc, .docx)' :
               activeTab === 'excel-to-pdf' ? 'Supports Excel (.xls, .xlsx)' :
               'Supports PDF files'}
            </p>
          </div>
        </div>

        {renderImageGrid()}

        {activeTab === 'create' && images.length > 0 && (
          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quality: {createQualityLevel}% (Higher quality = Larger file size)
              </label>
              <input
                type="range"
                min="1"
                max="100"
                step="1"
                value={createQualityLevel}
                onChange={(e) => handleQualityChange(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg cursor-pointer accent-indigo-600"
              />
            </div>

            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Original Size (Images):</span>
                <span className="font-medium">{formatFileSize(createFileSizes.original)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Estimated PDF Size:</span>
                <span className="font-medium">{formatFileSize(createFileSizes.estimated)}</span>
              </div>
              {createFileSizes.final !== null && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Final PDF Size:</span>
                    <span className="font-medium">{formatFileSize(createFileSizes.final)}</span>
                  </div>
                  {calculateCreateReduction() !== null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Reduction:</span>
                      <span className="font-medium text-green-600">{calculateCreateReduction()}%</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {activeTab !== 'create' && files.length > 0 && (
          <div className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Selected Files</h3>
              <button
                onClick={resetFiles}
                className="text-gray-500 hover:text-gray-700"
                title="Remove all files"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                  <span className="text-gray-700">{file.file.name}</span>
                  <button
                    onClick={() => setFiles(files.filter((_, i) => i !== index))}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'split' && (
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Page Ranges (e.g., 1-3, 4, 5-7)
            </label>
            <input
              type="text"
              value={splitPages}
              onChange={(e) => setSplitPages(e.target.value)}
              placeholder="Enter page ranges"
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
        )}

        {activeTab === 'compress' && (
          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Compression Level: {compressionLevel}%
              </label>
              <input
                type="range"
                min="1"
                max="100"
                value={compressionLevel}
                onChange={(e) => setCompressionLevel(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            {previewSize.original && (
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Original Size:</span>
                  <span className="font-medium">{formatFileSize(previewSize.original)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Compressed Size:</span>
                  <span className="font-medium">{formatFileSize(previewSize.compressed)}</span>
                </div>
                {calculateReduction() !== null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Reduction:</span>
                    <span className="font-medium text-green-600">{calculateReduction()}%</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleProcess}
            disabled={loading || (activeTab === 'create' ?
              images.length === 0 : files.length === 0)}
            className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5 mr-2" />
                Process
              </>
            )}
          </button>

          {result && (
            <button
              onClick={handleDownload}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
            >
              <Download className="w-5 h-5 mr-2" />
              Download {activeTab === 'to-images' ? 'ZIP' : 
                        activeTab === 'to-excel' ? 'CSV' :
                        activeTab === 'to-word' ? 'TXT' : 'PDF'}
            </button>
          )}
        </div>

        {result && (
          <AdComponent
            slot="pdf-tools-bottom"
            className="mt-6"
            style={{ minHeight: '250px' }}
          />
        )}

        {recentOperations.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Operations</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {recentOperations.map(op => (
                <div
                  key={op.id}
                  className="bg-white p-4 rounded-lg shadow-sm border border-gray-200"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">
                      {op.type.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(op.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  {op.metadata.filename && (
                    <p className="text-sm text-gray-500 mt-1">{op.metadata.filename}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}