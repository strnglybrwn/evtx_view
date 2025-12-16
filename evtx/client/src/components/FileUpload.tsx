import React, { useRef, useState } from 'react'
import './FileUpload.css'

interface FileUploadProps {
  onFileSelect: (file: File) => void
}

export default function FileUpload({ onFileSelect }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      if (file.name.endsWith('.evtx')) {
        onFileSelect(file)
      } else {
        alert('Please select a valid .evtx file')
      }
    }
  }

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      if (file.name.endsWith('.evtx')) {
        onFileSelect(file)
      } else {
        alert('Please drag and drop a valid .evtx file')
      }
    }
  }

  return (
    <div
      className={`file-upload ${dragActive ? 'drag-active' : ''}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".evtx"
        onChange={handleChange}
        className="file-input"
      />
      <div className="upload-content">
        <div className="upload-icon">📁</div>
        <h3>Select or Drag & Drop EVTX File</h3>
        <p>Drag your .evtx file here or click to browse</p>
        <button type="button" className="browse-button">
          Browse Files
        </button>
      </div>
    </div>
  )
}
