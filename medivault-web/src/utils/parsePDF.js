import * as pdfjsLib from 'pdfjs-dist';

// Set up worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * Extracts text from a PDF file.
 * @param {File} file - The PDF file object.
 * @param {Function} onProgress - Callback for progress updates.
 * @returns {Promise<string>} - The extracted text.
 */
export const parsePDF = async (file, onProgress) => {
    if (file.size > 10 * 1024 * 1024) {
        throw new Error('File too large. Please upload a PDF under 10MB.');
    }

    try {
        onProgress?.({ status: 'Reading PDF...', progress: 10 });

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });

        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;
        let fullText = '';

        for (let i = 1; i <= numPages; i++) {
            onProgress?.({
                status: `Extracting page ${i} of ${numPages}...`,
                progress: 10 + (i / numPages) * 80
            });

            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n\n';
        }

        onProgress?.({ status: 'Text extraction complete!', progress: 100 });

        // Return structured result to handle scanned PDFs later
        return {
            text: fullText.trim(),
            pageCount: numPages,
            isScanned: fullText.trim().length < 50
        };
    } catch (error) {
        if (error.name === 'PasswordException') {
            throw new Error('This PDF is password protected. Please unlock it first.');
        }
        console.error('PDF Analysis Error:', error);
        throw new Error('Invalid PDF file. Please upload a proper PDF.');
    }
};
