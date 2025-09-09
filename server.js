import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key'; // Use a strong secret in production

// Middleware
app.use(express.json());
app.use(cors({ origin: '*' }));
app.use(express.static(path.join(_dirname))); // Serve static files (like temp.html and style.css)

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected...'))
.catch(err => console.error(err));

// User Schema (for admin authentication)
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' }, // Add role field
});

const User = mongoose.model('User', UserSchema);

// Create a default admin user if not exists (for demonstration)
async function createDefaultAdmin() {
  try {
    const adminExists = await User.findOne({ username: 'admin' });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('adminpassword', 10); // Hash default password
      const adminUser = new User({ username: 'admin', password: hashedPassword, role: 'admin' }); // Set role to admin

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
  donor: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
  notes: { type: String },
}, { timestamps: true });

const Donation = mongoose.model('Donation', DonationSchema);

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401); // No token

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403); // Invalid token
    req.user = user;
    next();
  });
}

// Middleware to authorize roles
function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role || !roles.includes(req.user.role)) {
      return res.sendStatus(403); // Forbidden
    }
    next();
  };
}

// Routes

// app.post('/create-test-user', async (req, res) => {
//   try {
//     const username = 'testuser';
//     const password = 'testpassword';
//     const userExists = await User.findOne({ username });
//     if (userExists) {
//       return res.status(409).send('Test user already exists');
//     }
//     const hashedPassword = await bcrypt.hash(password, 10);
//     const testUser = new User({ username, password: hashedPassword });
//     await testUser.save();
//     res.status(201).send('Test user created successfully');
//   } catch (error) {
//     console.error('Error creating test user:', error);
//     res.status(500).send('Error creating test user');
//   }
// });

// Register admin user route (protected by admin role)
app.post('/register-admin', async (req, res) => {
  const { username, password } = req.body;

  try {
    const userExists = await User.findOne({ username });
    if (userExists) {
      return res.status(409).send('Username already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword, role: 'admin' });
    await newUser.save();
    res.status(201).send('Admin user registered successfully');
  } catch (error) {
    console.error('Error registering admin user:', error);
    res.status(500).send('Error registering admin user');
  }
});

// Login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });
  if (!user) {
    return res.status(400).send('Cannot find user');
  }

  try {
    if (await bcrypt.compare(password, user.password)) {
      const accessToken = jwt.sign({ username: user.username }, JWT_SECRET);
      res.json({ accessToken: accessToken });
    } else {
      res.status(401).send('Not Allowed');
    }
  } catch (error) {
    res.status(500).send();
  }
});

// Serve the registration page
app.get('/register', (req, res) => {
  res.sendFile(path.join(_dirname, 'register.html'));
});

// Register new user route
// app.post('/register', async (req, res) => {
//   const { username, password } = req.body;

//   try {
//     const userExists = await User.findOne({ username });
//     if (userExists) {
//       return res.status(409).send('Username already exists');
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);
//     const newUser = new User({ username, password: hashedPassword, role: 'user' }); // Default role is 'user'
//     await newUser.save();
//     res.status(201).send('User registered successfully');
//   } catch (error) {
//     console.error('Error registering user:', error);
//     res.status(500).send('Error registering user');
//   }
// });
 
// Serve the index page (public)
app.get('/', (req, res) => {
  res.sendFile(path.join(_dirname, 'index.html'));
});

// Serve the index page (public)
app.get('/index.html', (req, res) => {
  res.sendFile(path.join(_dirname, 'index.html'));
});

// Serve the admin page (protected)
app.get('/admin', authenticateToken, (req, res) => {
  res.sendFile(path.join(_dirname, 'admin.html'));
});

// Get all donations (protected)
app.get('/api/donations', async (req, res) => {
  try {
    const donations = await Donation.find({}); 
    res.json(donations);
  } catch (err) {
    res.status(500).send(err);
  }
});

// Add a new donation (protected)
app.post('/api/donations', authenticateToken, async (req, res) => {
  try {
    const newDonation = new Donation(req.body);
    await newDonation.save();
    res.status(201).json(newDonation);
  } catch (err) {
    res.status(400).send(err);
  }
});

// Update a donation (protected)
app.put('/api/donations/:id', authenticateToken, async (req, res) => {
  try {
    const updatedDonation = await Donation.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updatedDonation) return res.status(404).send('Donation not found');
    res.json(updatedDonation);
  } catch (err) {
    res.status(400).send(err);
  }
});

// Delete a donation (protected)
app.delete('/api/donations/:id', authenticateToken, async (req, res) => {
  try {
    const deletedDonation = await Donation.findByIdAndDelete(req.params.id);
    if (!deletedDonation) return res.status(404).send('Donation not found');
    res.status(204).send();
  } catch (err) {
    res.status(500).send(err);
  }
});

// Clear all donations (protected)
app.post('/api/donations/clear', authenticateToken, async (req, res) => {
  try {
    await Donation.deleteMany({});
    res.status(200).send('All donations cleared');
  } catch (err) {
    res.status(500).send(err);
  }
});

// Get donation summary (protected)
app.get('/api/donations/summary', async (req, res) => {
  try {
    const totalRecords = await Donation.countDocuments({});
    const pendingCount = await Donation.countDocuments({ status: 'pending' });
    const completedCount = await Donation.countDocuments({ status: 'completed' });

    const totalAmountResult = await Donation.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalAmount = totalAmountResult.length > 0 ? totalAmountResult[0].total : 0;

    const completedAmountResult = await Donation.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const completedAmount = completedAmountResult.length > 0 ? completedAmountResult[0].total : 0;

    res.json({
      totalRecords,
      pendingCount,
      completedCount,
      totalAmount,
      completedAmount
    });
  } catch (err) {
    console.error('Error fetching donation summary:', err);
    res.status(500).send(err);
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
