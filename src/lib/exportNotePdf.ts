import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import DOMPurify from 'dompurify';
import { Note, Notebook } from '@/types/notes';

/**
 * Render the given note (title + HTML content) to a PDF and trigger a download.
 * Uses html2canvas to rasterize a hidden HTML container styled like a printable
 * document, then paginates the resulting image into A4 pages with jsPDF.
 */
export async function exportNoteAsPdf(
  note: Note,
  notebook: Notebook | undefined,
  contentHtml: string,
): Promise<void> {
  // Build an off-screen container with print-friendly styling.
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '794px'; // ~A4 width @ 96dpi
  container.style.padding = '48px';
  container.style.background = '#ffffff';
  container.style.color = '#111111';
  container.style.fontFamily =
    "'Roboto', 'Helvetica Neue', Arial, sans-serif";
  container.style.fontSize = '14px';
  container.style.lineHeight = '1.55';
  container.style.boxSizing = 'border-box';

  const safeTitle = (note.title || 'Notitie').replace(/[<>&]/g, (c) =>
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;',
  );
  const meta: string[] = [];
  if (notebook) meta.push(`${notebook.icon ?? ''} ${notebook.name}`.trim());
  meta.push(`Bewerkt ${note.updatedAt.toLocaleString('nl-NL')}`);

  // Sanitize the user-controlled HTML before injecting it. Without this, a note
  // containing <script> or <img onerror=...> would execute in the page context.
  const cleanContent = DOMPurify.sanitize(contentHtml || '<p><em>Lege notitie</em></p>', {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'style'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus'],
  });

  container.innerHTML = `
    <h1 style="font-size:26px;margin:0 0 8px 0;font-weight:600;color:#111;">${safeTitle}</h1>
    <p style="margin:0 0 24px 0;color:#666;font-size:12px;">${meta.join(' · ')}</p>
    <hr style="border:none;border-top:1px solid #e5e5e5;margin:0 0 20px 0;" />
    <div class="np-body">${cleanContent}</div>
  `;

  // Apply minimal print styles to common elements
  const style = document.createElement('style');
  style.textContent = `
    .np-body p { margin: 0 0 10px 0; }
    .np-body h1 { font-size: 22px; margin: 18px 0 8px; }
    .np-body h2 { font-size: 18px; margin: 16px 0 6px; }
    .np-body h3 { font-size: 16px; margin: 14px 0 6px; }
    .np-body ul, .np-body ol { padding-left: 22px; margin: 0 0 10px; }
    .np-body li { margin: 2px 0; }
    .np-body blockquote { border-left: 3px solid #d4d4d4; padding-left: 10px; color: #555; margin: 0 0 10px; }
    .np-body code { background: #f4f4f4; padding: 1px 4px; border-radius: 3px; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12.5px; }
    .np-body pre { background: #f4f4f4; padding: 10px; border-radius: 4px; overflow: auto; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12.5px; white-space: pre-wrap; word-break: break-word; }
    .np-body a { color: #0a66c2; text-decoration: underline; }
    .np-body img { max-width: 100%; height: auto; }
    .np-body table { border-collapse: collapse; width: 100%; margin: 0 0 10px; }
    .np-body th, .np-body td { border: 1px solid #d4d4d4; padding: 6px 8px; text-align: left; vertical-align: top; }
  `;
  container.prepend(style);

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    });

    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const imgData = canvas.toDataURL('image/jpeg', 0.92);

    if (imgHeight <= pageHeight) {
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
    } else {
      // Paginate: place the same image at a negative Y offset on each new page.
      let remaining = imgHeight;
      let position = 0;
      while (remaining > 0) {
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        remaining -= pageHeight;
        if (remaining > 0) {
          pdf.addPage();
          position -= pageHeight;
        }
      }
    }

    const safeName =
      (note.title || 'notitie').replace(/[^\p{L}\p{N}\-_ ]+/gu, '').trim().slice(0, 60) ||
      'notitie';
    pdf.save(`${safeName}.pdf`);
  } finally {
    container.remove();
  }
}
