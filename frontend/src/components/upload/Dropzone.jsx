import { useRef, useState } from 'react';
import { UploadIcon } from '../ui/Icon.jsx';

const FORMATS = ['.xlsx', '.xlsm', '.xlsb', '.xls', '.ods', '.csv', '.tsv'];

export default function Dropzone({ onFileAccepted }) {
  const inputRef = useRef(null);
  const [dragover, setDragover] = useState(false);
  const [progress, setProgress] = useState(null); // { name, pct }

  function handleFile(file) {
    setProgress({ name: file.name, pct: 0 });
    let pct = 0;
    const id = setInterval(() => {
      pct += Math.random() * 14 + 5;
      if (pct >= 100) {
        pct = 100;
        clearInterval(id);
        setProgress({ name: file.name, pct: 100 });
        setTimeout(() => {
          setProgress(null);
          onFileAccepted?.(file);
        }, 500);
      } else {
        setProgress({ name: file.name, pct });
      }
    }, 110);
  }

  return (
    <>
      <div
        className={`flex cursor-pointer flex-col items-center border border-dashed p-8 text-center transition ${
          dragover ? 'border-accent-600 bg-accent-50' : 'border-slate-300 bg-[#fbfaf7] hover:border-accent-500 hover:bg-white'
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
        onDragLeave={() => setDragover(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragover(false);
          if (e.dataTransfer.files?.length) handleFile(e.dataTransfer.files[0]);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          hidden
          accept=".xlsx,.xlsm,.xlsb,.xls,.csv,.tsv,.ods,.fods"
          onChange={(e) => {
            if (e.target.files?.length) handleFile(e.target.files[0]);
            e.target.value = '';
          }}
        />
        <div className="flex h-11 w-11 items-center justify-center border border-slate-300 bg-white text-accent-700">
          <UploadIcon />
        </div>
        <div className="mt-3 text-sm text-slate-700">
          Drop your file here, or <strong className="text-accent-700">click to browse</strong>
        </div>
        <div className="mt-1 max-w-md text-xs text-slate-400">
          Excel (.xlsx .xlsm .xlsb .xls), OpenDocument (.ods .fods), CSV/TSV — up to 25 MB
        </div>
        <button
          type="button"
          className="mt-4 rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
        >
          Choose File
        </button>
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {FORMATS.map((f) => (
            <span key={f} className="border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-500">{f}</span>
          ))}
        </div>
      </div>

      {progress && (
        <div className="mt-4 border border-slate-300 bg-white p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="truncate font-medium text-slate-700">{progress.name}</span>
            <span className="tabular-nums text-slate-500">{Math.floor(progress.pct)}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden bg-slate-200">
            <div className="h-full bg-accent-600 transition-all" style={{ width: progress.pct + '%' }} />
          </div>
          <div className="mt-2 text-xs text-slate-500">Validating fields…</div>
        </div>
      )}
    </>
  );
}
