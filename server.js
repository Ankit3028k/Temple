import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PDFDocument, rgb } from 'pdf-lib';
import fs from 'fs/promises';
import { PythonShell } from 'python-shell';
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ankit:ankit@cluster0.3t4g3.mongodb.net/temple?retryWrites=true&w=majority';

// Middleware
app.use(express.json());
app.use(cors({ origin: '*' }));
app.use(express.static(path.join(__dirname)));

// MongoDB Connection
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected...'))
  .catch(err => console.error('MongoDB connection error:', err));

// User Schema
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
});

const User = mongoose.model('User', UserSchema);

// Create default admin user
async function createDefaultAdmin() {
  try {
    const adminExists = await User.findOne({ username: 'admin' });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('adminpassword', 10);
      const adminUser = new User({ username: 'admin', password: hashedPassword, role: 'admin' });
      await adminUser.save();
      console.log('Default admin user created.');
    }
  } catch (error) {
    console.error('Error creating default admin user:', error);
  }
}
createDefaultAdmin();

// Donation Schema
const DonationSchema = new mongoose.Schema({
  donor: { type: String, required: true, trim: true },
  eventName: { type: String, required: true, trim: true },
  eventDate: { type: Date, required: true },
  totalAmount: { type: Number, required: true, min: 0 },
  paidAmount: { type: Number, required: true, min: 0 },
  pendingAmount: { type: Number },
  status: { type: String, enum: ['pending', 'completed'] },
  contact: { type: String, trim: true },
  receiptId: { type: String, trim: true },
  paymentMode: { type: String, enum: ['cash', 'online', 'cheque', 'other'], default: 'cash' },
  createdBy: { type: String, required: true },
}, { timestamps: true });

// Pre-save middleware for Donation
DonationSchema.pre('save', function(next) {
  this.pendingAmount = this.totalAmount - this.paidAmount;
  this.status = this.pendingAmount > 0 ? 'pending' : 'completed';
  next();
});

// Pre-update middleware for Donation
DonationSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  if (update.totalAmount !== undefined && update.paidAmount !== undefined) {
    update.pendingAmount = update.totalAmount - update.paidAmount;
    update.status = update.pendingAmount > 0 ? 'pending' : 'completed';
  }
  next();
});

const Donation = mongoose.model('Donation', DonationSchema);

// Expense Schema
const ExpenseSchema = new mongoose.Schema({
  recipient: { type: String, required: true, trim: true },
  purpose: { type: String, required: true, trim: true },
  date: { type: Date, required: true },
  totalAmount: { type: Number, required: true, min: 0 },
  paidAmount: { type: Number, required: true, min: 0 },
  pendingAmount: { type: Number },
  status: { type: String, enum: ['pending', 'completed'] },
  contact: { type: String, trim: true },
  receiptId: { type: String, trim: true },
  paymentMode: { type: String, enum: ['cash', 'online', 'cheque', 'other'], default: 'cash' },
  createdBy: { type: String, required: true },
}, { timestamps: true });

// Pre-save middleware for Expense
ExpenseSchema.pre('save', function(next) {
  this.pendingAmount = this.totalAmount - this.paidAmount;
  this.status = this.pendingAmount > 0 ? 'pending' : 'completed';
  next();
});

// Pre-update middleware for Expense
ExpenseSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  if (update.totalAmount !== undefined && update.paidAmount !== undefined) {
    update.pendingAmount = update.totalAmount - update.paidAmount;
    update.status = update.pendingAmount > 0 ? 'pending' : 'completed';
  }
  next();
});

const Expense = mongoose.model('Expense', ExpenseSchema);

// JWT Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// Routes

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: 'Cannot find user' });
    if (await bcrypt.compare(password, user.password)) {
      const accessToken = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
      res.json({ accessToken });
    } else {
      res.status(401).json({ message: 'Incorrect password' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Register
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const userExists = await User.findOne({ username });
    if (userExists) {
      return res.status(400).json({ message: 'Username already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword, role: 'user' });
    await newUser.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Serve pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', authenticateToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Donation Routes

// Get all donations (public)
app.get('/api/donations', async (req, res) => {
  try {
    const donations = await Donation.find({});
    res.json(donations);
  } catch (error) {
    console.error('Error fetching donations:', error);
    res.status(500).json({ message: 'Error fetching donations', error: error.message });
  }
});

// Get all donations for admin (protected)
app.get('/api/donations/admin', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  try {
    const donations = await Donation.find({});
    res.json(donations);
  } catch (error) {
    console.error('Error fetching admin donations:', error);
    res.status(500).json({ message: 'Error fetching admin donations', error: error.message });
  }
});

// Add a new donation (protected)
app.post('/api/donations', authenticateToken, async (req, res) => {
  console.log('Received donation data:', req.body);
  try {
    const { donor, eventName, eventDate, totalAmount, paidAmount, contact, receiptId, paymentMode } = req.body;
    if (!donor || !eventName || !eventDate || !isFinite(totalAmount) || totalAmount < 0 || !isFinite(paidAmount) || paidAmount < 0 || paidAmount > totalAmount) {
      return res.status(400).json({ message: 'Invalid donation data', details: 'All required fields must be provided, and amounts must be valid numbers (paidAmount ≤ totalAmount)' });
    }
    const parsedDate = new Date(eventDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: 'Invalid eventDate', details: 'eventDate must be a valid date' });
    }
    const newDonation = new Donation({
      donor,
      eventName,
      eventDate: parsedDate,
      totalAmount,
      paidAmount,
      contact,
      receiptId,
      paymentMode,
      createdBy: req.user.username
    });
    await newDonation.save();
    res.status(201).json(newDonation);
  } catch (error) {
    console.error('Error adding donation:', error);
    res.status(400).json({ message: 'Error adding donation', error: error.message });
  }
});

// Update a donation (protected)
app.put('/api/donations/:id', authenticateToken, async (req, res) => {
  console.log('Received update donation data:', req.body);
  try {
    const { donor, eventName, eventDate, totalAmount, paidAmount, contact, receiptId, paymentMode } = req.body;
    if (!donor || !eventName || !eventDate || !isFinite(totalAmount) || totalAmount < 0 || !isFinite(paidAmount) || paidAmount < 0 || paidAmount > totalAmount) {
      return res.status(400).json({ message: 'Invalid donation data', details: 'All required fields must be provided, and amounts must be valid numbers (paidAmount ≤ totalAmount)' });
    }
    const parsedDate = new Date(eventDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: 'Invalid eventDate', details: 'eventDate must be a valid date' });
    }
    const pendingAmount = totalAmount - paidAmount;
    const status = pendingAmount > 0 ? 'pending' : 'completed';
    const updatedDonation = await Donation.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user.username },
      {
        donor,
        eventName,
        eventDate: parsedDate,
        totalAmount,
        paidAmount,
        pendingAmount,
        status,
        contact: contact || null, // Convert empty string to null
        receiptId: receiptId || null, // Convert empty string to null
        paymentMode: paymentMode || 'cash', // Ensure default
      },
      { new: true, runValidators: true }
    );
    if (!updatedDonation) {
      return res.status(404).json({ message: 'Donation not found or unauthorized' });
    }
    res.json(updatedDonation);
  } catch (error) {
    console.error('Error updating donation:', error);
    res.status(400).json({ message: 'Error updating donation', error: error.message });
  }
});

// Clear all donations (protected, admin only)
app.post('/api/donations/clear', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  try {
    await Donation.deleteMany({});
    res.status(200).json({ message: 'All donations cleared' });
  } catch (error) {
    console.error('Error clearing donations:', error);
    res.status(500).json({ message: 'Error clearing donations', error: error.message });
  }
});

// Get donation summary (public)
app.get('/api/donations/summary', async (req, res) => {
  try {
    const totalRecords = await Donation.countDocuments({});
    const pendingCount = await Donation.countDocuments({ status: 'pending' });
    const completedCount = await Donation.countDocuments({ status: 'completed' });
    const totalAmountResult = await Donation.aggregate([
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const totalAmount = totalAmountResult.length > 0 ? totalAmountResult[0].total : 0;
    const completedAmountResult = await Donation.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$paidAmount' } } }
    ]);
    const completedAmount = completedAmountResult.length > 0 ? completedAmountResult[0].total : 0;

    res.json({
      totalRecords,
      pendingCount,
      completedCount,
      totalAmount,
      completedAmount
    });
  } catch (error) {
    console.error('Error fetching donation summary:', error);
    res.status(500).json({ message: 'Error fetching donation summary', error: error.message });
  }
});

// Expense Routes

// Get all expenses (public)
app.get('/api/expenses', async (req, res) => {
  try {
    const expenses = await Expense.find({});
    res.json(expenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ message: 'Error fetching expenses', error: error.message });
  }
});

// Get all expenses for admin (protected)
app.get('/api/expenses/admin', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  try {
    const expenses = await Expense.find({});
    res.json(expenses);
  } catch (error) {
    console.error('Error fetching admin expenses:', error);
    res.status(500).json({ message: 'Error fetching admin expenses', error: error.message });
  }
});

// Add a new expense (protected)
app.post('/api/expenses', authenticateToken, async (req, res) => {
  console.log('Received expense data:', req.body);
  try {
    const { recipient, purpose, date, totalAmount, paidAmount, contact, receiptId, paymentMode } = req.body;
    if (!recipient || !purpose || !date || !isFinite(totalAmount) || totalAmount < 0 || !isFinite(paidAmount) || paidAmount < 0 || paidAmount > totalAmount) {
      return res.status(400).json({ message: 'Invalid expense data', details: 'All required fields must be provided, and amounts must be valid numbers (paidAmount ≤ totalAmount)' });
    }
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date', details: 'date must be a valid date' });
    }
    const newExpense = new Expense({
      recipient,
      purpose,
      date: parsedDate,
      totalAmount,
      paidAmount,
      contact,
      receiptId,
      paymentMode,
      createdBy: req.user.username
    });
    await newExpense.save();
    res.status(201).json(newExpense);
  } catch (error) {
    console.error('Error adding expense:', error);
    res.status(400).json({ message: 'Error adding expense', error: error.message });
  }
});

// Update an expense (protected)
app.put('/api/expenses/:id', authenticateToken, async (req, res) => {
  console.log('Received update expense data:', req.body);
  try {
    const { recipient, purpose, date, totalAmount, paidAmount, contact, receiptId, paymentMode } = req.body;
    if (!recipient || !purpose || !date || !isFinite(totalAmount) || totalAmount < 0 || !isFinite(paidAmount) || paidAmount < 0 || paidAmount > totalAmount) {
      return res.status(400).json({ message: 'Invalid expense data', details: 'All required fields must be provided, and amounts must be valid numbers (paidAmount ≤ totalAmount)' });
    }
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date', details: 'date must be a valid date' });
    }
    const pendingAmount = totalAmount - paidAmount;
    const status = pendingAmount > 0 ? 'pending' : 'completed';
    const updatedExpense = await Expense.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user.username },
      { recipient, purpose, date: parsedDate, totalAmount, paidAmount, pendingAmount, status, contact, receiptId, paymentMode },
      { new: true, runValidators: true }
    );
    if (!updatedExpense) {
      return res.status(404).json({ message: 'Expense not found or unauthorized' });
    }
    res.json(updatedExpense);
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(400).json({ message: 'Error updating expense', error: error.message });
  }
});

// Clear all expenses (protected, admin only)
app.post('/api/expenses/clear', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  try {
    await Expense.deleteMany({});
    res.status(200).json({ message: 'All expenses cleared' });
  } catch (error) {
    console.error('Error clearing expenses:', error);
    res.status(500).json({ message: 'Error clearing expenses', error: error.message });
  }
});

// Get expense summary (public)
app.get('/api/expenses/summary', async (req, res) => {
  try {
    const totalRecords = await Expense.countDocuments({});
    const pendingCount = await Expense.countDocuments({ status: 'pending' });
    const completedCount = await Expense.countDocuments({ status: 'completed' });
    const totalAmountResult = await Expense.aggregate([
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const totalAmount = totalAmountResult.length > 0 ? totalAmountResult[0].total : 0;
    const completedAmountResult = await Expense.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$paidAmount' } } }
    ]);
    const completedAmount = completedAmountResult.length > 0 ? completedAmountResult[0].total : 0;

    res.json({
      totalRecords,
      pendingCount,
      completedCount,
      totalAmount,
      completedAmount
    });
  } catch (error) {
    console.error('Error fetching expense summary:', error);
    res.status(500).json({ message: 'Error fetching expense summary', error: error.message });
  }
});

// app.post('/api/generate-pdf', authenticateToken, async (req, res) => {
//   const data = req.body; // { type, donor, eventName, eventDate, totalAmount, paidAmount, pendingAmount, status, issueDate }
//   const inputPdf = 'template.pdf'; // Path to your your template PDF (ensure it exists in the server directory)
//   const outputPdf = `output_${Date.now()}.pdf`;

//   try {
//     // Call the Python script with arguments
//     await PythonShell.run('modify_pdf.py', {
//       args: [inputPdf, outputPdf, JSON.stringify(data)]
//     });

//     // Read the generated PDF
//     const pdfBuffer = await fs.readFile(outputPdf);
//     res.setHeader('Content-Type', 'application/pdf');
//     res.setHeader('Content-Disposition', `attachment; filename=${outputPdf}`);
//     res.send(pdfBuffer);

//     // Clean up the output file
//     await fs.unlink(outputPdf);
//   } catch (error) {
//     console.error('Error generating PDF:', error);
//     res.status(500).json({ error: 'Failed to generate PDF' });
//   }
// });


// Generate PDF (Render-safe, no leftover temp files)
app.post("/api/generate-pdf", authenticateToken, async (req, res) => {
  const data = req.body;
  const inputPdf = path.join(__dirname, "template.pdf");

  try {
    // check template exists
    await fs.access(inputPdf);

    // ✅ cross-platform temp path
    const tmpDir = os.tmpdir();
    const outputPdf = path.join(tmpDir, `output_${Date.now()}.pdf`);

    await PythonShell.run("modify_pdf.py", {
      args: [inputPdf, outputPdf, JSON.stringify(data)],
      pythonPath: process.env.PYTHON_EXECUTABLE || 'python3',
    });

    const pdfBuffer = await fs.readFile(outputPdf);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=receipt.pdf");
    res.send(pdfBuffer);

    await fs.unlink(outputPdf).catch(() => {});
  } catch (error) {
    console.error("❌ Error generating PDF:", error);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});



// Receipt Generation Endpoint (optional, kept for reference but not used in client)
app.get('/api/receipt/:type/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }

  const { type, id } = req.params;
  let item;

  try {
    if (type === 'donation') {
      item = await Donation.findById(id);
      if (!item) {
        return res.status(404).json({ message: 'Donation not found' });
      }
    } else if (type === 'expense') {
      item = await Expense.findById(id);
      if (!item) {
        return res.status(404).json({ message: 'Expense not found' });
      }
    } else {
      return res.status(400).json({ message: 'Invalid type' });
    }

    // Load the PDF template
    const templatePath = path.join(__dirname, 'श्री शांतिनाथ दिगम्बर जैन मंदिर.pdf');
    const existingPdfBytes = await fs.readFile(templatePath);

    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    // Define text positions (approximate A4 layout, adjust as needed)
    const { donor, eventName, eventDate, totalAmount, paidAmount, pendingAmount, status, recipient, purpose, date, contact, receiptId, paymentMode } = item.toObject();

    // Common fields
    const issueDate = new Date().toLocaleDateString('hi-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Draw dynamic content (using Unicode for Hindi where possible, fallback English)
    // Note: pdf-lib with Helvetica supports basic Unicode; for full Devanagari, embed font if needed
    const black = rgb(0, 0, 0);

    if (type === 'donation') {
      firstPage.drawText(`दानकर्ता: ${donor || 'N/A'}`, { x: 50, y: 650, size: 12, color: black });
      firstPage.drawText(`कार्यक्रम: ${eventName || 'N/A'}`, { x: 50, y: 630, size: 12, color: black });
      firstPage.drawText(`तारीख: ${new Date(eventDate).toLocaleDateString('hi-IN')}`, { x: 50, y: 610, size: 12, color: black });
      firstPage.drawText(`कुल राशि: ₹${totalAmount.toLocaleString('hi-IN')}`, { x: 50, y: 590, size: 12, color: black });
      firstPage.drawText(`भुगतान राशि: ₹${paidAmount.toLocaleString('hi-IN')}`, { x: 50, y: 570, size: 12, color: black });
      firstPage.drawText(`बकाया राशि: ₹${pendingAmount.toLocaleString('hi-IN')}`, { x: 50, y: 550, size: 12, color: black });
      firstPage.drawText(`स्थिति: ${status === 'completed' ? 'पूर्ण' : 'लंबित'}`, { x: 50, y: 530, size: 12, color: black });
      firstPage.drawText(`संपर्क नंबर: ${contact || 'N/A'}`, { x: 50, y: 510, size: 12, color: black });
      firstPage.drawText(`रसीद आईडी: ${receiptId || 'N/A'}`, { x: 50, y: 490, size: 12, color: black });
      firstPage.drawText(`भुगतान मोड: ${paymentMode || 'N/A'}`, { x: 50, y: 470, size: 12, color: black });
    } else {
      firstPage.drawText(`प्राप्तकर्ता: ${recipient || 'N/A'}`, { x: 50, y: 650, size: 12, color: black });
      firstPage.drawText(`उद्देश्य: ${purpose || 'N/A'}`, { x: 50, y: 630, size: 12, color: black });
      firstPage.drawText(`तारीख: ${new Date(date).toLocaleDateString('hi-IN')}`, { x: 50, y: 610, size: 12, color: black });
      firstPage.drawText(`कुल राशि: ₹${totalAmount.toLocaleString('hi-IN')}`, { x: 50, y: 590, size: 12, color: black });
      firstPage.drawText(`भुगतान राशि: ₹${paidAmount.toLocaleString('hi-IN')}`, { x: 50, y: 570, size: 12, color: black });
      firstPage.drawText(`बकाया राशि: ₹${pendingAmount.toLocaleString('hi-IN')}`, { x: 50, y: 550, size: 12, color: black });
      firstPage.drawText(`स्थिति: ${status === 'completed' ? 'पूर्ण' : 'लंबित'}`, { x: 50, y: 530, size: 12, color: black });
      firstPage.drawText(`संपर्क नंबर: ${contact || 'N/A'}`, { x: 50, y: 510, size: 12, color: black });
      firstPage.drawText(`रसीद आईडी: ${receiptId || 'N/A'}`, { x: 50, y: 490, size: 12, color: black });
      firstPage.drawText(`भुगतान मोड: ${paymentMode || 'N/A'}`, { x: 50, y: 470, size: 12, color: black });
    }

    firstPage.drawText(`जारी की तारीख: ${issueDate}`, { x: 50, y: 450, size: 10, color: black });
    firstPage.drawText('धन्यवाद आपके सहयोग के लिए।', { x: 50, y: 430, size: 10, color: black });

    // Serialize the PDF
    const pdfBytes = await pdfDoc.save();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${type}-receipt-${id}.pdf"`,
      'Content-Length': pdfBytes.length
    });
    res.send(Buffer.from(pdfBytes));

  } catch (error) {
    console.error('Error generating receipt:', error);
    res.status(500).json({ message: 'Error generating receipt', error: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});