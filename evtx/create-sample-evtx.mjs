import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadsDir = path.join(__dirname, 'uploads')

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Create a minimal but valid EVTX file
// EVTX header structure
const createSampleEvtxFile = () => {
  const buffer = Buffer.alloc(4096)
  
  // EVTX header signature: "ElfFile\0"
  buffer.write('ElfFile\0', 0, 'ascii')
  
  // First chunk number (offset 8, 8 bytes)
  buffer.writeBigInt64LE(0n, 8)
  
  // Last chunk number (offset 16, 8 bytes)
  buffer.writeBigInt64LE(0n, 16)
  
  // Next record number (offset 24, 8 bytes)
  buffer.writeBigInt64LE(1n, 24)
  
  // Header size (offset 32, 4 bytes) - typically 4096
  buffer.writeUInt32LE(4096, 32)
  
  // Version (offset 36, 4 bytes) - version 3
  buffer.writeUInt32LE(3, 36)
  
  // Number of chunks (offset 40, 4 bytes)
  buffer.writeUInt32LE(1, 40)
  
  // Unknown/reserved fields
  buffer.writeUInt32LE(0, 44) // Flags
  buffer.writeUInt32LE(0, 48) // Checksum or reserved
  
  // Create the chunk header at offset 4096 (after main header)
  const chunkHeader = Buffer.alloc(512)
  
  // Chunk signature: "ElfChnk\0"
  chunkHeader.write('ElfChnk\0', 0, 'ascii')
  
  // First event record number (offset 8, 8 bytes)
  chunkHeader.writeBigInt64LE(0n, 8)
  
  // Last event record number (offset 16, 8 bytes)
  chunkHeader.writeBigInt64LE(0n, 16)
  
  // First event record offset (offset 24, 4 bytes)
  chunkHeader.writeUInt32LE(512, 24)
  
  // Last event record offset (offset 28, 4 bytes)
  chunkHeader.writeUInt32LE(512, 28)
  
  // Next record offset (offset 32, 4 bytes)
  chunkHeader.writeUInt32LE(512, 32)
  
  // Data checksum (offset 36, 4 bytes)
  chunkHeader.writeUInt32LE(0, 36)
  
  // Chunk number (offset 40, 4 bytes)
  chunkHeader.writeUInt32LE(0, 40)
  
  // Combine headers
  const evtxFile = Buffer.concat([buffer, chunkHeader])
  
  // Write to file
  const samplePath = path.join(uploadsDir, 'sample.evtx')
  fs.writeFileSync(samplePath, evtxFile)
  
  console.log(`✓ Sample EVTX file created: ${samplePath}`)
  console.log(`  File size: ${evtxFile.length} bytes`)
}

createSampleEvtxFile()
