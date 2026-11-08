import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export interface PickedFile {
  name: string;
  bytes: Uint8Array;
}

/** Lets the user choose any file; resolves to its bytes, or null when cancelled. */
export async function pickFile(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return { name: asset.name, bytes: await new File(asset.uri).bytes() };
}

/** Writes bytes to a temporary file and opens the share sheet. */
export async function shareBinaryFile(
  name: string,
  bytes: Uint8Array,
  mimeType = 'application/zip',
): Promise<void> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
}

/** Writes text to a temporary file and opens the share sheet. */
export async function shareTextFile(
  name: string,
  text: string,
  mimeType = 'application/json',
): Promise<void> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(text);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
}
