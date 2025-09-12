import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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
  createdBy: { type: String, required: true },
}, { timestamps: true });

// Pre-save middleware
DonationSchema.pre('save', function(next) {
  this.pendingAmount = this.totalAmount - this.paidAmount;
  this.status = this.pendingAmount > 0 ? 'pending' : 'completed';
  next();
});

// Pre-update middleware
DonationSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  if (update.totalAmount !== undefined && update.paidAmount !== undefined) {
    update.pendingAmount = update.totalAmount - update.paidAmount;
    update.status = update.pendingAmount > 0 ? 'pending' : 'completed';
  }
  next();
});

const Donation = mongoose.model('Donation', DonationSchema);

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
  console.log('Received donation data:', req.body); // Debug log
  try {
    const { donor, eventName, eventDate, totalAmount, paidAmount } = req.body;
    if (!donor || !eventName || !eventDate || !isFinite(totalAmount) || totalAmount < 0 || !isFinite(paidAmount) || paidAmount < 0 || paidAmount > totalAmount) {
      return res.status(400).json({ message: 'Invalid donation data', details: 'All fields are required, and amounts must be valid numbers (paidAmount ≤ totalAmount)' });
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
  console.log('Received update donation data:', req.body); // Debug log
  try {
    const { donor, eventName, eventDate, totalAmount, paidAmount } = req.body;
    if (!donor || !eventName || !eventDate || !isFinite(totalAmount) || totalAmount < 0 || !isFinite(paidAmount) || paidAmount < 0 || paidAmount > totalAmount) {
      return res.status(400).json({ message: 'Invalid donation data', details: 'All fields are required, and amounts must be valid numbers (paidAmount ≤ totalAmount)' });
    }
    const parsedDate = new Date(eventDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: 'Invalid eventDate', details: 'eventDate must be a valid date' });
    }
    const updatedDonation = await Donation.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user.username },
      { donor, eventName, eventDate: parsedDate, totalAmount, paidAmount },
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

// Clear all donations (protected, optional)
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

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});