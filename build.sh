#!/bin/bash
set -e

echo "🔧 Installing Node.js dependencies..."
npm install

echo "🐍 Installing Python and dependencies..."
apt-get update
apt-get install -y python3 python3-pip python3-dev

echo "📦 Upgrading pip..."
pip3 install --upgrade pip

echo "📋 Installing Python requirements..."
pip3 install -r requirements.txt

echo "✅ Testing PyMuPDF installation..."
python3 -c "import fitz; print('PyMuPDF installed successfully')"

echo "🎉 Build completed successfully!"
