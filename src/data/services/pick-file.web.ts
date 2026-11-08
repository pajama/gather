import * as DocumentPicker from 'expo-document-picker';

export interface PickedFile {
  name: string;
  bytes: Uint8Array;
}

export async function pickFile(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const buffer = asset.file ? await asset.file.arrayBuffer() : await (await fetch(asset.uri)).arrayBuffer();
  return { name: asset.name, bytes: new Uint8Array(buffer) };
}

/** Downloads bytes as a file. */
export async function shareBinaryFile(
  name: string,
  bytes: Uint8Array,
  mimeType = 'application/zip',
): Promise<void> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  download(name, new Blob([copy.buffer], { type: mimeType }));
}

function download(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Downloads the text as a file. */
export async function shareTextFile(
  name: string,
  text: string,
  mimeType = 'application/json',
): Promise<void> {
  download(name, new Blob([text], { type: mimeType }));
}
