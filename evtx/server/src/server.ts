import express, { Request, Response } from 'express'
import multer from 'multer'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

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

// Routes
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'EVTX Analyzer server is running' })
})

app.post('/api/analyze', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' })
      return
    }

    const filePath = req.file.path
    const fileStats = fs.statSync(filePath)

    // TODO: Implement actual EVTX parsing logic here
    // For now, return basic file information
    const analysisResult = {
      fileName: req.file.originalname,
      fileSize: fileStats.size,
      uploadedAt: new Date(),
      status: 'pending',
      message: 'File uploaded successfully. Parsing logic to be implemented.',
    }

    // Clean up the uploaded file for now
    fs.unlinkSync(filePath)

    res.json(analysisResult)
  } catch (error) {
    console.error('Error analyzing file:', error)
    res.status(500).json({
      error: 'Failed to analyze file',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
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
