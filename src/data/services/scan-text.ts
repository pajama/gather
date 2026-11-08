/**
 * Text recognition on iOS and Android needs a native module (Apple's Vision
 * or ML Kit), which Expo Go cannot load. Until Gather ships a development
 * build with one, scanning runs in the web app; on iPhone, Live Text can copy
 * a page's text for the Paste text importer.
 */

export const scanSupported = false;

export async function recognizeText(_image: string, _onProgress?: (fraction: number) => void): Promise<string> {
  throw new Error('Scanning is not available in this build.');
}
