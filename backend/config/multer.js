// config/multer.js
console.log(`[FILE_LOAD_CHECK] config/multer.js loaded at ${new Date().toISOString()}`);

const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Import fs for directory creation

// Configure multer for file uploads (user photos)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = './uploads/profile_photos';
    // Create the directory if it doesn't exist
    fs.mkdir(uploadPath, { recursive: true }, (err) => {
      if (err) {
        console.error('Error creating upload directory:', err);
        return cb(err); // Pass the error to multer
      }
      cb(null, uploadPath);
    });
  },
  filename: (req, file, cb) => {
    // Ensure req.user is available for authenticated routes
    // We get req.user from the 'authenticate' middleware which will run before this
    const userId = req.user && req.user.id ? req.user.id : 'unknown';
    cb(null, `user_${userId}_${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only JPEG/PNG images are allowed'));
  },
});

module.exports = upload;