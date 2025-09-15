# Deployment Instructions for Render

## Docker-Based Deployment (Recommended)

This solution uses Docker to properly install both Node.js and Python dependencies on Render.

### Files Required for Deployment

1. **Dockerfile** - Docker configuration for multi-language support
2. **requirements.txt** - Contains Python dependencies
3. **server.js** - Updated with Python path configuration
4. **modify_pdf.py** - Python script for PDF generation
5. **template.pdf** - PDF template file

### Steps to Deploy on Render

1. **Push your code to GitHub** (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Docker-based deployment with Python support"
   git branch -M main
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Create a new Web Service on Render**:
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Select your repository and branch

3. **Configure the Service**:
   - **Name**: `temple-donation-manager`
   - **Environment**: `Docker`
   - **Build Command**: Leave empty (Docker will handle)
   - **Start Command**: Leave empty (Docker will handle)

4. **Add Environment Variables**:
   - `MONGODB_URI`: Your MongoDB connection string
   - `JWT_SECRET`: Your JWT secret key
   - `NODE_ENV`: `production`

5. **Deploy**:
   - Click "Create Web Service"
   - Render will build the Docker image which will:
     - Install Node.js dependencies
     - Install Python 3, pip, and development tools
     - Install PyMuPDF from requirements.txt
     - Test PyMuPDF installation

### How It Works

- **Build Process**: Docker installs all dependencies in a controlled environment
- **Runtime**: Your Node.js server runs with Python available
- **Python Path**: The server uses `python3` as configured

### Troubleshooting

If you encounter issues:

1. **Check Build Logs**: Look for Python installation errors
2. **Verify Python Path**: Ensure `python3` is available
3. **Check File Permissions**: Ensure all files are committed to git
4. **Template PDF**: Make sure `template.pdf` exists in your repository
5. **PyMuPDF Installation**: Check if PyMuPDF compiled successfully during build
6. **Server Logs**: Check Render logs for detailed error messages with emojis

### Common Issues and Solutions

**500 Error on PDF Generation**:
- Check if PyMuPDF installed correctly during build
- Verify `template.pdf` exists in repository
- Check server logs for detailed Python error messages

**Python Module Not Found**:
- Ensure `requirements.txt` includes all dependencies
- Check build logs for pip installation errors
- Verify Python development headers are installed (`python3-dev`)

### Alternative Manual Configuration

If `render.yaml` doesn't work, you can manually configure:

1. **Build Command**:
   ```bash
   npm install && apt-get update && apt-get install -y python3 python3-pip python3-dev && pip3 install --upgrade pip && pip3 install -r requirements.txt
   ```

2. **Start Command**:
   ```bash
   node server.js
   ```

3. **Environment Variables**:
   - Add `PYTHON_EXECUTABLE=python3`

### Testing Locally

To test the setup locally:

1. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Run the server:
   ```bash
   npm start
   ```

3. Test PDF generation through your application's admin panel.

The PDF generation should now work both locally and on Render with this configuration.
