#!/bin/bash

# AAI startup/shutdown script
# Usage: ./startup.sh [start|stop|restart]

set -e

PROJECT_NAME="AAI"
PID_FILE=".aai.pid"
PORT=3000

function start() {
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
      echo "✓ $PROJECT_NAME server is already running (PID: $PID)"
      echo "  Open http://localhost:$PORT in your browser"
      return
    fi
  fi

  echo "📦 Installing dependencies..."
  npm install

  echo "🚀 Starting $PROJECT_NAME server..."
  npm run dev > server.log 2>&1 &
  NEW_PID=$!
  echo $NEW_PID > "$PID_FILE"
  
  echo "✓ Server started (PID: $NEW_PID)"
  echo "  Open http://localhost:$PORT in your browser"
  echo "  Logs: tail -f server.log"
}

function stop() {
  if [ ! -f "$PID_FILE" ]; then
    echo "✗ No PID file found. Server may not be running."
    return 1
  fi

  PID=$(cat "$PID_FILE")
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "✗ Process (PID: $PID) is not running. Cleaning up..."
    rm -f "$PID_FILE"
    return 1
  fi

  echo "🛑 Stopping $PROJECT_NAME server (PID: $PID)..."
  kill "$PID"
  sleep 1
  
  if kill -0 "$PID" 2>/dev/null; then
    echo "   Force killing..."
    kill -9 "$PID"
  fi

  rm -f "$PID_FILE"
  echo "✓ Server stopped"
}

function status() {
  if [ ! -f "$PID_FILE" ]; then
    echo "Server is not running (no PID file)"
    return 1
  fi

  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    echo "✓ Server is running (PID: $PID, Port: $PORT)"
    return 0
  else
    echo "✗ Server is not running (stale PID: $PID)"
    rm -f "$PID_FILE"
    return 1
  fi
}

# Parse command
COMMAND="${1:-start}"

case "$COMMAND" in
  start)
    start
    ;;
  stop)
    stop
    ;;
  restart)
    stop || true
    sleep 1
    start
    ;;
  status)
    status
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status}"
    echo ""
    echo "Commands:"
    echo "  start    - Install deps and start the server"
    echo "  stop     - Stop the running server"
    echo "  restart  - Stop and restart the server"
    echo "  status   - Check if server is running"
    exit 1
    ;;
esac
