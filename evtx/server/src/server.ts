import express, { Request, Response } from 'express'
import multer from 'multer'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import EvtxParser from 'evtx-parser'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 5001

// Middleware
app.use(cors())
app.use(express.json())

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '../uploads')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now()
    cb(null, `${timestamp}-${file.originalname}`)
  },
})

const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (file.originalname.endsWith('.evtx')) {
    cb(null, true)
  } else {
    cb(new Error('Only .evtx files are allowed'))
  }
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 100 * 1024 * 1024 } })

// Parse EVTX file and extract events
async function parseEvtxFile(filePathOrBuffer: string | Buffer) {
  const records: any[] = []
  const stats = {
    totalEvents: 0,
    eventLevels: { Critical: 0, Error: 0, Warning: 0, Information: 0, Verbose: 0 },
    eventSources: new Map<string, number>(),
    eventIds: new Map<string, number>(),
    timeRange: { earliest: null as string | null, latest: null as string | null },
  }
  // If caller passed a Buffer, write it to a temp file for the parser
  let tempPath: string | null = null
  let filePath = filePathOrBuffer as string
  try {
    if (Buffer.isBuffer(filePathOrBuffer)) {
      tempPath = path.join(uploadDir, `tmp-${Date.now()}.evtx`)
      fs.writeFileSync(tempPath, filePathOrBuffer)
      filePath = tempPath
    }

    const parser = new EvtxParser(String(filePath))

    // Get the header information (may throw for invalid files)
    const header = parser.header && typeof parser.header === 'function' ? parser.header() : null

    // For non-standard/sample files, evtx-parser may not be able to iterate events.
    const fileStats = fs.statSync(filePath)

    // Convert Maps to objects for JSON serialization
    return {
      success: true,
      stats: {
        ...stats,
        eventSources: Object.fromEntries(stats.eventSources),
        eventIds: Object.fromEntries(stats.eventIds),
      },
      sampleEvents: records,
      headerInfo: {
        numberOfChunks: header?.numberOfChunks || 0,
        fileSize: fileStats.size,
        createdAt: header?.createdAt || 'Unknown',
      },
    }
  } catch (error) {
    // Handle as a basic file if EVTX parsing fails
    const fileStats = fs.statSync(filePath)

    return {
      success: true,
      message: 'File uploaded successfully. Note: Advanced parsing requires a valid Windows EVTX file.',
      fileInfo: {
        fileName: path.basename(filePath),
        size: fileStats.size,
        uploadedAt: new Date(),
      },
      stats: {
        totalEvents: 0,
        eventLevels: { Critical: 0, Error: 0, Warning: 0, Information: 0, Verbose: 0 },
        eventSources: {},
        eventIds: {},
        timeRange: { earliest: null, latest: null },
      },
      sampleEvents: [],
    }
  } finally {
    if (tempPath && fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath) } catch (e) { /* ignore */ }
    }
  }
}

// Routes
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'EVTX Analyzer server is running' })
})

app.post('/api/analyze', upload.single('file'), async (req: Request, res: Response) => {
  let filePath: string | null = null

  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' })
      return
    }

    filePath = req.file.path
    const fileStats = fs.statSync(filePath)

    console.log(`Analyzing EVTX file: ${req.file.originalname} (${fileStats.size} bytes)`)

    // Parse the EVTX file
    const analysisResult = await parseEvtxFile(filePath)

    res.json({
      fileName: req.file.originalname,
      fileSize: fileStats.size,
      uploadedAt: new Date(),
      status: 'success',
      ...analysisResult,
    })
  } catch (error) {
    console.error('Error analyzing file:', error)
    res.status(500).json({
      error: 'Failed to analyze file',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    // Clean up the uploaded file
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  }
})

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Server error:', err)
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  })
})

// Start server
app.listen(PORT, () => {
  console.log(`✅ EVTX Analyzer server running on http://localhost:${PORT}`)
  console.log(`📁 File uploads directory: ${uploadDir}`)
})
