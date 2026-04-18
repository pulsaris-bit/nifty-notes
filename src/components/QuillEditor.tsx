import { useEffect, useMemo, useRef } from 'react';
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
}

/**
 * WYSIWYG editor based on Quill 2.
 *
 * Stores its value as an HTML string. The "extended" toolbar mirrors the
 * Synology-style note editor: headings, inline formatting, color/background,
 * lists (incl. checkboxes), alignment, indent, links/images/video, code, and
 * tables (via quill-table-better).
 */
export function QuillEditor({ value, onChange, readOnly = false, placeholder }: QuillEditorProps) {
  ensureTableRegistered();
  const ref = useRef<ReactQuill>(null);

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

  // NOTE: 'table-better' is a module, not a format — listing it in `formats`
  // triggers a Quill warning. We only register the standard formats here.
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
    ],
    [],
  );

  useEffect(() => {
    const editor = ref.current?.getEditor();
    if (!editor) return;
    editor.enable(!readOnly);
  }, [readOnly]);

  // Install a custom Shift+Enter binding AFTER mount. We add it to the front
  // of the binding list for the Enter key so it runs before Quill's default
  // Enter handler (which would otherwise create a new <p> regardless of
  // the shift modifier).
  useEffect(() => {
    const editor = ref.current?.getEditor();
    if (!editor) return;
    const keyboard: any = editor.getModule('keyboard');
    if (!keyboard) return;

    const handler = function (this: { quill: any }, range: { index: number }) {
      const quill = this.quill;
      quill.insertEmbed(range.index, 'break', true, 'user');
      quill.setSelection(range.index + 1, 0, 'silent');
      // Returning false stops Quill from running its default Enter handler.
      return false;
    };

    // Quill 2 stores bindings in keyboard.bindings keyed by KeyboardEvent.key
    // (e.g. "Enter"). Unshift so our binding wins.
    const bindings = keyboard.bindings;
    const enterBindings = bindings['Enter'] || bindings[13] || [];
    const shiftEnter = {
      key: 'Enter',
      shiftKey: true,
      handler,
    };
    if (Array.isArray(enterBindings)) {
      enterBindings.unshift(shiftEnter);
      bindings['Enter'] = enterBindings;
    } else {
      bindings['Enter'] = [shiftEnter];
    }
  }, []);

  return (
    <div className="quill-host flex-1 flex flex-col min-h-0">
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
