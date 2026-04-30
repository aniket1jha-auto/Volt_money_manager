import { useRef, useState, type DragEvent } from 'react';
import { Upload, FileText } from 'lucide-react';
import { cn } from '@/lib/cn';

interface FileDropzoneProps {
  accept?: string;
  maxSizeMb?: number;
  onFile: (file: File) => void;
  onError?: (msg: string) => void;
  /** Description shown beneath the icon, e.g. "CSV files only · max 5 MB" */
  hint?: string;
  className?: string;
}

export function FileDropzone({
  accept = '.csv',
  maxSizeMb = 5,
  onFile,
  onError,
  hint = 'CSV files only · max 5 MB',
  className,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function validate(file: File): boolean {
    const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
    if (!accept.split(',').map((s) => s.trim().toLowerCase()).includes(ext)) {
      onError?.(`Unsupported file type. Expected ${accept}.`);
      return false;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      onError?.(`File is too large. Max ${maxSizeMb} MB.`);
      return false;
    }
    return true;
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (validate(file)) onFile(file);
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }
  function onDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        'border-2 border-dashed rounded-xl px-6 py-10 text-center cursor-pointer transition-colors',
        'focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none',
        dragOver
          ? 'border-blue-500 bg-blue-50/40'
          : 'border-border-medium hover:border-blue-500/60 hover:bg-slate-25',
        className,
      )}
    >
      <div className="flex flex-col items-center gap-3">
        <div className={cn(
          'h-12 w-12 rounded-full flex items-center justify-center',
          dragOver ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-text-secondary',
        )}>
          {dragOver ? <FileText size={20} /> : <Upload size={20} />}
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">
            {dragOver ? 'Drop to upload' : 'Drop a CSV here, or click to browse'}
          </p>
          <p className="text-xs text-text-tertiary mt-1">{hint}</p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
