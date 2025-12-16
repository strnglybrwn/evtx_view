
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
            <h2>📊 Analysis Results</h2>
            
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Total Events</h3>
                <p className="stat-value">{analysisResult.stats?.totalEvents || 0}</p>
              </div>
              <div className="stat-card">
                <h3>Critical</h3>
                <p className="stat-value critical">{analysisResult.stats?.eventLevels?.Critical || 0}</p>
              </div>
              <div className="stat-card">
                <h3>Errors</h3>
                <p className="stat-value error">{analysisResult.stats?.eventLevels?.Error || 0}</p>
              </div>
              <div className="stat-card">
                <h3>Warnings</h3>
                <p className="stat-value warning">{analysisResult.stats?.eventLevels?.Warning || 0}</p>
              </div>
            </div>

            {analysisResult.stats?.timeRange && (
              <div className="time-range">
                <p><strong>Time Range:</strong> {analysisResult.stats.timeRange.earliest} to {analysisResult.stats.timeRange.latest}</p>
              </div>
            )}

            {analysisResult.stats?.eventSources && Object.keys(analysisResult.stats.eventSources).length > 0 && (
              <div className="data-section">
                <h3>Event Sources (Top Providers)</h3>
                <ul className="source-list">
                  {Object.entries(analysisResult.stats.eventSources)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .slice(0, 10)
                    .map(([source, count]) => (
                      <li key={source}>
                        <span className="source-name">{source}</span>
                        <span className="source-count">{count as number} events</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {analysisResult.sampleEvents && analysisResult.sampleEvents.length > 0 && (
              <div className="data-section">
                <h3>Sample Events (First 100)</h3>
                <div className="events-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Time Created</th>
                        <th>Event ID</th>
                        <th>Level</th>
                        <th>Provider</th>
                        <th>Computer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysisResult.sampleEvents.map((event: any, idx: number) => (
                        <tr key={idx} className={`level-${event.level?.toLowerCase()}`}>
                          <td className="time">{event.timeCreated}</td>
                          <td className="event-id">{event.eventId}</td>
                          <td className={`level ${event.level?.toLowerCase()}`}>{event.level}</td>
                          <td className="provider">{event.provider}</td>
                          <td className="computer">{event.computer}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
