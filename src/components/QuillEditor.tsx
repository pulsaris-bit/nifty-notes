import { useEffect, useMemo, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

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
 * lists (incl. checkboxes), alignment, indent, links/images/video, code, etc.
 */
export function QuillEditor({ value, onChange, readOnly = false, placeholder }: QuillEditorProps) {
  const ref = useRef<ReactQuill>(null);

  const modules = useMemo(
    () => ({
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
        ['clean'],
      ],
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
    ],
    [],
  );

  // Re-sync on note swap so the editor doesn't keep the previous note's content
  // selected when readOnly toggles.
  useEffect(() => {
    const editor = ref.current?.getEditor();
    if (!editor) return;
    editor.enable(!readOnly);
  }, [readOnly]);

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
