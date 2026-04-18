import { useEffect, useMemo, useRef, useState } from 'react';
import ReactQuill, { Quill } from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import QuillTableBetter from 'quill-table-better';
import 'quill-table-better/dist/quill-table-better.css';

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

  const modules = useMemo(
    () => ({
      // The native table module must be disabled when using table-better.
      table: false,
      toolbar: [
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
    [],
  );

  const formats = useMemo(
    () => [
      'header', 'font', 'size',
      'bold', 'italic', 'underline', 'strike',
      'color', 'background',
      'list',
      'indent', 'align',
      'blockquote', 'code-block',
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

    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    editorEl.addEventListener('pointerdown', reveal);
    editorEl.addEventListener('focusin', reveal);

    return () => {
      scrollEl.removeEventListener('scroll', onScroll);
      editorEl.removeEventListener('pointerdown', reveal);
      editorEl.removeEventListener('focusin', reveal);
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
