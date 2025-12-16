
import { useState } from 'react'
import './App.css'
import FileUpload from './components/FileUpload'

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
    setError(null)
    setAnalysisResult(null)
  }

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setError('Please select a file first')
      return
    }

    setIsAnalyzing(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`)
      }

      const data = await response.json()
      setAnalysisResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze file')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>EVTX File Analyzer</h1>
        <p className="subtitle">Upload and analyze Windows Event Log files</p>
      </header>

      <main className="main-content">
        <div className="upload-section">
          <FileUpload onFileSelect={handleFileSelect} />
          
          {selectedFile && (
            <div className="file-info">
              <p className="file-name">📄 {selectedFile.name}</p>
              <p className="file-size">({(selectedFile.size / 1024).toFixed(2)} KB)</p>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <button
            className="analyze-button"
            onClick={handleAnalyze}
            disabled={!selectedFile || isAnalyzing}
          >
            {isAnalyzing ? 'Analyzing...' : 'Analyze File'}
          </button>
        </div>

        {analysisResult && (
          <div className="results-section">
            <h2>Analysis Results</h2>
            <pre className="results-content">
              {JSON.stringify(analysisResult, null, 2)}
            </pre>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
