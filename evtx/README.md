# EVTX File Analyzer

A modern web application for uploading and analyzing Windows Event Log (.evtx) files.

## Features

- 🎨 Clean, modern web UI built with React
- 📁 Drag-and-drop file upload support
- 🔍 Real-time file selection and validation
- 🚀 RESTful API backend with Express.js
- 📊 File analysis capabilities

## Project Structure

```
evtx/
├── client/              # React frontend application
│   ├── src/
│   │   ├── components/  # Reusable React components
│   │   ├── App.tsx      # Main application component
│   │   └── main.tsx     # Application entry point
│   ├── vite.config.ts   # Vite configuration
│   └── package.json
├── server/              # Express.js backend application
│   ├── src/
│   │   └── server.ts    # Express server setup
│   ├── tsconfig.json
│   └── package.json
├── package.json         # Root package.json with dev scripts
└── README.md            # This file
```

## Prerequisites

- Node.js 18+ and npm

## Installation

1. Install dependencies for both client and server:

```bash
npm install
cd client && npm install
cd ../server && npm install
cd ..
```

## Development

Start both the development server and client in parallel:

```bash
npm run dev
```

This will start:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000

## Individual Commands

### Frontend Only
```bash
npm run dev:client
```

### Backend Only
```bash
npm run dev:server
```

## Building

Build both client and server:

```bash
npm run build
```

## Production

To run the application in production mode:

```bash
npm start
```

## API Endpoints

### Health Check
```
GET /api/health
```

### Analyze EVTX File
```
POST /api/analyze
Content-Type: multipart/form-data

File: <.evtx file>
```

## Technologies

### Frontend
- React 18
- TypeScript
- Vite
- CSS3

### Backend
- Node.js
- Express.js
- TypeScript
- Multer (file upload handling)

## Notes

- Currently, the backend accepts .evtx file uploads and returns basic file information
- The actual EVTX parsing logic is a placeholder and ready for implementation
- Uploaded files are cleaned up after analysis

## Future Enhancements

- [ ] Implement actual EVTX file parsing
- [ ] Display parsed event log data
- [ ] Add filtering and search capabilities
- [ ] Export analysis results
- [ ] Add database for storing analysis history
