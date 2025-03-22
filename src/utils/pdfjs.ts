import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

// Initialize PDF.js worker
const workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url
).toString();

/* @vite-ignore */ // Ignore Vite build-time warning about dynamic worker resolution
GlobalWorkerOptions.workerSrc = workerSrc;

export const pdfjsLib = { getDocument };
