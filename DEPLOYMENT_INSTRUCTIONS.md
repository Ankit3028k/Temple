# Deployment Instructions for Render

## Solution 1: Render's Native Multi-Language Support

This solution allows you to run both Node.js and Python on Render using their native multi-language support.

### Files Required for Deployment

1. **requirements.txt** - Contains Python dependencies
2. **render.yaml** - Render configuration file
3. **server.js** - Updated with Python path configuration
4. **modify_pdf.py** - Python script for PDF generation
5. **template.pdf** - PDF template file

### Steps to Deploy on Render

1. **Push your code to GitHub** (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit with Render configuration"
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
   - **Environment**: `Node`
   - **Build Command**: Leave empty (will use render.yaml)
   - **Start Command**: Leave empty (will use render.yaml)

4. **Add Environment Variables**:
   - `MONGODB_URI`: Your MongoDB connection string
   - `JWT_SECRET`: Your JWT secret key
   - `NODE_ENV`: `production`

5. **Deploy**:
   - Click "Create Web Service"
   - Render will automatically use the `render.yaml` configuration
   - The build process will:
     - Install Node.js dependencies
     - Install Python 3 and pip
     - Install PyMuPDF from requirements.txt

### How It Works

- **Build Process**: The `render.yaml` file configures Render to install both Node.js and Python dependencies
- **Runtime**: Your Node.js server runs normally and calls Python scripts using `python-shell`
- **Python Path**: The server uses `python3` as configured in the environment variable

### Troubleshooting

If you encounter issues:

1. **Check Build Logs**: Look for Python installation errors
2. **Verify Python Path**: Ensure `python3` is available
3. **Check File Permissions**: Ensure all files are committed to git
4. **Template PDF**: Make sure `template.pdf` exists in your repository

### Alternative Manual Configuration

If `render.yaml` doesn't work, you can manually configure:

1. **Build Command**:
   ```bash
   npm install && apt-get update && apt-get install -y python3 python3-pip && pip3 install -r requirements.txt
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
