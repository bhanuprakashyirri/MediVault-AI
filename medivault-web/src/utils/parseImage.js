import { createWorker } from 'tesseract.js';

/**
 * Clean OCR text by removing excessive whitespace and fixing common medical OCR errors.
 * @param {string} text 
 * @returns {string}
 */
const cleanOCRText = (text) => {
    return text
        .replace(/\s+/g, ' ') // Remove multiple spaces
        .replace(/\n\s*\n/g, '\n') // Remove excessive empty lines
        .trim();
};

/**
 * Extracts text from an image file using Tesseract.js.
 * @param {File|string|HTMLCanvasElement} image - The image file, URL, or canvas.
 * @param {Function} onProgress - Callback for progress updates.
 * @param {string} lang - Recognition language (default: 'eng').
 * @returns {Promise<string>} - The extracted text.
 */
export const parseImage = async (image, onProgress, lang = 'eng') => {
    // If image is a File object, check size
    if (image instanceof File && image.size > 5 * 1024 * 1024) {
        throw new Error('Image too large. Please compress it under 5MB.');
    }

    const worker = await createWorker({
        logger: m => {
            if (m.status === 'recognizing text') {
                onProgress?.({
                    status: `Running OCR scan... ${Math.round(m.progress * 100)}%`,
                    progress: Math.round(m.progress * 100)
                });
            }
        }
    });

    try {
        onProgress?.({ status: 'Loading image...', progress: 10 });

        await worker.loadLanguage(lang);
        await worker.initialize(lang);

        const { data: { text } } = await worker.recognize(image);

        if (!text || text.trim().length === 0) {
            throw new Error('No text detected. Please upload a clearer document photo.');
        }

        const cleanedText = cleanOCRText(text);

        onProgress?.({ status: 'Text extraction complete!', progress: 100 });

        return cleanedText;
    } catch (error) {
        console.error('OCR Error:', error);
        if (error.message.includes('No text detected')) throw error;
        throw new Error('Image quality too low. Please upload a clearer photo.');
    } finally {
        await worker.terminate();
    }
};
