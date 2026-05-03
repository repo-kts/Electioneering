import { useRef, useState } from 'react';
import { UploadIcon } from '../ui/Icon.jsx';

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
        className={`dropzone ${dragover ? 'dragover' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragover(true);
        }}
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
          accept=".xlsx,.xls,.csv"
          onChange={(e) => {
            if (e.target.files?.length) handleFile(e.target.files[0]);
            e.target.value = '';
          }}
        />
        <div className="drop-icon-wrap">
          <UploadIcon />
        </div>
        <div className="drop-title">
          Drop your file here, or <strong>click to browse</strong>
        </div>
        <div className="drop-sub">
          Supports Excel (.xlsx, .xls) and CSV files up to 25 MB
        </div>
        <button
          type="button"
          className="drop-btn"
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
        >
          Choose File
        </button>
        <div className="drop-formats">
          <span>Excel (.xlsx)</span>
          <span>Excel (.xls)</span>
          <span>CSV</span>
        </div>
      </div>

      {progress && (
        <div className="upload-progress">
          <div className="upload-progress-row">
            <span className="upload-progress-name">{progress.name}</span>
            <span className="upload-progress-pct">{Math.floor(progress.pct)}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: progress.pct + '%' }} />
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-2)' }}>
            Validating fields…
          </div>
        </div>
      )}
    </>
  );
}
