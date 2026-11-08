import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/** Opens the system print dialog (AirPrint / Android print), which also offers Save as PDF. */
export async function printHtml(html: string): Promise<void> {
  await Print.printAsync({ html });
}

/** Renders a PDF and opens the share sheet. */
export async function shareHtmlAsPdf(html: string, title: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync())
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: title, UTI: 'com.adobe.pdf' });
}
