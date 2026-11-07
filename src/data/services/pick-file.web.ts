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

/** Downloads the text as a file. */
export async function shareTextFile(name: string, text: string, mimeType = 'application/json'): Promise<void> {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
