/**
 * Text recognition (OCR) for scanning cookbook pages in the browser, with
 * Tesseract compiled to WebAssembly. The library and its English model load
 * on first use, so they cost nothing until someone scans.
 */

/** The single-file preview cannot download the model (no network), so it turns scanning off. */
export const scanSupported = process.env.EXPO_PUBLIC_SINGLE_FILE !== '1';

export async function recognizeText(image: string, onProgress?: (fraction: number) => void): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(image);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
