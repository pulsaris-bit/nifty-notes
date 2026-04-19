import { useEffect, useMemo, useRef, useState } from 'react';
import ReactQuill, { Quill } from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import QuillTableBetter from 'quill-table-better';
import 'quill-table-better/dist/quill-table-better.css';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';
import { API_URL, getToken, getDeviceId, HAS_API } from '@/lib/api';
import { toast } from 'sonner';

// Expose hljs globally so Quill's syntax module can find it.
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).hljs = hljs;
}

// Register the table module exactly once (HMR-safe).
let tableRegistered = false;
function ensureTableRegistered() {
  if (tableRegistered) return;
  Quill.register({ 'modules/table-better': QuillTableBetter }, true);
  tableRegistered = true;
}

interface QuillEditorProps {
  value: string;
  onChange: (html: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  /** When true, the Quill toolbar is hidden entirely (used in view mode). */
  hideToolbar?: boolean;
}

/**
 * WYSIWYG editor based on Quill 2.
 *
 * Stores its value as an HTML string. The "extended" toolbar mirrors the
 * Synology-style note editor: headings, inline formatting, color/background,
 * lists (incl. checkboxes), alignment, indent, links/images/video, code, and
 * tables (via quill-table-better).
 *
 * The toolbar auto-hides when the user scrolls the editor content and reappears
 * on click/focus inside the editable area.
 */
export function QuillEditor({ value, onChange, readOnly = false, placeholder, hideToolbar = false }: QuillEditorProps) {
  ensureTableRegistered();
  const ref = useRef<ReactQuill>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [toolbarHidden, setToolbarHidden] = useState(false);

  const imageHandler = useMemo(
    () => () => {
      const editor = ref.current?.getEditor();
      if (!editor) return;
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          let url: string;
          if (HAS_API && API_URL) {
            const fd = new FormData();
            fd.append('file', file);
            const headers: Record<string, string> = { 'X-Device-Id': getDeviceId() };
            const token = getToken();
            if (token) headers.Authorization = `Bearer ${token}`;
            const res = await fetch(`${API_URL}/uploads`, { method: 'POST', headers, body: fd });
            if (!res.ok) {
              const text = await res.text();
              throw new Error(text || `HTTP ${res.status}`);
            }
            const data = await res.json();
            url = data.url as string;
          } else {
            // Fallback (mock mode): inline as data URL so the image still works.
            url = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(file);
            });
          }
          const range = editor.getSelection(true);
          const index = range?.index ?? editor.getLength();
          editor.insertEmbed(index, 'image', url, 'user');
          editor.setSelection({ index: index + 1, length: 0 });
        } catch (e) {
          console.error('image upload failed', e);
          toast.error(e instanceof Error ? e.message : 'Afbeelding uploaden mislukt');
        }
      };
      input.click();
    },
    [],
  );

  const modules = useMemo(
    () => ({
      // The native table module must be disabled when using table-better.
      table: false,
      syntax: { hljs },
      toolbar: {
        container: [
          [{ header: [1, 2, 3, 4, 5, false] }, { font: [] }],
          [{ size: ['small', false, 'large', 'huge'] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ color: [] }, { background: [] }],
          [{ list: 'ordered' }, { list: 'bullet' }, { list: 'check' }],
          [{ indent: '-1' }, { indent: '+1' }, { align: [] }],
          ['blockquote', 'code-block'],
          ['link', 'image', 'video'],
          [{ script: 'sub' }, { script: 'super' }],
          ['table-better'],
          ['clean'],
        ],
        handlers: { image: imageHandler },
      },
      'table-better': {
        language: 'en_US',
        menus: ['column', 'row', 'merge', 'table', 'cell', 'wrap', 'copy', 'delete'],
        toolbarTable: true,
      },
      keyboard: {
        bindings: QuillTableBetter.keyboardBindings,
      },
      clipboard: { matchVisual: false },
    }),
    [imageHandler],
  );

  const formats = useMemo(
    () => [
      'header', 'font', 'size',
      'bold', 'italic', 'underline', 'strike',
      'color', 'background',
      'list',
      'indent', 'align',
      'blockquote', 'code-block', 'code-token',
      'link', 'image', 'video',
      'script',
      // table-better formats
      'table-better', 'table-cell-block', 'table-list', 'table-header',
    ],
    [],
  );

  useEffect(() => {
    const editor = ref.current?.getEditor();
    if (!editor) return;
    editor.enable(!readOnly);
  }, [readOnly]);

  // Strip HTML on paste: remove all tags and only keep the visible text.
  useEffect(() => {
    const editor = ref.current?.getEditor();
    if (!editor) return;
    const root: HTMLElement = editor.root;

    const htmlToPlainText = (html: string) => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const blockTags = new Set([
        'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DIV', 'DL', 'DT', 'DD',
        'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3',
        'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE',
        'SECTION', 'TABLE', 'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD', 'TR', 'UL',
      ]);
      const parts: string[] = [];

      const walk = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          parts.push(node.textContent ?? '');
          return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const el = node as HTMLElement;
        if (el.tagName === 'BR') {
          parts.push('\n');
          return;
        }
        if (el.tagName === 'LI') parts.push('• ');

        el.childNodes.forEach(walk);

        if (blockTags.has(el.tagName)) parts.push('\n');
      };

      doc.body.childNodes.forEach(walk);

      return parts
        .join('')
        .replace(/\u00A0/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trimEnd();
    };

    const onPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const html = e.clipboardData.getData('text/html');
      const plainText = e.clipboardData.getData('text/plain');
      const text = html ? htmlToPlainText(html) || plainText : plainText;
      if (!text) return;

      e.preventDefault();
      const range = editor.getSelection(true) ?? { index: editor.getLength(), length: 0 };
      if (range.length > 0) editor.deleteText(range.index, range.length, 'user');
      editor.insertText(range.index, text, 'user');
      editor.setSelection({ index: range.index + text.length, length: 0 });
    };

    root.addEventListener('paste', onPaste);
    return () => root.removeEventListener('paste', onPaste);
  }, []);

  // Hide the toolbar when the user scrolls inside the editor; show it again
  // on click / touch / focus inside the editable area.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const scrollEl = host.querySelector<HTMLElement>('.ql-container');
    const editorEl = host.querySelector<HTMLElement>('.ql-editor');
    if (!scrollEl || !editorEl) return;

    let lastScrollTop = scrollEl.scrollTop;

    const onScroll = () => {
      const top = scrollEl.scrollTop;
      const delta = top - lastScrollTop;
      // Only hide once we've scrolled a bit past the top, so the toolbar stays
      // visible at the very top of the note.
      if (top > 24 && Math.abs(delta) > 4) {
        setToolbarHidden(true);
      } else if (top <= 8) {
        setToolbarHidden(false);
      }
      lastScrollTop = top;
    };

    const reveal = () => setToolbarHidden(false);

    // iOS Safari may scroll the window/body to bring the focused contenteditable
    // into view, pushing the note's header out of the viewport. Force the page
    // back to the top whenever focus enters the editor.
    const resetPageScroll = () => {
      if (window.scrollY !== 0 || document.documentElement.scrollTop !== 0) {
        window.scrollTo(0, 0);
      }
      if (document.body.scrollTop !== 0) document.body.scrollTop = 0;
    };
    const onFocusIn = () => {
      reveal();
      requestAnimationFrame(resetPageScroll);
      setTimeout(resetPageScroll, 100);
      setTimeout(resetPageScroll, 300);
    };

    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    editorEl.addEventListener('pointerdown', reveal);
    editorEl.addEventListener('focusin', onFocusIn);

    return () => {
      scrollEl.removeEventListener('scroll', onScroll);
      editorEl.removeEventListener('pointerdown', reveal);
      editorEl.removeEventListener('focusin', onFocusIn);
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className={`quill-host flex-1 flex flex-col min-h-0 ${toolbarHidden || hideToolbar ? 'toolbar-hidden' : ''}`}
    >
      <ReactQuill
        ref={ref}
        theme="snow"
        value={value}
        onChange={(html) => onChange(html)}
        readOnly={readOnly}
        placeholder={placeholder}
        modules={modules}
        formats={formats}
      />
    </div>
  );
}
