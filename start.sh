#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Log directory
LOG_DIR="logs"
mkdir -p $LOG_DIR

# Timestamp for log files
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Log files
BACKEND_LOG="$LOG_DIR/backend_${TIMESTAMP}.log"
FRONTEND_LOG="$LOG_DIR/frontend_${TIMESTAMP}.log"

# PID files to track running processes
BACKEND_PID_FILE="$LOG_DIR/backend.pid"
FRONTEND_PID_FILE="$LOG_DIR/frontend.pid"

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down services...${NC}"

    # Kill backend if running
    if [ -f "$BACKEND_PID_FILE" ]; then
        BACKEND_PID=$(cat "$BACKEND_PID_FILE")
        if ps -p $BACKEND_PID > /dev/null 2>&1; then
            echo -e "${YELLOW}Stopping backend (PID: $BACKEND_PID)...${NC}"
            kill $BACKEND_PID
        fi
        rm -f "$BACKEND_PID_FILE"
    fi

    # Kill frontend if running
    if [ -f "$FRONTEND_PID_FILE" ]; then
        FRONTEND_PID=$(cat "$FRONTEND_PID_FILE")
        if ps -p $FRONTEND_PID > /dev/null 2>&1; then
            echo -e "${YELLOW}Stopping frontend (PID: $FRONTEND_PID)...${NC}"
            kill $FRONTEND_PID
        fi
        rm -f "$FRONTEND_PID_FILE"
    fi

    echo -e "${GREEN}All services stopped${NC}"
    exit 0
}

# Trap SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

echo "========================================="
echo "Valtool Start Script"
echo "========================================="
echo ""

# Check if setup has been run
if [ ! -d "be/venv" ]; then
    echo -e "${RED}Error: Virtual environment not found. Please run ./setup.sh first.${NC}"
    exit 1
fi

if [ ! -d "fe/node_modules" ]; then
    echo -e "${RED}Error: Node modules not found. Please run ./setup.sh first.${NC}"
    exit 1
fi

# Start Backend
echo "========================================="
echo "Starting Backend..."
echo "========================================="

cd be

# Activate virtual environment and start backend
echo -e "${YELLOW}Starting FastAPI backend on http://localhost:8000${NC}"
source venv/bin/activate
nohup uvicorn main:app --host 0.0.0.0 --port 8000 --reload > "../$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > "../$BACKEND_PID_FILE"
deactivate

cd ..

# Wait for backend to start
echo -e "${YELLOW}Waiting for backend to start...${NC}"
sleep 3

# Check if backend is running
if ps -p $BACKEND_PID > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend started successfully (PID: $BACKEND_PID)${NC}"
    echo -e "${BLUE}  API: http://localhost:8000${NC}"
    echo -e "${BLUE}  Docs: http://localhost:8000/docs${NC}"
    echo -e "${BLUE}  Log: $BACKEND_LOG${NC}"
else
    echo -e "${RED}✗ Backend failed to start. Check logs at: $BACKEND_LOG${NC}"
    exit 1
fi
echo ""

# Start Frontend
echo "========================================="
echo "Starting Frontend..."
echo "========================================="

cd fe

# Start frontend
echo -e "${YELLOW}Starting Next.js frontend on http://localhost:3000${NC}"
nohup npm run dev > "../$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > "../$FRONTEND_PID_FILE"

cd ..

# Wait for frontend to start
echo -e "${YELLOW}Waiting for frontend to start...${NC}"
sleep 5

# Check if frontend is running
if ps -p $FRONTEND_PID > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend started successfully (PID: $FRONTEND_PID)${NC}"
    echo -e "${BLUE}  App: http://localhost:3000${NC}"
    echo -e "${BLUE}  Log: $FRONTEND_LOG${NC}"
else
    echo -e "${RED}✗ Frontend failed to start. Check logs at: $FRONTEND_LOG${NC}"
    cleanup
    exit 1
fi
echo ""

# Database info
echo "========================================="
echo "Database"
echo "========================================="
if [ -f "be/valtool.db" ]; then
    DB_SIZE=$(du -h be/valtool.db | cut -f1)
    echo -e "${GREEN}✓ SQLite database running${NC}"
    echo -e "${BLUE}  Location: be/valtool.db${NC}"
    echo -e "${BLUE}  Size: $DB_SIZE${NC}"
else
    echo -e "${YELLOW}⚠ Database file not found. It will be created on first API call.${NC}"
fi
echo ""

# Summary
echo "========================================="
echo -e "${GREEN}All Services Running!${NC}"
echo "========================================="
echo ""
echo "Services:"
echo -e "  ${GREEN}✓${NC} Backend:  http://localhost:8000"
echo -e "  ${GREEN}✓${NC} Frontend: http://localhost:3000"
echo -e "  ${GREEN}✓${NC} API Docs: http://localhost:8000/docs"
echo ""
echo "Logs:"
echo -e "  Backend:  tail -f $BACKEND_LOG"
echo -e "  Frontend: tail -f $FRONTEND_LOG"
echo ""
echo "Press Ctrl+C to stop all services"
echo "========================================="
echo ""

# Show live logs
echo -e "${YELLOW}Showing live logs (Ctrl+C to stop all services)...${NC}"
echo ""

# Tail both log files
tail -f "$BACKEND_LOG" "$FRONTEND_LOG"
