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
const PORT = process.env.PORT || 5000

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
async function parseEvtxFile(filePath: string) {
  const records: any[] = []
  const stats = {
    totalEvents: 0,
    eventLevels: { Critical: 0, Error: 0, Warning: 0, Information: 0, Verbose: 0 },
    eventSources: new Map<string, number>(),
    eventIds: new Map<string, number>(),
    timeRange: { earliest: null as string | null, latest: null as string | null },
  }

  try {
    const parser = new EvtxParser(fs.readFileSync(filePath))

    for (const event of parser) {
      stats.totalEvents++

      // Extract event level
      const eventLevel = event.System?.Level || 'Unknown'
      const levelMap: Record<number, string> = {
        0: 'Verbose',
        1: 'Verbose',
        2: 'Information',
        3: 'Warning',
        4: 'Error',
        5: 'Critical',
      }
      const levelName = levelMap[eventLevel] || 'Unknown'
      if (levelName in stats.eventLevels) {
        stats.eventLevels[levelName as keyof typeof stats.eventLevels]++
      }

      // Track event source
      const provider = event.System?.Provider?.Name || 'Unknown'
      stats.eventSources.set(provider, (stats.eventSources.get(provider) || 0) + 1)

      // Track event ID
      const eventId = event.System?.EventID || 'Unknown'
      stats.eventIds.set(String(eventId), (stats.eventIds.get(String(eventId)) || 0) + 1)

      // Track time range
      const timestamp = event.System?.TimeCreated?.SystemTime || null
      if (timestamp) {
        if (!stats.timeRange.earliest || timestamp < stats.timeRange.earliest) {
          stats.timeRange.earliest = timestamp
        }
        if (!stats.timeRange.latest || timestamp > stats.timeRange.latest) {
          stats.timeRange.latest = timestamp
        }
      }

      // Keep first 100 events for display
      if (records.length < 100) {
        records.push({
          timeCreated: event.System?.TimeCreated?.SystemTime || 'N/A',
          eventId: event.System?.EventID || 'N/A',
          level: levelName,
          provider: provider,
          computer: event.System?.Computer || 'N/A',
          message: event.Event?.EventData?.Message || event.Event?.EventData?.Data || 'N/A',
        })
      }
    }

    // Convert Maps to objects for JSON serialization
    return {
      success: true,
      stats: {
        ...stats,
        eventSources: Object.fromEntries(stats.eventSources),
        eventIds: Object.fromEntries(stats.eventIds),
      },
      sampleEvents: records,
    }
  } catch (error) {
    throw new Error(`Failed to parse EVTX file: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
