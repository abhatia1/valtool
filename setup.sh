#!/bin/bash

set -e  # Exit on error

echo "========================================="
echo "Valtool Setup Script"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Python 3 is installed
echo -e "${YELLOW}Checking Python installation...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: Python 3 is not installed. Please install Python 3.8 or higher.${NC}"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
echo -e "${GREEN}Python ${PYTHON_VERSION} found${NC}"
echo ""

# Check if Node.js is installed
echo -e "${YELLOW}Checking Node.js installation...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed. Please install Node.js 18 or higher.${NC}"
    exit 1
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}Node.js ${NODE_VERSION} found${NC}"
echo ""

# Setup Backend
echo "========================================="
echo "Setting up Backend..."
echo "========================================="
cd be

# Create virtual environment
echo -e "${YELLOW}Creating Python virtual environment...${NC}"
if [ -d "venv" ]; then
    echo -e "${YELLOW}Virtual environment already exists. Removing...${NC}"
    rm -rf venv
fi

python3 -m venv venv
echo -e "${GREEN}Virtual environment created${NC}"

# Activate virtual environment
echo -e "${YELLOW}Activating virtual environment...${NC}"
source venv/bin/activate

# Upgrade pip
echo -e "${YELLOW}Upgrading pip...${NC}"
pip install --upgrade pip

# Install requirements
echo -e "${YELLOW}Installing Python dependencies...${NC}"
pip install -r requirements.txt
echo -e "${GREEN}Python dependencies installed${NC}"
echo ""

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Creating .env file from .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}.env file created${NC}"
else
    echo -e "${YELLOW}.env file already exists${NC}"
fi
echo ""

# Create storage directories
echo -e "${YELLOW}Creating storage directories...${NC}"
mkdir -p storage/datasets
mkdir -p storage/models
mkdir -p storage/artifacts
mkdir -p storage/mlruns
echo -e "${GREEN}Storage directories created${NC}"
echo ""

# Initialize database
echo -e "${YELLOW}Initializing database...${NC}"
if [ -f "valtool.db" ]; then
    echo -e "${YELLOW}Database already exists. Skipping initialization.${NC}"
else
    python3 -c "from core.database import engine, Base; Base.metadata.create_all(bind=engine); print('Database initialized successfully')"
    echo -e "${GREEN}Database initialized${NC}"
fi
echo ""

# Deactivate virtual environment
deactivate

cd ..

# Setup Frontend
echo "========================================="
echo "Setting up Frontend..."
echo "========================================="
cd fe

# Create .env.local file if it doesn't exist
if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}Creating .env.local file from .env.local.example...${NC}"
    cp .env.local.example .env.local
    echo -e "${GREEN}.env.local file created${NC}"
else
    echo -e "${YELLOW}.env.local file already exists${NC}"
fi
echo ""

# Install npm dependencies
echo -e "${YELLOW}Installing Node.js dependencies...${NC}"
npm install
echo -e "${GREEN}Node.js dependencies installed${NC}"
echo ""

cd ..

# Final message
echo "========================================="
echo -e "${GREEN}Setup Complete!${NC}"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Review and update configuration files:"
echo "     - be/.env (backend configuration)"
echo "     - fe/.env.local (frontend configuration)"
echo ""
echo "  2. Start the application:"
echo "     ./start.sh"
echo ""
echo "========================================="
