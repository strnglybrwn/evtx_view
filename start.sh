#!/bin/bash

# EVTX Analyzer - Startup Script
# This script checks dependencies, installs them if needed, and manages the application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/.evtx-analyzer.pid"

# Functions
print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════${NC}"
    echo -e "${BLUE}  EVTX File Analyzer${NC}"
    echo -e "${BLUE}═══════════════════════════════════════${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check for required system dependencies
check_system_dependencies() {
    print_info "Checking system dependencies..."
    
    if ! command_exists node; then
        print_error "Node.js is not installed"
        echo "Please install Node.js from https://nodejs.org/"
        exit 1
    fi
    
    if ! command_exists npm; then
        print_error "npm is not installed"
        echo "Please install npm with Node.js"
        exit 1
    fi
    
    local node_version=$(node -v)
    local npm_version=$(npm -v)
    
    print_success "Node.js $node_version found"
    print_success "npm $npm_version found"
}

# Check and install dependencies
check_and_install_dependencies() {
    print_info "Checking project dependencies..."
    
    # Check root dependencies
    if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
        print_warning "Root dependencies not installed"
        print_info "Installing root dependencies..."
        cd "$SCRIPT_DIR"
        npm install --silent
        print_success "Root dependencies installed"
    else
        print_success "Root dependencies found"
    fi
    
    # Check client dependencies
    if [ ! -d "$SCRIPT_DIR/client/node_modules" ]; then
        print_warning "Client dependencies not installed"
        print_info "Installing client dependencies..."
        cd "$SCRIPT_DIR/client"
        npm install --silent
        print_success "Client dependencies installed"
    else
        print_success "Client dependencies found"
    fi
    
    # Check server dependencies
    if [ ! -d "$SCRIPT_DIR/server/node_modules" ]; then
        print_warning "Server dependencies not installed"
        print_info "Installing server dependencies..."
        cd "$SCRIPT_DIR/server"
        npm install --silent
        print_success "Server dependencies installed"
    else
        print_success "Server dependencies found"
    fi
    
    cd "$SCRIPT_DIR"
}

# Check if processes are running
is_running() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE" 2>/dev/null)
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

# Start the application
start_application() {
    if is_running; then
        print_warning "Application is already running (PID: $(cat $PID_FILE))"
        return
    fi
    
    print_info "Starting EVTX Analyzer..."
    cd "$SCRIPT_DIR"
    
    # Start the application in background
    npm run dev > "$SCRIPT_DIR/.evtx-analyzer.log" 2>&1 &
    local pid=$!
    echo $pid > "$PID_FILE"
    
    sleep 2
    
    if kill -0 "$pid" 2>/dev/null; then
        print_success "Application started successfully (PID: $pid)"
        echo ""
        print_info "Frontend available at: ${BLUE}http://localhost:3000${NC}"
        print_info "Backend available at: ${BLUE}http://localhost:5000${NC}"
        echo ""
        print_info "Logs: $SCRIPT_DIR/.evtx-analyzer.log"
    else
        print_error "Failed to start application"
        cat "$SCRIPT_DIR/.evtx-analyzer.log"
        rm -f "$PID_FILE"
        return 1
    fi
}

# Stop the application
stop_application() {
    if ! is_running; then
        print_warning "Application is not running"
        return
    fi
    
    local pid=$(cat "$PID_FILE")
    print_info "Stopping application (PID: $pid)..."
    
    # Kill the process and all children
    pkill -P $pid 2>/dev/null || true
    kill $pid 2>/dev/null || true
    
    # Wait for process to terminate
    local count=0
    while kill -0 "$pid" 2>/dev/null && [ $count -lt 10 ]; do
        sleep 0.5
        count=$((count + 1))
    done
    
    # Force kill if still running
    if kill -0 "$pid" 2>/dev/null; then
        kill -9 $pid 2>/dev/null || true
    fi
    
    rm -f "$PID_FILE"
    print_success "Application stopped"
}

# Restart the application
restart_application() {
    print_info "Restarting application..."
    stop_application
    sleep 1
    start_application
}

# Show status
show_status() {
    echo ""
    if is_running; then
        local pid=$(cat "$PID_FILE")
        print_success "Application is running (PID: $pid)"
    else
        print_warning "Application is not running"
    fi
    echo ""
}

# Show menu
show_menu() {
    echo ""
    echo -e "${YELLOW}What would you like to do?${NC}"
    echo "  1) Start"
    echo "  2) Stop"
    echo "  3) Restart"
    echo "  4) Status"
    echo "  5) View logs"
    echo "  6) Exit"
    echo ""
}

# View logs
view_logs() {
    if [ -f "$SCRIPT_DIR/.evtx-analyzer.log" ]; then
        echo ""
        print_info "Showing last 50 lines of logs (Ctrl+C to exit):"
        echo ""
        tail -f "$SCRIPT_DIR/.evtx-analyzer.log"
    else
        print_warning "No logs available yet"
    fi
}

# Main execution
main() {
    print_header
    
    # Check system dependencies
    check_system_dependencies
    echo ""
    
    # Check and install project dependencies
    check_and_install_dependencies
    echo ""
    
    # Show initial status
    show_status
    
    # Interactive menu
    while true; do
        show_menu
        read -p "Enter your choice [1-6]: " choice
        
        case $choice in
            1)
                start_application
                ;;
            2)
                stop_application
                ;;
            3)
                restart_application
                ;;
            4)
                show_status
                ;;
            5)
                view_logs
                ;;
            6)
                print_info "Exiting..."
                exit 0
                ;;
            *)
                print_error "Invalid choice. Please enter 1-6."
                ;;
        esac
    done
}

# Run main function
main
