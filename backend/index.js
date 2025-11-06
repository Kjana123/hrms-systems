// index.js

console.log(`[FILE_LOAD_CHECK] index.js loaded at ${new Date().toISOString()}`);

require('dotenv').config(); // Load environment variables

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const useragent = require('express-useragent');
const path = require('path');
const multer = require('multer'); // Required for error handling

// Ensure environment variables are loaded
if (!process.env.JWT_SECRET || !process.env.REFRESH_TOKEN_SECRET || !process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.FRONTEND_URL || !process.env.DATABASE_URL) {
  console.error('FATAL ERROR: One or more environment variables (JWT_SECRET, REFRESH_TOKEN_SECRET, EMAIL_USER, EMAIL_PASS, FRONTEND_URL, DATABASE_URL) are not defined.');
  process.exit(1); // Exit the process if critical environment variables are missing
}

// Import routes (We will create these files next)
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const adminRoutes = require('./routes/admin.routes');


const app = express();

// Core Middleware
app.use(express.json());
app.use(cookieParser());
app.use(useragent.express());

app.use(cors({
  origin: [
    'https://attendance.unitedsolutionsplus.in', 
    'http://127.0.0.1:3000', 
    'http://localhost:3000'
  ],
  credentials: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', // Include all required HTTP methods
  optionsSuccessStatus: 204 // Standard status code for successful OPTIONS request
}));


// --- Static File Serving ---
// Serve static profile photos
app.use('/uploads/profile_photos', express.static(path.join(__dirname, 'uploads/profile_photos')));
// Serve static payslip files
app.use('/uploads/payslips', express.static(path.join(__dirname, 'uploads/payslips')));


// --- API Routes ---
// Use the imported route files
app.use('/auth', authRoutes);
app.use('/api', userRoutes);
app.use('/api/admin', adminRoutes); // All admin routes will be prefixed with /api/admin
// Note: We'll move /admin/register-employee to /api/admin/register-employee for consistency


// --- Frontend Static File Serving and Catch-All Route ---
const frontendBuildPath = path.join(__dirname, '../frontend', 'dist');
console.log('Serving frontend static files from:', frontendBuildPath); // Log for debugging

app.use(express.static(frontendBuildPath));

// Catch-all route for SPA
app.get('*', (req, res) => {
    const indexPath = path.join(frontendBuildPath, 'index.html');
    
    // Check if the request looks like an API call that wasn't caught
    if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
        return res.status(404).json({ message: 'API endpoint not found.' });
    }
    
    console.log('Attempting to send index.html from catch-all route:', indexPath);
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error('Error sending index.html:', err.message);
            res.status(500).send(err);
        }
    });
});


// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message, err.stack);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: `File upload error: ${err.message}` });
  }
  if (!res.headersSent) {
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// Start Server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});