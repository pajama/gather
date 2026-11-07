/** Prints through a hidden iframe so the app page itself is untouched; browsers offer Save as PDF there. */
export async function printHtml(html: string): Promise<void> {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  await new Promise<void>((resolve) => {
    const images = [...doc.images];
    if (images.every((img) => img.complete)) return resolve();
    let pending = images.length;
    const done = () => (--pending <= 0 ? resolve() : undefined);
    for (const img of images) {
      img.addEventListener('load', done);
      img.addEventListener('error', done);
    }
    setTimeout(resolve, 2500);
  });
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  setTimeout(() => frame.remove(), 60_000);
}

export async function shareHtmlAsPdf(html: string): Promise<void> {
  await printHtml(html);
}
