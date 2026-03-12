import * as pdfjsLib from 'pdfjs-dist';
import { parsePDF } from './parsePDF';
import { parseImage } from './parseImage';

/**
 * Converts a PDF page to a canvas for OCR.
 * @param {Object} pdf - PDF.js document object.
 * @param {number} pageNum - Page number.
 * @returns {Promise<HTMLCanvasElement>}
 */
const convertPageToCanvas = async (pdf, pageNum) => {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 }); // High scale for better OCR
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
        canvasContext: context,
        viewport: viewport
    }).promise;

    return canvas;
};

/**
 * Handles the fallback OCR for scanned PDFs.
 * @param {File} file - The PDF file object.
 * @param {Function} onProgress - Callback for progress updates.
 * @returns {Promise<string>}
 */
const handleScannedPDF = async (file, onProgress) => {
    onProgress?.({
        status: 'This looks like a scanned document. Running advanced image scan...',
        progress: 0
    });

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    let fullText = '';

    for (let i = 1; i <= numPages; i++) {
        onProgress?.({
            status: `Converting page ${i} of ${numPages} to image...`,
            progress: (i / numPages) * 30
        });

        const canvas = await convertPageToCanvas(pdf, i);

        onProgress?.({
            status: `Running OCR on page ${i} of ${numPages}...`,
            progress: 30 + (i / numPages) * 70
        });

        const pageText = await parseImage(canvas, subProgress => {
            // Scale OCR progress within the page's chunk
            const baseProgress = 30 + ((i - 1) / numPages) * 70;
            const stepProgress = (subProgress.progress / 100) * (70 / numPages);
            onProgress?.({
                status: `OCR Scanning page ${i}: ${subProgress.status}`,
                progress: Math.min(99, baseProgress + stepProgress)
            });
        });

        fullText += pageText + '\n\n';
    }

    return fullText.trim();
};

/**
 * Master function to parse any supported medical document.
 * @param {File} file - The uploaded file.
 * @param {Function} onProgress - Callback for progress updates.
 * @returns {Promise<string>} - Extracted text.
 */
export const parseDocument = async (file, onProgress) => {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    if (fileType === 'application/pdf') {
        const result = await parsePDF(file, onProgress);

        if (result.isScanned) {
            return await handleScannedPDF(file, onProgress);
        }

        return result.text;
    }

    if (['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/bmp'].includes(fileType) ||
        /\.(jpg|jpeg|png|webp|bmp)$/.test(fileName)) {
        return await parseImage(file, onProgress);
    }

    throw new Error('Unsupported file type. Please upload a PDF or image file.');
};
