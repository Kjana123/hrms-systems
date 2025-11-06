// routes/admin.routes.js
console.log(`[FILE_LOAD_CHECK] routes/admin.routes.js loaded at ${new Date().toISOString()}`);

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const moment = require('moment-timezone');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// --- Import all necessary modules ---
const pool = require('../db');
const { authenticate, authorizeAdmin } = require('../middleware/authenticate');
const upload = require('../config/multer'); // Multer config for photo uploads
const { calculateAttendanceMetrics } = require('../utils/helpers');
const { 
    calculateAttendanceSummary, 
    convertNumberToWords, 
    generatePayslipPDF 
} = require('../utils/payroll');

// --- Multer setup for Payslip Uploads (specific to admin route) ---
const payslipUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            // Note: __dirname here is /routes, so we go up one level
            const uploadPath = path.join(__dirname, '..', 'uploads', 'payslips');
            fs.mkdir(uploadPath, { recursive: true }, (err) => {
                if (err) {
                    console.error('Error creating payslip upload directory:', err);
                    return cb(err);
                }
                cb(null, uploadPath);
            });
        },
        filename: (req, file, cb) => {
            const { userId, month, year } = req.body;
            // Use a consistent naming convention
            const filename = `payslip_${userId || 'unknown'}_${year || '0000'}_${String(month || '00').padStart(2, '0')}${path.extname(file.originalname)}`;
            cb(null, filename);
        }
    }),
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed for payslips!'), false);
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});


// --- User Management (Admin) ---

// MODIFIED: /admin/register-employee to /register-employee (prefixed with /api/admin by index.js)
// This version integrates file upload (profile photo) and all new employee details.
router.post('/register-employee', authenticate, authorizeAdmin, upload.single('photo'), async (req, res) => {
    try {
        // Define the maximum number of users allowed on the backend
        const MAX_ALLOWED_USERS = 30; // CRITICAL FIX: Increased backend user limit

        const {
            name, email, password, role, employee_id, shift_type, address, mobile_number,
            kyc_details, // Existing field you provided
            pan_card_number, bank_account_number, ifsc_code, bank_name, date_of_birth // NEW FIELDS
        } = req.body;

        // Validate required fields
        if (!name || !email || !password || !role || !employee_id || !shift_type) {
            return res.status(400).json({ message: 'Name, email, password, employee ID, role, and shift type are required.' });
        }

        // Check current user count against the maximum allowed
        const userCountResult = await pool.query('SELECT COUNT(*) FROM users');
        const currentUserCount = parseInt(userCountResult.rows[0].count, 10);

        if (currentUserCount >= MAX_ALLOWED_USERS) {
            return res.status(403).json({ message: `Maximum user limit of ${MAX_ALLOWED_USERS} reached. Cannot register more employees.` });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const photoFilename = req.file ? req.file.filename : null; // Get filename from multer if photo was uploaded

        const { rows } = await pool.query(
            `INSERT INTO users (
                name, email, password_hash, role, employee_id, shift_type, address, mobile_number,
                kyc_details, pan_card_number, bank_account_number, ifsc_code, bank_name, date_of_birth, profile_photo
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING id, name, email, employee_id, role, shift_type, address, mobile_number,
                      kyc_details, pan_card_number, bank_account_number, ifsc_code, bank_name, date_of_birth, profile_photo`,
            [
                name, email, hashedPassword, role, employee_id, shift_type,
                address || null, mobile_number || null, kyc_details || null, // Existing fields
                pan_card_number || null, bank_account_number || null, ifsc_code || null, bank_name || null, date_of_birth || null, // NEW FIELDS
                photoFilename // Profile photo filename
            ]
        );

        const newUser = rows[0];
        res.status(201).json({
            message: 'Employee registered successfully.',
            user: {
                ...newUser,
                // Construct full URL for profile photo if it exists
                profile_photo: newUser.profile_photo ? `/uploads/profile_photos/${newUser.profile_photo}` : null,
                // Ensure date_of_birth is formatted as YYYY-MM-DD if it's a Date object
                date_of_birth: newUser.date_of_birth ? moment(newUser.date_of_birth).format('YYYY-MM-DD') : null,
            }
        });
    } catch (error) {
        console.error('Error registering employee:', error.message, error.stack);
        if (error.code === '23505') { // Unique violation code for PostgreSQL (e.g., duplicate email or employee_id)
            return res.status(409).json({ message: 'Employee with this email or ID already exists.' });
        }
        res.status(500).json({ message: 'Server error during employee registration.' });
    }
});

// /api/admin/users - Fetches all users for admin dashboard
router.get('/users', authenticate, authorizeAdmin, async (req, res) => {
    let client; // Declare client outside try to ensure it's accessible in finally
    try {
        client = await pool.connect(); // Get a client from the pool for transaction

        const { rows } = await client.query(
            `SELECT
                id,
                name,
                email,
                employee_id,
                role,
                shift_type,
                address,
                mobile_number,
                kyc_details,
                personal_details,
                family_history,
                profile_photo,
                pan_card_number,
                bank_account_number,
                ifsc_code,
                bank_name,
                date_of_birth,
                designation,    -- ADDED: designation field
                joining_date,   -- ADDED: joining_date field
                created_at,
                updated_at
            FROM users
            ORDER BY name ASC`
        );

        res.json(rows.map(user => ({
            ...user,
            // Construct full URL for profile photo if it exists
            profile_photo: user.profile_photo ? `/uploads/profile_photos/${user.profile_photo}` : null,
            // Ensure date_of_birth is formatted as YYYY-MM-DD for consistency
            date_of_birth: user.date_of_birth ? moment(user.date_of_birth).format('YYYY-MM-DD') : null,
            designation: user.designation || null, // Ensure designation is included
            joining_date: user.joining_date ? moment(user.joining_date).format('YYYY-MM-DD') : null, // Ensure joining_date is formatted
        })));
    } catch (error) {
        console.error('Error in /api/admin/users:', error.message, error.stack);
        res.status(500).json({ message: `Server error fetching users: ${error.message}` });
    } finally {
        if (client) { // Ensure client exists before releasing
            client.release(); // Release the client back to the pool
        }
    }
});

// /api/admin/users/:id - Allows admin to edit employee details including new fields
router.put('/users/:id', authenticate, authorizeAdmin, upload.single('photo'), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name, email, employee_id, role, shift_type, address, mobile_number,
            kyc_details, personal_details, family_history, password,
            pan_card_number, bank_account_number, ifsc_code, bank_name, date_of_birth,
            designation, joining_date // ADDED: designation and joining_date
        } = req.body;

        const photoFilename = req.file ? req.file.filename : null;

        // Start building the query dynamically to include only provided fields
        const updateFields = [];
        const queryParams = [];
        let paramIndex = 1;

        // Conditionally add fields to updateFields and queryParams
        if (name !== undefined) { updateFields.push(`name = $${paramIndex++}`); queryParams.push(name); }
        if (email !== undefined) { updateFields.push(`email = $${paramIndex++}`); queryParams.push(email); }
        if (employee_id !== undefined) { updateFields.push(`employee_id = $${paramIndex++}`); queryParams.push(employee_id); }
        if (role !== undefined) { updateFields.push(`role = $${paramIndex++}`); queryParams.push(role); }
        if (shift_type !== undefined) { updateFields.push(`shift_type = $${paramIndex++}`); queryParams.push(shift_type); }
        if (address !== undefined) { updateFields.push(`address = $${paramIndex++}`); queryParams.push(address); }
        if (mobile_number !== undefined) { updateFields.push(`mobile_number = $${paramIndex++}`); queryParams.push(mobile_number); }
        if (kyc_details !== undefined) { updateFields.push(`kyc_details = $${paramIndex++}`); queryParams.push(kyc_details); }
        if (personal_details !== undefined) { updateFields.push(`personal_details = $${paramIndex++}`); queryParams.push(personal_details); }
        if (family_history !== undefined) { updateFields.push(`family_history = $${paramIndex++}`); queryParams.push(family_history); }

        // NEW FIELDS
        if (pan_card_number !== undefined) { updateFields.push(`pan_card_number = $${paramIndex++}`); queryParams.push(pan_card_number); }
        if (bank_account_number !== undefined) { updateFields.push(`bank_account_number = $${paramIndex++}`); queryParams.push(bank_account_number); }
        if (ifsc_code !== undefined) { updateFields.push(`ifsc_code = $${paramIndex++}`); queryParams.push(ifsc_code); }
        if (bank_name !== undefined) { updateFields.push(`bank_name = $${paramIndex++}`); queryParams.push(bank_name); }
        if (date_of_birth !== undefined) { updateFields.push(`date_of_birth = $${paramIndex++}`); queryParams.push(date_of_birth); }

        // ADDED: designation and joining_date update conditions
        if (designation !== undefined) { updateFields.push(`designation = $${paramIndex++}`); queryParams.push(designation); }
        if (joining_date !== undefined) { updateFields.push(`joining_date = $${paramIndex++}`); queryParams.push(joining_date); } // Assuming joining_date comes as 'YYYY-MM-DD' string

        // Password and photo are handled separately as they are optional and require specific logic
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateFields.push(`password_hash = $${paramIndex++}`);
            queryParams.push(hashedPassword);
        }
        if (photoFilename) {
            updateFields.push(`profile_photo = $${paramIndex++}`);
            queryParams.push(photoFilename);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ message: 'No fields provided for update.' });
        }

        // Add updated_at timestamp
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

        // Add the user ID to the query parameters
        queryParams.push(id);

        const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        const { rows } = await pool.query(query, queryParams);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const updatedUser = rows[0];
        res.json({
            message: 'User profile updated successfully.',
            user: {
                ...updatedUser,
                profile_photo: updatedUser.profile_photo ? `/uploads/profile_photos/${updatedUser.profile_photo}` : null,
                date_of_birth: updatedUser.date_of_birth ? moment(updatedUser.date_of_birth).format('YYYY-MM-DD') : null,
                joining_date: updatedUser.joining_date ? moment(updatedUser.joining_date).format('YYYY-MM-DD') : null, // Ensure joining_date is formatted for response
            }
        });
    } catch (error) {
        console.error('Error updating user:', error.message, error.stack);
        if (error.code === '23505') { // Unique violation code for PostgreSQL
            return res.status(409).json({ message: 'Email or Employee ID already exists.' });
        }
        res.status(500).json({ message: 'Server error updating user.' });
    }
});

// /api/admin/users/:id - Delete a user and all associated data
router.delete('/users/:id', authenticate, authorizeAdmin, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN'); // Start transaction

    // Delete associated data first to avoid foreign key constraints
    await client.query('DELETE FROM attendance WHERE user_id = $1', [id]);
    await client.query('DELETE FROM leave_applications WHERE user_id = $1', [id]);
    await client.query('DELETE FROM corrections WHERE user_id = $1', [id]);
    await client.query('DELETE FROM leave_balances WHERE user_id = $1', [id]);
    await client.query('DELETE FROM notifications WHERE user_id = $1', [id]);
    await client.query('DELETE FROM weekly_offs WHERE user_id = $1', [id]); // Delete weekly offs
    await client.query('DELETE FROM profile_update_requests WHERE user_id = $1', [id]);
    // If you have a password_reset_tokens table, uncomment this:
    // await client.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [id]);

    const result = await client.query('DELETE FROM users WHERE id = $1 RETURNING id, profile_photo', [id]);
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'User not found.' });
    }

    // Delete profile photo file from disk if it exists
    const deletedUser = result.rows[0];
    if (deletedUser.profile_photo) {
      // Note: __dirname is /routes, so we go up one level
      const photoPath = path.join(__dirname, '..', 'uploads', 'profile_photos', deletedUser.profile_photo);
      fs.unlink(photoPath, (err) => {
        if (err) console.error(`Error deleting profile photo file ${photoPath}:`, err);
      });
    }

    await client.query('COMMIT'); // Commit transaction
    res.json({ message: 'User and all associated data deleted successfully.' });
  } catch (error) {
    await client.query('ROLLBACK'); // Rollback on error
    console.error('Admin delete user error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error deleting user and associated data.' });
  } finally {
    client.release();
  }
});


// --- Profile Update Request Management (Admin) ---

// NEW ENDPOINT: Admin views all profile update requests
router.get('/profile-update-requests', authenticate, authorizeAdmin, async (req, res) => {
  const { status } = req.query; // Optional: filter by status (pending, approved, rejected)
  let queryText = `
    SELECT
      pur.id,
      pur.user_id,
      u.name AS user_name,
      u.employee_id, -- Include employee_id for admin view
      pur.requested_data,
      pur.reason,
      pur.status,
      pur.admin_comment,
      pur.requested_at,
      pur.reviewed_at,
      admin_user.name AS reviewed_by_admin_name -- Admin who reviewed it
    FROM profile_update_requests pur
    JOIN users u ON pur.user_id = u.id
    LEFT JOIN users admin_user ON pur.reviewed_by = admin_user.id
  `;
  const queryParams = [];
  let paramIndex = 1;

  if (status) {
    queryText += ` WHERE pur.status = $${paramIndex++}`;
    queryParams.push(status);
  }

  queryText += ' ORDER BY pur.requested_at DESC';

  let client;
  try {
    client = await pool.connect();
    const { rows } = await client.query(queryText, queryParams);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching profile update requests:', error.message, error.stack);
    res.status(500).json({ message: 'Server error fetching profile update requests.' });
  } finally {
    if (client) client.release();
  }
});

// NEW ENDPOINT: Admin approves a profile update request
router.post('/profile-update-requests/:id/approve', authenticate, authorizeAdmin, async (req, res) => {
  const { id } = req.params; // Using 'id' for consistency with common REST patterns
  const { admin_comment } = req.body;
  const adminId = req.user.id;
  const adminName = req.user.name;

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const { rows } = await client.query(
      'SELECT user_id, requested_data, status FROM profile_update_requests WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Profile update request not found.' });
    }

    const request = rows[0];
    if (request.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `Request already ${request.status}. Cannot approve.` });
    }

    const requestedData = request.requested_data;
    const userIdToUpdate = request.user_id;

    // Construct dynamic UPDATE query for users table
    const updateFields = [];
    const updateValues = [];
    let updateParamIndex = 1;

    for (const key in requestedData) {
      if (requestedData.hasOwnProperty(key)) {
        updateFields.push(`${key} = $${updateParamIndex++}`);
        updateValues.push(requestedData[key]);
      }
    }

    if (updateFields.length > 0) {
      const userUpdateQuery = `UPDATE users SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${updateParamIndex} RETURNING *`;
      updateValues.push(userIdToUpdate);
      await client.query(userUpdateQuery, updateValues);
    }

    // Update the request status
    await client.query(
      'UPDATE profile_update_requests SET status = $1, admin_comment = $2, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $3 WHERE id = $4',
      ['approved', admin_comment || null, adminId, id] // Use reviewed_by and reviewed_at
    );

    // Notify the employee that their request has been approved
    await client.query(
      'INSERT INTO notifications (user_id, message) VALUES ($1, $2)',
      [userIdToUpdate, `Your profile update request (ID: ${id}) has been APPROVED by ${adminName}.`]
    );

    await client.query('COMMIT');
    res.json({ message: 'Profile update request approved and user profile updated.' });

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Error approving profile update request:', error.message, error.stack);
    res.status(500).json({ message: 'Server error approving profile update request.' });
  } finally {
    if (client) client.release();
  }
});

// NEW ENDPOINT: Admin rejects a profile update request
router.post('/profile-update-requests/:id/reject', authenticate, authorizeAdmin, async (req, res) => {
    const { id } = req.params; // Using 'id' for consistency with common REST patterns
    const { admin_comment } = req.body;
    const adminId = req.user.id;
    const adminName = req.user.name;

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const { rows } = await client.query(
            'SELECT user_id, status FROM profile_update_requests WHERE id = $1 FOR UPDATE',
            [id]
        );

        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Profile update request not found.' });
        }

        const request = rows[0];
        if (request.status !== 'pending') {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: `Request already ${request.status}. Cannot reject.` });
        }

        // Update the request status
        await client.query(
            'UPDATE profile_update_requests SET status = $1, admin_comment = $2, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $3 WHERE id = $4',
            ['rejected', admin_comment || null, adminId, id] // Use reviewed_by and reviewed_at
        );

        // Notify the employee that their request has been rejected
        await client.query(
            'INSERT INTO notifications (user_id, message) VALUES ($1, $2)',
            [request.user_id, `Your profile update request (ID: ${id}) has been REJECTED by ${adminName}. Reason: ${admin_comment || 'No reason provided.'}`]
        );

        await client.query('COMMIT');
        res.json({ message: 'Profile update request rejected.' });

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('Error rejecting profile update request:', error.message, error.stack);
        res.status(500).json({ message: 'Server error rejecting profile update request.' });
    } finally {
        if (client) client.release();
    }
});


// --- Holiday Management (Admin) ---

router.post('/holidays', authenticate, authorizeAdmin, async (req, res) => {
  const { holiday_date, holiday_name } = req.body; // Corrected to holiday_date, holiday_name
  if (!holiday_date || !holiday_name) {
    return res.status(400).json({ message: 'Date and name are required for a holiday.' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO holidays (holiday_date, holiday_name) VALUES ($1, $2) RETURNING *',
      [holiday_date, holiday_name]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding holiday:', error.message, error.stack);
    res.status(500).json({ message: 'Server error adding holiday.' });
  }
});

router.get('/holidays', authenticate, authorizeAdmin, async (req, res) => {
  try {
    // Corrected to holiday_date
    const { rows } = await pool.query('SELECT * FROM holidays ORDER BY holiday_date ASC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching holidays:', error.message, error.stack);
    res.status(500).json({ message: 'Server error fetching holidays.' });
  }
});

router.delete('/holidays/:id', authenticate, authorizeAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM holidays WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Holiday not found.' });
    }
    res.json({ message: 'Holiday deleted successfully.' });
  } catch (error) {
    console.error('Error deleting holiday:', error.message, error.stack);
    res.status(500).json({ message: 'Server error deleting holiday.' });
  }
});

// --- Leave Type Management (Admin) ---

router.post('/leave-types', authenticate, authorizeAdmin, async (req, res) => {
  const { name, description, is_paid, default_days_per_year } = req.body;
  if (!name || typeof is_paid === 'undefined') {
    return res.status(400).json({ message: 'Name and is_paid status are required for a leave type.' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO leave_types (name, description, is_paid, default_days_per_year) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, description || null, is_paid, default_days_per_year || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding leave type:', error.message, error.stack);
    res.status(500).json({ message: 'Server error adding leave type.' });
  }
});

router.get('/leave-types', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM leave_types ORDER BY name ASC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching leave types:', error.message, error.stack);
    res.status(500).json({ message: 'Server error fetching leave types.' });
  }
});

router.delete('/leave-types/:id', authenticate, authorizeAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM leave_types WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Leave type not found.' });
    }
    res.json({ message: 'Leave type deleted successfully.' });
  } catch (error) {
    console.error('Error deleting leave type:', error.message, error.stack);
    res.status(500).json({ message: 'Server error deleting leave type.' });
  }
});

// --- Leave Application Management (Admin) ---

router.get('/leaves', authenticate, authorizeAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                la.id,
                la.user_id,
                u.name AS user_name,
                u.employee_id,
                la.leave_type_id,
                lt.name AS leave_type_name,
                lt.is_paid,
                la.from_date,
                la.to_date,
                la.duration,
                la.reason,
                la.is_half_day,
                la.status,
                la.admin_comment,
                la.cancellation_reason,
                la.created_at,
                la.updated_at
            FROM leave_applications la
            JOIN users u ON la.user_id = u.id
            JOIN leave_types lt ON CAST(la.leave_type_id AS INTEGER) = lt.id
            ORDER BY la.created_at DESC
        `);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching all leave applications (admin):', error);
        res.status(500).json({ message: 'Server error fetching leave applications.' });
    }
});

router.put('/leaves/:id/status', authenticate, authorizeAdmin, async (req, res) => {
    const { id } = req.params;
    const { status, admin_comment } = req.body;
    const adminId = req.user.id; // User ID from authentication middleware

    if (!status) {
        return res.status(400).json({ message: 'Status is required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Start transaction

        // Fetch current leave application details
        const leaveResult = await client.query(
            `SELECT user_id, leave_type_id, duration, status AS current_status, from_date, to_date, is_processed_as_paid, employee_id
             FROM leave_applications WHERE id = $1 FOR UPDATE`, // FOR UPDATE locks the row
            [id]
        );

        if (leaveResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Leave application not found.' });
        }

        const leave = leaveResult.rows[0];
        const { user_id, leave_type_id, duration, current_status, from_date, to_date } = leave;

        const fromDate = moment(from_date);
        const toDate = moment(to_date);

        // Declare employeeCurrentBalance at a higher scope
        let employeeCurrentBalance = 0; // Initialize to 0, will be updated if a record is found

        // Prevent updating already final statuses
        if (['approved', 'rejected', 'cancelled', 'cancellation_rejected'].includes(current_status) && current_status === status) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: `Leave is already ${status}. No change needed.` });
        }

        // Fetch leave type details
        const leaveTypeResult = await client.query('SELECT name, is_paid FROM leave_types WHERE id = CAST($1 AS INTEGER)', [leave_type_id]);
        if (leaveTypeResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Associated leave type not found.' });
        }
        const leaveType = leaveTypeResult.rows[0];
        const leaveTypeName = leaveType.name;
        let isPaidLeave = leaveType.is_paid; // This is the initial is_paid status from leave_types
        const leaveDuration = parseFloat(duration);
        console.log(`[LEAVE_APPROVAL_DEBUG] Leave Duration: ${leaveDuration} (Type: ${typeof leaveDuration})`);

        if (isNaN(leaveDuration)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Invalid leave duration found for application.' });
        }

        // Fetch holidays and user's weekly offs for the leave period
        const holidaysResult = await client.query('SELECT holiday_date FROM holidays WHERE holiday_date BETWEEN $1 AND $2', [fromDate.format('YYYY-MM-DD'), toDate.format('YYYY-MM-DD')]);
        const holidayDates = new Set(holidaysResult.rows.map(row => moment(row.holiday_date).format('YYYY-MM-DD')));

        // Fetch weekly offs for the user that are active during the leave period
        const userWeeklyOffsResult = await client.query(
            `SELECT weekly_off_days, effective_date FROM weekly_offs WHERE user_id = $1 AND effective_date <= $2 ORDER BY effective_date DESC`,
            [user_id, toDate.format('YYYY-MM-DD')]
        );

        let newLeaveStatus = status;
        let notificationMessage = '';
        let notificationType = '';
        let processedAsPaidFlag = null;

        // --- Handle Status Transitions and Balance Adjustments ---
        if (status === 'approved') {
            console.log(`[LEAVE_APPROVAL_DEBUG] Processing 'approved' status.`);
            if (leave.current_status === 'pending') {
                console.log(`[LEAVE_APPROVAL_DEBUG] Leave is currently 'pending'. Proceeding with balance check.`);
                if (isPaidLeave) {
                    console.log(`[LEAVE_APPROVAL_DEBUG] Leave type '${leaveTypeName}' is initially marked as paid.`);
                    const balanceResult = await client.query(
                        'SELECT current_balance FROM leave_balances WHERE user_id = $1 AND leave_type = $2',
                        [user_id, leaveTypeName]
                    );
                    console.log(`[LEAVE_APPROVAL_DEBUG] Raw balanceResult for user ${user_id}, type ${leaveTypeName}:`, balanceResult.rows);

                    if (balanceResult.rows.length > 0) {
                        employeeCurrentBalance = parseFloat(balanceResult.rows[0].current_balance);
                        console.log(`[LEAVE_APPROVAL_DEBUG] Found existing balance: ${employeeCurrentBalance}`);
                    } else {
                        console.warn(`[LEAVE_APPROVAL_DEBUG] No existing balance record found for user ${user_id} and leave type ${leaveTypeName}. Initializing balance to 0 for calculation.`);
                    }

                    console.log(`[LEAVE_APPROVAL_DEBUG] User ${user_id}, Leave Type: ${leaveTypeName}, Initial Current Balance (for calculation): ${employeeCurrentBalance} (Type: ${typeof employeeCurrentBalance}), Duration: ${leaveDuration}`);

                    if (employeeCurrentBalance < leaveDuration) {
                        isPaidLeave = false;
                        console.log(`[LEAVE_APPROVAL_DEBUG] Insufficient balance (${employeeCurrentBalance} < ${leaveDuration}). Leave converted to unpaid (LOP). isPaidLeave set to: ${isPaidLeave}`);
                    } else {
                        console.log(`[LEAVE_APPROVAL_DEBUG] Sufficient balance (${employeeCurrentBalance} >= ${leaveDuration}). isPaidLeave remains: ${isPaidLeave}`);
                    }
                } else {
                    console.log(`[LEAVE_APPROVAL_DEBUG] Leave type '${leaveTypeName}' is initially marked as UNPAID. Balance will not be deducted.`);
                }

                console.log(`[LEAVE_APPROVAL_DEBUG] Final isPaidLeave status before deduction logic: ${isPaidLeave}`);
                if (isPaidLeave) {
                    const newBalance = (employeeCurrentBalance - leaveDuration).toFixed(2);
                    console.log(`[LEAVE_APPROVAL_DEBUG] Deducting ${leaveDuration} from ${leaveTypeName} balance for user ${user_id}. Calculated New Balance: ${newBalance}`);
                    await client.query(
                        `INSERT INTO leave_balances (user_id, leave_type, current_balance, total_days_allocated)
                         VALUES ($1, $2, $3::NUMERIC, 0)
                         ON CONFLICT (user_id, leave_type) DO UPDATE SET
                             current_balance = EXCLUDED.current_balance,
                             last_updated = CURRENT_TIMESTAMP;`,
                        [user_id, leaveTypeName, newBalance]
                    );
                    console.log(`[LEAVE_APPROVAL_DEBUG] Leave balance update query executed for user ${user_id}.`);
                    processedAsPaidFlag = true;
                } else {
                    console.log(`[LEAVE_APPROVAL_DEBUG] Leave is marked as unpaid (LOP). No balance deduction.`);
                    processedAsPaidFlag = false;
                }

                // Mark attendance for each day of the leave
                let currentDay = fromDate.clone();
                while (currentDay.isSameOrBefore(toDate)) {
                    const dateStr = currentDay.format('YYYY-MM-DD');
                    const dayOfWeek = currentDay.day();

                    const relevantWeeklyOffConfig = userWeeklyOffsResult.rows
                        .filter(row => moment.utc(row.effective_date).isSameOrBefore(currentDay, 'day'))
                        .sort((a, b) => moment.utc(b.effective_date).diff(moment.utc(a.effective_date)))[0];

                    let isWeeklyOffForThisDay = false;
                    if (relevantWeeklyOffConfig && Array.isArray(relevantWeeklyOffConfig.weekly_off_days)) {
                        const woEffectiveDate = moment.utc(relevantWeeklyOffConfig.effective_date);
                        const woEndDate = relevantWeeklyOffConfig.end_date ? moment.utc(relevantWeeklyOffConfig.end_date) : null;

                        isWeeklyOffForThisDay = relevantWeeklyOffConfig.weekly_off_days.includes(dayOfWeek) &&
                                                currentDay.isSameOrAfter(woEffectiveDate, 'day') &&
                                                (!woEndDate || currentDay.isSameOrBefore(woEndDate, 'day'));
                    }

                    const isHoliday = holidayDates.has(dateStr);

                    if (!isWeeklyOffForThisDay && !isHoliday) {
                        // CRITICAL FIX: Pass leaveDuration if it's a partial day, otherwise 1.0 for full day
                        const dailyDurationToMark = (leaveDuration < 1 && fromDate.isSame(toDate, 'day')) ? leaveDuration : 1.0;
                        await client.query(
                            `INSERT INTO attendance (user_id, employee_id, date, status, daily_leave_duration)
                             VALUES ($1, $2, $3, $4, $5::NUMERIC)
                             ON CONFLICT (user_id, date) DO UPDATE SET status = EXCLUDED.status, daily_leave_duration = EXCLUDED.daily_leave_duration
                             WHERE attendance.status != 'present';`,
                            [user_id, leave.employee_id, dateStr, (isPaidLeave ? 'on_leave' : 'lop'), dailyDurationToMark]
                        );
                    }
                    currentDay.add(1, 'day');
                }
            } else {
                console.log(`[LEAVE_APPROVAL_DEBUG] Leave status is '${leave.current_status}', not 'pending'. No balance deduction for approval.`);
            }
            notificationMessage = `Your leave application for ${leave.from_date} to ${leave.to_date} (${leaveTypeName}) has been approved.`;
            notificationType = 'leave_approved';

        } else if (status === 'rejected') {
            console.log(`[LEAVE_APPROVAL_DEBUG] Processing 'rejected' status.`);
            notificationMessage = `Your leave application for ${leave.from_date} to ${leave.to_date} (${leaveTypeName}) has been rejected. Admin comment: ${admin_comment || 'No comment provided.'}`;
            notificationType = 'leave_rejected';

            let currentDay = fromDate.clone();
            while (currentDay.isSameOrBefore(toDate)) {
                const dateStr = currentDay.format('YYYY-MM-DD');
                const dayOfWeek = currentDay.day();

                const relevantWeeklyOffConfig = userWeeklyOffsResult.rows
                    .filter(row => moment.utc(row.effective_date).isSameOrBefore(currentDay, 'day'))
                    .sort((a, b) => moment.utc(b.effective_date).diff(moment.utc(a.effective_date)))[0];

                let isWeeklyOffForThisDay = false;
                if (relevantWeeklyOffConfig && Array.isArray(relevantWeeklyOffConfig.weekly_off_days)) {
                    isWeeklyOffForThisDay = relevantWeeklyOffConfig.weekly_off_days.includes(dayOfWeek);
                }

                const isHoliday = holidayDates.has(dateStr);

                if (!isWeeklyOffForThisDay && !isHoliday) {
                    // When rejected, if it was previously marked as on_leave/lop, reset daily_leave_duration to 0
                    await client.query(
                        `INSERT INTO attendance (user_id, employee_id, date, status, daily_leave_duration) VALUES ($1, $2, $3, $4, $5::NUMERIC)
                         ON CONFLICT (user_id, date) DO UPDATE SET status = $4, daily_leave_duration = EXCLUDED.daily_leave_duration WHERE attendance.status != 'present'`,
                        [user_id, leave.employee_id, dateStr, 'absent', 0.0] // Set to 0.0 when rejected
                    );
                }
                currentDay.add(1, 'day');
            }

        } else if (status === 'cancelled') {
            console.log(`[LEAVE_APPROVAL_DEBUG] Processing 'cancelled' status.`);
            if (leave.current_status === 'approved' || leave.current_status === 'cancellation_pending') {
                console.log(`[LEAVE_APPROVAL_DEBUG] Leave was previously '${leave.current_status}'. Checking if processed as paid for refund.`);
                if (leave.is_processed_as_paid === true) {
                    // Refund to the specific leave type balance
                    const balanceResult = await client.query( // Re-fetch balance for refund calculation
                        'SELECT current_balance FROM leave_balances WHERE user_id = $1 AND leave_type = $2',
                        [user_id, leaveTypeName]
                    );
                    console.log(`[LEAVE_APPROVAL_DEBUG] Raw balanceResult for refund for user ${user_id}, type ${leaveTypeName}:`, balanceResult.rows);

                    if (balanceResult.rows.length > 0) {
                        employeeCurrentBalance = parseFloat(balanceResult.rows[0].current_balance);
                        console.log(`[LEAVE_APPROVAL_DEBUG] Found existing balance for refund: ${employeeCurrentBalance}`);
                    } else {
                        console.warn(`[LEAVE_APPROVAL_DEBUG] No existing balance record found for refund for user ${user_id} and leave type ${leaveTypeName}. Assuming initial balance of 0 for refund calculation.`);
                    }

                    const newBalance = (employeeCurrentBalance + leaveDuration).toFixed(2);
                    console.log(`[LEAVE_APPROVAL_DEBUG] Refunding ${leaveDuration} to ${leaveTypeName} balance for user ${user_id}. New calculated balance: ${newBalance}`);
                    await client.query(
                        `INSERT INTO leave_balances (user_id, leave_type, current_balance, total_days_allocated)
                         VALUES ($1, $2, $3::NUMERIC, 0)
                         ON CONFLICT (user_id, leave_type) DO UPDATE SET
                             current_balance = EXCLUDED.current_balance,
                             last_updated = CURRENT_TIMESTAMP;`,
                        [user_id, leaveTypeName, newBalance]
                    );
                    console.log(`[LEAVE_APPROVAL_DEBUG] Leave balance refund query executed for user ${user_id}.`);
                } else {
                    console.log(`[LEAVE_APPROVAL_DEBUG] Leave was not processed as paid. No balance refund.`);
                }
                // Delete 'on_leave' or 'lop' attendance records for the cancelled period
                let currentDay = fromDate.clone();
                while (currentDay.isSameOrBefore(toDate)) {
                    const dateStr = currentDay.format('YYYY-MM-DD');
                    const dayOfWeek = currentDay.day();

                    const relevantWeeklyOffConfig = userWeeklyOffsResult.rows
                        .filter(row => moment.utc(row.effective_date).isSameOrBefore(currentDay, 'day'))
                        .sort((a, b) => moment.utc(b.effective_date).diff(moment.utc(a.effective_date)))[0];

                    let isWeeklyOffForThisDay = false;
                    if (relevantWeeklyOffConfig && Array.isArray(relevantWeeklyOffConfig.weekly_off_days)) {
                        isWeeklyOffForThisDay = relevantWeeklyOffConfig.weekly_off_days.includes(dayOfWeek);
                    }

                    const isHoliday = holidayDates.has(dateStr);

                    if (!isWeeklyOffForThisDay && !isHoliday) {
                        // When cancelling, reset daily_leave_duration to 0
                        await client.query(
                            `DELETE FROM attendance WHERE user_id = $1 AND date = $2 AND status IN ('on_leave', 'lop')`,
                            [user_id, dateStr]
                        );
                        // Optionally, if you want to keep the record and just reset duration:
                        // await client.query(
                        //     `UPDATE attendance SET daily_leave_duration = 0.0 WHERE user_id = $1 AND date = $2 AND status IN ('on_leave', 'lop')`,
                        //     [user_id, dateStr]
                        // );
                    }
                    currentDay.add(1, 'day');
                }
            } else {
                console.log(`[LEAVE_APPROVAL_DEBUG] Leave status is '${leave.current_status}', not 'approved' or 'cancellation_pending'. No balance refund for cancellation.`);
            }
            notificationMessage = `Your leave application for ${leave.from_date} to ${leave.to_date} (${leaveTypeName}) has been cancelled.`;
            notificationType = 'leave_cancelled';

        } else if (status === 'cancellation_rejected') {
            console.log(`[LEAVE_APPROVAL_DEBUG] Processing 'cancellation_rejected' status.`);
            newLeaveStatus = 'approved';
            notificationMessage = `Your leave cancellation request for ${leave.from_date} to ${leave.to_date} (${leaveTypeName}) has been rejected. Your leave remains approved. Admin comment: ${admin_comment || 'No comment provided.'}`;
            notificationType = 'cancellation_rejected';
            // When cancellation is rejected, ensure daily_leave_duration is set back to the original leave duration if it was approved
            if (leave.current_status === 'cancellation_pending' && leave.is_processed_as_paid === true) {
                 const dailyDurationToMark = (leaveDuration < 1 && fromDate.isSame(toDate, 'day')) ? leaveDuration : 1.0;
                 let currentDay = fromDate.clone();
                 while (currentDay.isSameOrBefore(toDate)) {
                     const dateStr = currentDay.format('YYYY-MM-DD');
                     const dayOfWeek = currentDay.day();

                     const relevantWeeklyOffConfig = userWeeklyOffsResult.rows
                         .filter(row => moment.utc(row.effective_date).isSameOrBefore(currentDay, 'day'))
                         .sort((a, b) => moment.utc(b.effective_date).diff(moment.utc(a.effective_date)))[0];

                     let isWeeklyOffForThisDay = false;
                     if (relevantWeeklyOffConfig && Array.isArray(relevantWeeklyOffConfig.weekly_off_days)) {
                         isWeeklyOffForThisDay = relevantWeeklyOffConfig.weekly_off_days.includes(dayOfWeek);
                     }

                     const isHoliday = holidayDates.has(dateStr);

                     if (!isWeeklyOffForThisDay && !isHoliday) {
                         await client.query(
                             `UPDATE attendance SET status = 'on_leave', daily_leave_duration = $4::NUMERIC WHERE user_id = $1 AND date = $2`,
                             [user_id, dateStr, dailyDurationToMark]
                         );
                     }
                     currentDay.add(1, 'day');
                 }
            }
        }

        const updateLeaveQuery = `
            UPDATE leave_applications
            SET status = $1, admin_comment = $2, is_processed_as_paid = $4
            WHERE id = $3
            RETURNING *;
        `;
        const result = await client.query(updateLeaveQuery, [newLeaveStatus, admin_comment || null, id, processedAsPaidFlag]);

        await client.query(
            `INSERT INTO notifications (user_id, message, is_read, is_admin_notification, type)
             VALUES ($1, $2, FALSE, TRUE, $3);`,
            [user_id, notificationMessage, notificationType]
        );

        await client.query('COMMIT');
        res.status(200).json({ message: `Leave application status updated to ${status}.`, leave: result.rows[0] });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating leave application status:', error.message, error.stack);
        res.status(500).json({ message: 'Server error updating leave application status: ' + error.message });
    } finally {
        client.release();
    }
});

// --- Leave Balance Management (Admin) ---

// Admin: Get all leave balances for all employees
router.get('/leave-balances', authenticate, authorizeAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT lb.*, u.name, u.employee_id
            FROM leave_balances lb
            JOIN users u ON lb.user_id = u.id
            ORDER BY u.name
        `);
        console.log("DEBUG Backend: Successfully fetched all leave balances."); // ADD THIS DEBUG LOG
        res.json(result.rows);
    } catch (err) {
        console.error("ERROR Backend: Admin Fetch All Leave Balances Error:", err.message, err.stack); // ENHANCED ERROR LOGGING
        res.status(500).json({ message: 'Server error fetching all leave balances.' });
    }
});



// Admin: Update an employee's leave balance
router.put('/leave-balances/:userId', authenticate, authorizeAdmin, async (req, res) => {
    const { userId } = req.params; // Get userId from URL parameter
    const { casual_leave, sick_leave, earned_leave } = req.body; // Get updated balances from request body

    console.log(`DEBUG Backend: Received PUT request to update leave balance for userId: ${userId}`);
    console.log("DEBUG Backend: Received data:", { casual_leave, sick_leave, earned_leave });

    try {
        const result = await pool.query(
            'UPDATE leave_balances SET casual_leave = $1, sick_leave = $2, earned_leave = $3 WHERE user_id = $4 RETURNING *',
            [casual_leave, sick_leave, earned_leave, userId]
        );

        if (result.rows.length === 0) {
            // This means no record was found for the given user_id in leave_balances
            console.log(`DEBUG Backend: No existing leave balance record found for user_id: ${userId}.`);
            // Consider adding a POST route for initial creation if it's not handled during user registration
            return res.status(404).json({ message: 'Leave balance not found for this user. Ensure an initial balance record exists.' });
        }

        console.log("DEBUG Backend: Leave balance updated successfully:", result.rows[0]);
        res.status(200).json({ message: 'Leave balances updated successfully!', balance: result.rows[0] });
    } catch (err) {
        console.error("ERROR Backend: Admin Update Leave Balance Error:", err.message, err.stack);
        res.status(500).json({ message: 'Server error updating leave balances.' });
    }
});

router.post('/leave-balances', authenticate, authorizeAdmin, async (req, res) => {
  const { user_id, leave_type, amount, total_days_allocated, operation } = req.body;

  console.log(`DEBUG Backend: Received POST request to adjust leave balance for user_id: ${user_id}`);
  console.log("DEBUG Backend: Received data:", { leave_type, amount, total_days_allocated, operation });

  if (!user_id || !leave_type || amount === undefined || total_days_allocated === undefined) {
    return res.status(400).json({ message: 'User ID, leave type, amount, and total_days_allocated are required.' });
  }

  try {
    await pool.query('BEGIN');

    const existingBalance = await pool.query(
      'SELECT * FROM leave_balances WHERE user_id = $1 AND leave_type = $2 FOR UPDATE',
      [user_id, leave_type]
    );

    if (existingBalance.rows.length > 0) {
      const updateQuery = `
        UPDATE leave_balances
        SET current_balance = $1, total_days_allocated = $2, last_updated = CURRENT_TIMESTAMP
        WHERE user_id = $3 AND leave_type = $4
        RETURNING *;
      `;
      await pool.query(updateQuery, [amount, total_days_allocated, user_id, leave_type]);
    } else {
      const insertQuery = `
        INSERT INTO leave_balances (user_id, leave_type, current_balance, total_days_allocated)
        VALUES ($1, $2, $3, $4) RETURNING *;
      `;
      await pool.query(insertQuery, [user_id, leave_type, amount, total_days_allocated]);
    }

    await pool.query('COMMIT');

    console.log("DEBUG Backend: Leave balance adjusted successfully.");
    res.status(200).json({ message: 'Leave balance adjusted successfully!' });

  } catch (error) {
    await pool.query('ROLLBACK');
    console.error("ERROR Backend: Adjust Leave Balance Error:", error.message, error.stack);
    res.status(500).json({ message: 'Server error adjusting leave balance.' });
  }
});


// Admin: Delete a leave balance record
router.delete('/leave-balances', authenticate, authorizeAdmin, async (req, res) => {
    // Expect user_id and leave_type from the request body
    const { userId, leaveType } = req.body; 

    if (!userId || !leaveType) {
        return res.status(400).json({ message: 'User ID and Leave Type are required to delete a leave balance record.' });
    }

    const client = await pool.connect();
    try {
        const { rowCount } = await client.query(
            'DELETE FROM leave_balances WHERE user_id = $1 AND leave_type = $2',
            [userId, leaveType]
        );
        if (rowCount === 0) {
            return res.status(404).json({ message: 'Leave balance record not found for the specified user and leave type.' });
        }
        res.status(200).json({ message: 'Leave balance record deleted successfully.' });
    } catch (error) {
        console.error('Error deleting leave balance record:', error.message, error.stack);
        res.status(500).json({ message: 'Server error deleting leave balance record.' });
    } finally {
        client.release();
    }
});

// --- Notification Management (Admin) ---

router.post('/notifications/global', authenticate, authorizeAdmin, async (req, res) => {
    const { message, type } = req.body; // 'type' is optional, e.g., 'info', 'warning', 'success', 'error'

    if (!message || message.trim() === '') {
        return res.status(400).json({ message: 'Notification message cannot be empty.' });
    }

    const client = await pool.connect();
    try {
        // Fetch all user IDs
        // Removed 'WHERE is_active = TRUE' condition as the column does not exist
        const usersResult = await client.query('SELECT id FROM users');
        const userIds = usersResult.rows.map(row => row.id);

        if (userIds.length === 0) {
            return res.status(404).json({ message: 'No users found to send global notification to.' });
        }

        // Prepare insert promises for each user
        const notificationPromises = userIds.map(userId => {
            return client.query(
                'INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)',
                [userId, message, type || 'info'] // Default to 'info' if type is not provided
            );
        });

        // Execute all insert promises concurrently
        await Promise.all(notificationPromises);

        res.status(200).json({ message: `Global notification sent to ${userIds.length} users.` });

    } catch (error) {
        console.error('Error sending global notification:', error.message, error.stack);
        res.status(500).json({ message: 'Server error sending global notification.' });
    } finally {
        client.release();
    }
});

router.post('/notifications/send', authenticate, authorizeAdmin, async (req, res) => {
  const { userId, message } = req.body;
  if (!userId || !message) {
    return res.status(400).json({ message: 'User ID and message are required for a specific notification.' });
  }
  try {
    // Verify user exists
    const userExists = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userExists.rows.length === 0) {
      return res.status(404).json({ message: 'Target user not found.' });
    }

    const result = await pool.query(
      'INSERT INTO notifications (user_id, message) VALUES ($1, $2) RETURNING *',
      [userId, message]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error sending specific notification:', error.message, error.stack);
    res.status(500).json({ message: 'Server error sending specific notification.' });
  }
});


// --- Correction Management (Admin) ---

router.get('/corrections', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { status, userId } = req.query;
    let queryText = `
      SELECT ac.*, u.name as user_name, u.employee_id
      FROM corrections ac
      JOIN users u ON ac.user_id = u.id
    `;
    const params = [];
    const conditions = [];
    if (status) {
      conditions.push(`ac.status = $${params.length + 1}`);
      params.push(status);
    }
    if (userId) {
      conditions.push(`ac.user_id = $${params.length + 1}`);
      params.push(userId);
    }
    if (conditions.length > 0) {
      queryText += ` WHERE ` + conditions.join(' AND ');
    }
    queryText += ` ORDER BY ac.created_at DESC`;

    const { rows } = await pool.query(queryText, params);
    res.json(rows);
  } catch (error) {
    console.error('Admin get all corrections error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error getting all corrections.' });
  }
});

// Admin: Review and approve/reject attendance correction requests
router.post('/attendance/correction-review', authenticate, authorizeAdmin, async (req, res) => {
    const { id, status, admin_comment, date, userId, expected_check_in, expected_check_out } = req.body; // Added date, userId, expected_check_in, expected_check_out

    if (!id || !status || !['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Correction request ID and a valid status (approved/rejected) are required.' });
    }

    const client = await pool.connect(); // Get a client from the pool for transaction
    try {
        await client.query('BEGIN'); // Start transaction

        // 1. Update the correction request status
        const updateCorrectionQuery = `
            UPDATE corrections
            SET status = $1, admin_comment = $2, reviewed_by = $3, reviewed_at = CURRENT_TIMESTAMP
            WHERE id = $4 AND status = 'pending'
            RETURNING *;
        `;
        const updateCorrectionResult = await client.query(updateCorrectionQuery, [status, admin_comment || null, req.user.id, id]);

        if (updateCorrectionResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Correction request not found or already reviewed.' });
        }

        const reviewedCorrection = updateCorrectionResult.rows[0];

        // 2. If approved, update or insert into the attendance table
        if (status === 'approved') {
            // Fetch the user's shift type to determine expected check-in time
            const userShiftResult = await client.query('SELECT shift_type FROM users WHERE id = $1', [reviewedCorrection.user_id]);
            const userShiftType = userShiftResult.rows[0]?.shift_type || 'day'; // Default to 'day'

            // Define expected shift start time based on shift type (customize as needed)
            let expectedShiftStartTime = '09:00:00'; // Default for 'day' shift
            if (userShiftType === 'evening') {
                expectedShiftStartTime = '17:00:00'; // Example for 'evening' shift
            }

            // Calculate metrics based on requested times
            const { lateTime, workingHours, extraHours, status: newAttendanceStatus } = calculateAttendanceMetrics(
                expected_check_in,
                expected_check_out,
                expectedShiftStartTime
            );

            // Check if an attendance record already exists for this user and date
            const existingAttendance = await client.query(
                `SELECT * FROM attendance WHERE user_id = $1 AND date = $2`,
                [reviewedCorrection.user_id, reviewedCorrection.date]
            );

            if (existingAttendance.rows.length > 0) {
                // Update existing attendance record
                const updateAttendanceQuery = `
                    UPDATE attendance
                    SET
                        check_in = $1,
                        check_out = $2,
                        status = $3,
                        late_time = $4,
                        working_hours = $5,
                        extra_hours = $6,
                        admin_corrected_request_id = $7,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = $8 AND date = $9
                    RETURNING *;
                `;
                await client.query(updateAttendanceQuery, [
                    expected_check_in,
                    expected_check_out,
                    newAttendanceStatus,
                    lateTime,
                    workingHours,
                    extraHours,
                    reviewedCorrection.id, // Link to the approved correction
                    reviewedCorrection.user_id,
                    reviewedCorrection.date
                ]);
            } else {
                // Insert new attendance record
                const insertAttendanceQuery = `
                    INSERT INTO attendance (
                        user_id, date, check_in, check_out, status,
                        late_time, working_hours, extra_hours, admin_corrected_request_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    RETURNING *;
                `;
                await client.query(insertAttendanceQuery, [
                    reviewedCorrection.user_id,
                    reviewedCorrection.date,
                    expected_check_in,
                    expected_check_out,
                    newAttendanceStatus,
                    lateTime,
                    workingHours,
                    extraHours,
                    reviewedCorrection.id // Link to the approved correction
                ]);
            }

            // 3. Create a notification for the employee
            await client.query(
                `INSERT INTO notifications (user_id, message, is_read, is_admin_notification, type)
                 VALUES ($1, $2, FALSE, TRUE, 'correction_approved');`,
                [reviewedCorrection.user_id, `Your attendance correction request for ${reviewedCorrection.date} has been approved. Your attendance record has been updated.`]
            );

        } else { // status === 'rejected'
            // 3. Create a notification for the employee
            await client.query(
                `INSERT INTO notifications (user_id, message, is_read, is_admin_notification, type)
                 VALUES ($1, $2, FALSE, TRUE, 'correction_rejected');`,
                [reviewedCorrection.user_id, `Your attendance correction request for ${reviewedCorrection.date} has been rejected. Admin comment: ${admin_comment || 'No comment provided.'}`]
            );
        }

        await client.query('COMMIT'); // Commit transaction
        res.status(200).json({ message: `Correction request ${status} successfully.` });

    } catch (error) {
        await client.query('ROLLBACK'); // Rollback transaction on error
        console.error('Error reviewing correction request:', error);
        res.status(500).json({ message: 'Server error reviewing correction request.' });
    } finally {
        client.release(); // Release the client back to the pool
    }
});

// --- Attendance Management (Admin) ---

router.get('/attendance', authenticate, authorizeAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { date } = req.query;
    const targetDate = date && moment(date).isValid() ? moment(date).format('YYYY-MM-DD') : moment().tz('Asia/Kolkata').format('YYYY-MM-DD');

    // Fetch all employees
    const usersResult = await client.query('SELECT id, name, employee_id, shift_type FROM users WHERE role = $1', ['employee']);
    const allEmployees = usersResult.rows;

    // Fetch attendance for the target date
    const attendanceResult = await client.query(
      'SELECT user_id, check_in, check_out, status, check_in_device, check_out_device, working_hours, late_time, extra_hours FROM attendance WHERE date = $1',
      [targetDate]
    );
    const dailyAttendanceMap = new Map(attendanceResult.rows.map(att => [att.user_id, att]));

    // Fetch leaves for the target date
    const leavesResult = await client.query(
      `SELECT user_id, status, is_half_day FROM leave_applications WHERE $1 BETWEEN from_date AND to_date AND status IN ('approved', 'overridden_by_correction', 'cancellation_pending')`,
      [targetDate]
    );
    const dailyLeavesMap = new Map(leavesResult.rows.map(leave => [leave.user_id, leave]));

    // Fetch holidays for the target date
    // Corrected column name to holiday_date
    const holidayResult = await client.query('SELECT 1 FROM holidays WHERE holiday_date = $1', [targetDate]);
    const isHoliday = holidayResult.rows.length > 0;

    // Fetch weekly offs for all employees for the target day of week, considering effective dates
    const dayOfWeekNum = moment(targetDate).day(); // 0 for Sunday, 6 for Saturday
    const weeklyOffsResult = await client.query(
      `SELECT user_id, weekly_off_days, effective_date FROM weekly_offs WHERE effective_date <= $1`,
      [targetDate]
    );
    const weeklyOffUsersMap = new Map(); // Map user_id to their relevant weekly_off_days array
    weeklyOffsResult.rows.forEach(row => {
        const userId = row.user_id;
        const effectiveDate = moment(row.effective_date);
        // Only keep the most recent effective config for each user
        if (!weeklyOffUsersMap.has(userId) || effectiveDate.isAfter(weeklyOffUsersMap.get(userId).effectiveDate)) {
            weeklyOffUsersMap.set(userId, {
                effectiveDate: effectiveDate,
                weeklyOffDays: row.weekly_off_days
            });
        }
    });


    const detailedAttendance = allEmployees.map(user => {
      const attendanceRecord = dailyAttendanceMap.get(user.id);
      const leaveRecord = dailyLeavesMap.get(user.id);

      let status = 'ABSENT';
      let check_in = null;
      let check_out = null;
      let late_time = '0 min';
      let working_hours = '0 hrs';
      let extra_hours = '0 hrs';
      let check_in_device = null;
      let check_out_device = null;

      // Determine if the current day is a weekly off for this user
      let isUserWeeklyOff = false;
      const userWeeklyOffConfig = weeklyOffUsersMap.get(user.id);
      if (userWeeklyOffConfig && Array.isArray(userWeeklyOffConfig.weeklyOffDays)) {
          isUserWeeklyOff = userWeeklyOffConfig.weeklyOffDays.includes(dayOfWeekNum);
      }

      // Determine status based on hierarchy: Holiday/Weekly Off > Leave > Attendance
      if (isHoliday) {
        status = 'HOLIDAY';
      } else if (isUserWeeklyOff) {
        status = 'WEEKLY OFF';
      } else if (leaveRecord) {
        if (leaveRecord.status === 'approved') {
          status = leaveRecord.is_half_day ? 'HALF DAY LEAVE' : 'ON LEAVE';
        } else if (leaveRecord.status === 'cancellation_pending') {
          status = 'LEAVE CANCELLATION PENDING';
        } else if (leaveRecord.status === 'overridden_by_correction') {
          status = 'PRESENT BY CORRECTION'; // Correction overrides leave for that day
        }
      }

      // If there's an attendance record, it provides actual check-in/out times and potentially overrides status
      if (attendanceRecord) {
        const checkInMoment = attendanceRecord.check_in ? moment(attendanceRecord.check_in, 'HH:mm:ss') : null;
        const checkOutMoment = attendanceRecord.check_out ? moment(attendanceRecord.check_out, 'HH:mm:ss') : null;

        check_in = checkInMoment ? checkInMoment.format('hh:mm A') : 'N/A';
        check_out = checkOutMoment ? checkOutMoment.format('hh:mm A') : 'N/A';
        check_in_device = attendanceRecord.check_in_device || 'N/A';
        check_out_device = attendanceRecord.check_out_device || 'N/A';

        late_time = `${attendanceRecord.late_time || 0} min`;
        working_hours = `${attendanceRecord.working_hours || 0} hrs`;
        extra_hours = `${attendanceRecord.extra_hours || 0} hrs`;

        // Use attendance status if it's not a holiday, weekly off, or leave
        if (!isHoliday && !isUserWeeklyOff && !leaveRecord) {
          status = String(attendanceRecord.status || 'unknown').replace(/_/g, ' ').toUpperCase();
        }
      }

      return {
        user_id: user.id,
        name: user.name,
        employee_id: user.employee_id,
        shift_type: user.shift_type,
        status: status,
        check_in: check_in,
        check_out: check_out,
        late_time: late_time,
        working_hours: working_hours,
        extra_hours: extra_hours,
        check_in_device: check_in_device,
        check_out_device: check_out_device,
      };
    });

    res.json(detailedAttendance);
  } catch (error) {
    console.error('Error in /api/admin/attendance:', error.message, error.stack);
    res.status(500).json({ message: `Server error fetching admin attendance: ${error.message}` });
  } finally {
    client.release();
  }
});

// Admin: Get monthly attendance summary for all employees
router.get('/monthly-summary', authenticate, authorizeAdmin, async (req, res) => {
    const { month, year } = req.query;

    if (!month || !year) {
        return res.status(400).json({ message: 'Month and year are required for monthly summary.' });
    }

    const client = await pool.connect();
    try {
        const targetMonth = parseInt(month, 10);
        const targetYear = parseInt(year, 10);

        if (isNaN(targetMonth) || targetMonth < 1 || targetMonth > 12 || isNaN(targetYear)) {
            return res.status(400).json({ message: 'Invalid month or year provided.' });
        }

        // Fetch all users
        const usersResult = await client.query('SELECT id, name, employee_id, shift_type FROM users ORDER BY name ASC');
        const users = usersResult.rows;

        const monthlySummary = [];

        for (const user of users) {
            const userId = user.id;
            const employeeId = user.employee_id;
            const userName = user.name;

            // Use the shared calculateAttendanceSummary helper
            const summary = await calculateAttendanceSummary(userId, targetYear, targetMonth, client);

            monthlySummary.push({
                user_id: userId,
                user_name: userName,
                employee_id: employeeId,
                present_days: summary.presentDays,
                late_days: summary.lateDays,
                absent_days: summary.absentDays,
                leave_days: summary.leaveDays, // Paid leaves
                lop_days: summary.lopDays,     // Unpaid leaves
                holidays: summary.holidaysCount,
                weekly_offs: summary.actualWeeklyOffDays,
                total_working_hours: summary.totalWorkingHours,
                average_daily_hours: summary.averageDailyHours,
                total_expected_working_days: summary.totalWorkingDaysInMonth,
                paid_days_for_payroll: summary.paidDays, // This is the crucial one for payroll
                unpaid_leaves_for_payroll: summary.unpaidLeaves // This is the crucial one for payroll
            });
        }

        res.status(200).json(monthlySummary);

    } catch (error) {
        console.error('Error fetching monthly summary (admin):', error);
        res.status(500).json({ message: 'Server error fetching monthly summary.' });
    } finally {
        client.release();
    }
});


router.get('/export-attendance', authenticate, authorizeAdmin, async (req, res) => {
    try {
        const { year, month, employee_id } = req.query;
        if (!year || !month) {
            return res.status(400).json({ message: 'Year and month are required for export.' });
        }

        let userId = null;
        let empIdForHeader = '';
        let userNameForHeader = 'All Employees';

        if (employee_id) {
            const userResult = await pool.query('SELECT id, name, employee_id FROM users WHERE employee_id = $1', [employee_id]);
            if (userResult.rows.length > 0) {
                userId = userResult.rows[0].id;
                empIdForHeader = userResult.rows[0].employee_id;
                userNameForHeader = userResult.rows[0].name;
            } else {
                return res.status(404).json({ message: 'Employee not found.' });
            }
        }

        const startDate = moment().tz('Asia/Kolkata').year(parseInt(year)).month(parseInt(month) - 1).startOf('month');
        const endDate = startDate.clone().endOf('month');

        // Fetch all users (or specific user if filtered)
        let usersQuery = 'SELECT id, name, employee_id, shift_type FROM users';
        const usersQueryParams = [];
        if (userId) {
            usersQuery += ' WHERE id = $1';
            usersQueryParams.push(userId);
        }
        usersQuery += ' ORDER BY name';
        const usersResult = await pool.query(usersQuery, usersQueryParams);
        const usersToExport = usersResult.rows;

        // Helper function to escape CSV values
        const escapeCsvValue = (value) => {
            if (value === null || value === undefined) {
                return '';
            }
            let stringValue = String(value);
            // Always enclose in double quotes, and escape internal double quotes by doubling them
            return `"${stringValue.replace(/"/g, '""')}"`;
        };

        // Define the CSV delimiter (default to semicolon for wider Excel compatibility)
        const csvDelimiter = ';'; // CRITICAL FIX: Changed to semicolon

        // Add UTF-8 BOM to ensure proper character encoding in Excel
        let csvContent = '\uFEFF'; // UTF-8 BOM
        // ADDED: Excel-specific separator hint
        csvContent += `sep=${csvDelimiter}\r\n`; // CRITICAL FIX: Added sep=; line

        // Ensure header uses the defined csvDelimiter and all fields are quoted
        csvContent += `${escapeCsvValue('Employee Name')}${csvDelimiter}${escapeCsvValue('Employee ID')}${csvDelimiter}${escapeCsvValue('Date')}${csvDelimiter}${escapeCsvValue('Day')}${csvDelimiter}${escapeCsvValue('Check-In')}${csvDelimiter}${escapeCsvValue('Check-Out')}${csvDelimiter}${escapeCsvValue('Late Time')}${csvDelimiter}${escapeCsvValue('Working Hours')}${csvDelimiter}${escapeCsvValue('Extra Hours')}${csvDelimiter}${escapeCsvValue('Status')}${csvDelimiter}${escapeCsvValue('Daily Leave Duration')}${csvDelimiter}${escapeCsvValue('Check-In Device')}${csvDelimiter}${escapeCsvValue('Check-Out Device')}\r\n`; // Applied escapeCsvValue to header fields

        for (const user of usersToExport) {
            // Use the calculateAttendanceSummary to get daily statuses for the month
            const summary = await calculateAttendanceSummary(user.id, parseInt(year), parseInt(month), pool);
            const dailyStatusMap = summary.dailyStatusMap;

            let currentDay = startDate.clone();
            while (currentDay.isSameOrBefore(endDate)) {
                const dateStr = currentDay.format('YYYY-MM-DD');
                const dayOfWeek = currentDay.format('dddd');
                const status = dailyStatusMap[dateStr] || 'N/A';

                // Fetch actual attendance record for this specific day to get times and devices
                const attendanceRecordResult = await pool.query(
                    `SELECT check_in, check_out, late_time, working_hours, extra_hours, check_in_device, check_out_device, daily_leave_duration
                     FROM attendance WHERE user_id = $1 AND date = $2`,
                    [user.id, dateStr]
                );
                const record = attendanceRecordResult.rows[0] || {};

                const check_in = record.check_in ? moment(record.check_in, 'HH:mm:ss').format('hh:mm A') : '';
                const check_out = record.check_out ? moment(record.check_out, 'HH:mm:ss').format('hh:mm A') : '';
                const late_time = record.late_time ? `${record.late_time} min` : '0 min';
                const working_hours = record.working_hours ? `${record.working_hours} hrs` : '0 hrs';
                const extra_hours = record.extra_hours ? `${record.extra_hours} hrs` : '0 hrs';
                let daily_leave_duration_val = parseFloat(record.daily_leave_duration);
                const daily_leave_duration = isNaN(daily_leave_duration_val) ? '0.0' : daily_leave_duration_val.toFixed(1);

                const check_in_device = record.check_in_device || 'N/A';
                const check_out_device = record.check_out_device || 'N/A';

                // Ensure all values are escaped and delimited correctly
                csvContent += `${escapeCsvValue(user.name)}${csvDelimiter}${escapeCsvValue(user.employee_id)}${csvDelimiter}${escapeCsvValue(dateStr)}${csvDelimiter}${escapeCsvValue(dayOfWeek)}${csvDelimiter}${escapeCsvValue(check_in)}${csvDelimiter}${escapeCsvValue(check_out)}${csvDelimiter}${escapeCsvValue(late_time)}${csvDelimiter}${escapeCsvValue(working_hours)}${csvDelimiter}${escapeCsvValue(extra_hours)}${csvDelimiter}${escapeCsvValue(status)}${csvDelimiter}${escapeCsvValue(daily_leave_duration)}${csvDelimiter}${escapeCsvValue(check_in_device)}${csvDelimiter}${escapeCsvValue(check_out_device)}\r\n`; // Applied escapeCsvValue to all data fields
                currentDay.add(1, 'day');
            }
        }

        console.log(`[CSV_EXPORT_DEBUG] First 500 characters of CSV content:\n${csvContent.substring(0, 500)}`);

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="attendance_${year}_${month}${empIdForHeader ? `_${empIdForHeader}` : ''}.csv"`);
        res.send(csvContent);
    } catch (error) {
        console.error('Error exporting attendance:', error.message, error.stack);
        res.status(500).json({ message: 'Server error exporting attendance.' });
    }
});


router.post('/attendance/mark-absent-forgotten-checkout', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { date, userId, adminReason } = req.body;
    const targetDate = date || moment().tz('Asia/Kolkata').format('YYYY-MM-DD');

    console.log('--- DEBUGGING mark-absent-forgotten-checkout ---');
    console.log('Received date (req.body.date):', date);
    console.log('Received userId (req.body.userId):', userId);
    console.log('Received adminReason (req.body.adminReason):', adminReason);
    console.log('Constructed targetDate:', targetDate, ' (Type:', typeof targetDate, ')');
    console.log('UserId being pushed to params:', userId, ' (Type:', typeof userId, ')');

    let queryText = `
      UPDATE attendance
      SET status = 'absent',
          check_out = NULL,
          working_hours = 0, -- Reset working hours
          extra_hours = 0,   -- Reset extra hours
          admin_comment = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE date = $1
        AND check_in IS NOT NULL
        AND check_out IS NULL
        AND status NOT IN ('on_leave', 'lop', 'half-day')
    `;

    const queryParams = [targetDate, adminReason];

    if (userId) {
      queryText += ` AND user_id = $3`;
      queryParams.push(userId);
    }

    queryText += ` RETURNING user_id, date, status`;

    console.log('Final queryText sent to DB:', queryText);
    console.log('Final queryParams sent to DB:', queryParams);

    const result = await pool.query(queryText, queryParams);

    console.log('Notification successful, rows updated:', result.rows.length);
    console.log('--- END DEBUGGING ---');

    for (const row of result.rows) {
      const notificationMessage = `Your attendance for ${row.date} was marked as absent due to forgotten checkout by admin. Reason: ${adminReason || 'Not specified'}.`;
      await pool.query(
        'INSERT INTO notifications (user_id, message) VALUES ($1, $2)',
        [row.user_id, notificationMessage]
      );
    }
    res.json({ message: `Marked ${result.rows.length} records as absent for ${targetDate}${userId ? ` for user ${userId}` : ''}.` });
  } catch (error) {
    console.error('Error marking forgotten checkouts:', error.message, error.stack);
    res.status(500).json({ message: 'Server error marking forgotten checkouts.' });
  }
});

// Admin: Manually Add/Update Attendance Record
router.post('/manual-attendance-entry', authenticate, authorizeAdmin, async (req, res) => {
  const {
    user_id, date, check_in, check_out, status, late_time,
    working_hours, extra_hours, check_in_device, check_out_device,
    reason, admin_comment
  } = req.body;

  if (!user_id || !date || !check_in || !status) {
    return res.status(400).json({ message: 'User ID, date, check-in, and status are required for manual entry.' });
  }

  try {
    // Check if a record for this user and date already exists
    const existingRecord = await pool.query(
      'SELECT id FROM attendance WHERE user_id = $1 AND date = $2',
      [user_id, date]
    );

    if (existingRecord.rows.length > 0) {
      // Update existing record
      await pool.query(
        `UPDATE attendance SET
           check_in = $3, check_out = $4, status = $5, late_time = $6,
           working_hours = $7, extra_hours = $8, check_in_device = $9,
           check_out_device = $10, reason = $11, admin_comment = $12,
           updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND date = $2 RETURNING *`,
        [user_id, date, check_in, check_out, status, late_time,
         working_hours, extra_hours, check_in_device, check_out_device,
         reason, admin_comment]
      );
      res.status(200).json({ message: 'Attendance record updated successfully.' });
    } else {
      // Insert new record
      await pool.query(
        `INSERT INTO attendance (
           user_id, date, check_in, check_out, status, late_time,
           working_hours, extra_hours, check_in_device, check_out_device,
           reason, admin_comment
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [user_id, date, check_in, check_out, status, late_time,
         working_hours, extra_hours, check_in_device, check_out_device,
         reason, admin_comment]
      );
      res.status(201).json({ message: 'Attendance record added successfully.' });
    }
  } catch (error) {
    console.error('Error in manual attendance entry:', error);
    res.status(500).json({ message: 'Server error in manual attendance entry.' });
  }
});

// GET /api/admin/attendance/summary/:userId/:year/:month - Get attendance summary for a specific employee and month
router.get('/attendance/summary/:userId/:year/:month', authenticate, authorizeAdmin, async (req, res) => {
    const { userId, year, month } = req.params;
    const client = await pool.connect();
    try {
        const summary = await calculateAttendanceSummary(userId, parseInt(year), parseInt(month), client);
        res.json(summary);
    } catch (error) {
        console.error('Error fetching employee attendance summary:', error.message, error.stack);
        res.status(500).json({ message: 'Server error fetching attendance summary.' });
    } finally {
        client.release();
    }
});

// --- Admin Dashboard Stats ---

router.get('/stats', authenticate, authorizeAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        // 1. Total Employees
        // Removed 'WHERE is_active = TRUE' condition to prevent errors if column is missing
        const totalEmployeesResult = await client.query('SELECT COUNT(id) FROM users');
        const totalEmployees = parseInt(totalEmployeesResult.rows[0].count, 10);
        console.log(`[ADMIN_STATS_DEBUG] Calculated totalEmployees: ${totalEmployees}`); // ADD THIS LOG

        // 2. Today's Attendance (Present, Absent, On Leave)
        const today = moment.utc().startOf('day').format('YYYY-MM-DD');

        // Fetch all attendance records for today
        const todayAttendanceResult = await client.query(
            `SELECT user_id, status, working_hours FROM attendance WHERE date = $1`,
            [today]
        );
        const todayAttendanceMap = new Map(
            todayAttendanceResult.rows.map(att => [att.user_id, att])
        );

        // Fetch all active users to determine their status today
        // Removed 'WHERE is_active = TRUE' condition
        const usersResult = await client.query('SELECT id FROM users');
        const activeUserIds = usersResult.rows.map(row => row.id);
        console.log(`[ADMIN_STATS_DEBUG] Fetched ${activeUserIds.length} activeUserIds for today's attendance.`); // ADD THIS LOG


        let presentToday = 0;
        let absentToday = 0;
        let onLeaveToday = 0;

        for (const userId of activeUserIds) {
            const record = todayAttendanceMap.get(userId);
            if (record) {
                switch (record.status.toUpperCase()) {
                    case 'PRESENT':
                    case 'LATE':
                    case 'HALF-DAY': // Count half-day as present for overall stats
                        presentToday++;
                        break;
                    case 'ON_LEAVE':
                        onLeaveToday++;
                        break;
                    case 'LOP': // LOP is also a form of leave, might count as on-leave or a separate category
                        onLeaveToday++; // Or handle as a distinct 'unpaidLeaveToday' if needed
                        break;
                    case 'ABSENT':
                        absentToday++;
                        break;
                    default:
                        // If status is unknown, consider it absent for today's count
                        absentToday++;
                        break;
                }
            } else {
                // If no record for an active user today, consider them absent
                absentToday++;
            }
        }
        console.log(`[ADMIN_STATS_DEBUG] Today's counts: Present: ${presentToday}, Absent: ${absentToday}, OnLeave: ${onLeaveToday}`); // ADD THIS LOG


        // 3. Total Working Hours (This Month) - Aggregating from monthly summaries
        // This will require calling the calculateAttendanceSummary for all users for the current month
        const currentMonth = moment.utc().month() + 1; // 1-indexed
        const currentYear = moment.utc().year();

        let grandTotalWorkingHours = 0;

        // Re-fetch all users to iterate for monthly summary aggregation
        // Removed 'WHERE is_active = TRUE' condition
        const allUsersForMonthlySummary = (await client.query('SELECT id FROM users')).rows;
        console.log(`[ADMIN_STATS_DEBUG] Fetched ${allUsersForMonthlySummary.length} users for monthly summary aggregation.`); // ADD THIS LOG


        // NOTE: This loop can be performance intensive if you have many users.
        for (const user of allUsersForMonthlySummary) {
            // Re-use the existing calculateAttendanceSummary helper
            const userSummary = await calculateAttendanceSummary(user.id, currentYear, currentMonth, client);
            grandTotalWorkingHours += (parseFloat(userSummary.totalWorkingHours) || 0);
        }
        console.log(`[ADMIN_STATS_DEBUG] Calculated grandTotalWorkingHours: ${grandTotalWorkingHours.toFixed(2)}`); // ADD THIS LOG


        // 4. Pending Leaves
        const pendingLeavesResult = await client.query(
            `SELECT COUNT(id) FROM leave_applications WHERE status = 'pending'` // Corrected table name to leave_applications
        );
        const pendingLeaveRequests = parseInt(pendingLeavesResult.rows[0].count, 10);
        console.log(`[ADMIN_STATS_DEBUG] Pending Leave Requests: ${pendingLeaveRequests}`); // ADD THIS LOG


        // 5. Pending Corrections (Assuming a 'corrections' table with a 'status' column)
        const pendingCorrectionsResult = await client.query(
            `SELECT COUNT(id) FROM corrections WHERE status = 'pending'` // Corrected table name to corrections
        );
        const pendingCorrectionRequests = parseInt(pendingCorrectionsResult.rows[0].count, 10);
        console.log(`[ADMIN_STATS_DEBUG] Pending Correction Requests: ${pendingCorrectionRequests}`); // ADD THIS LOG


        res.status(200).json({
            message: 'Admin stats fetched successfully',
            totalUsers: totalEmployees, // Changed to totalUsers to match frontend expectation
            presentToday: presentToday,
            absentToday: absentToday,
            onLeaveToday: onLeaveToday,
            grand_total_working_hours: grandTotalWorkingHours.toFixed(2), // Format for consistent display
            pending_leave_requests: pendingLeaveRequests,
            pending_correction_requests: pendingCorrectionRequests
        });

    } catch (error) {
        console.error('Error fetching overall admin stats:', error); // This is the log you need to check
        res.status(500).json({ message: 'Server error fetching overall admin statistics.' });
    } finally {
        client.release();
    }
});

// NEW ENDPOINT: Get employees with birthdays this month and create notifications
router.get('/employees/birthdays-this-month', authenticate, authorizeAdmin, async (req, res) => {
  const currentMonth = moment().tz('Asia/Kolkata').month() + 1; // getMonth() is 0-indexed
  const currentDay = moment().tz('Asia/Kolkata').date(); // Current day of the month

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN'); // Start transaction for atomicity

    // Fetch employees with birthdays in the current month
    const { rows: birthdayEmployees } = await client.query(
      `SELECT id, name, date_of_birth FROM users
       WHERE EXTRACT(MONTH FROM date_of_birth) = $1
       ORDER BY EXTRACT(DAY FROM date_of_birth) ASC`,
      [currentMonth]
    );

    const todayBirthdays = birthdayEmployees.filter(emp => moment(emp.date_of_birth).date() === currentDay);

    // Automatically create a "Happy Birthday" notification for today's birthdays
    for (const employee of todayBirthdays) {
      const notificationMessage = `Happy Birthday, ${employee.name}! We wish you a fantastic day!`;
      // Check if a birthday notification for today already exists for this user
      const existingNotification = await client.query(
        `SELECT id FROM notifications
         WHERE user_id = $1
         AND message = $2
         AND created_at::date = CURRENT_DATE`,
        [employee.id, notificationMessage]
      );

      if (existingNotification.rows.length === 0) {
        await client.query(
          'INSERT INTO notifications (user_id, message) VALUES ($1, $2)',
          [employee.id, notificationMessage]
        );
        console.log(`Birthday notification sent to ${employee.name} (ID: ${employee.id}).`);
      } else {
        console.log(`Birthday notification already exists for ${employee.name} (ID: ${employee.id}) today.`);
      }
    }

    await client.query('COMMIT'); // Commit the transaction

    // Return all birthdays for the month for display in the admin dashboard
    res.json({
      message: 'Birthdays for the month fetched and notifications sent (if applicable).',
      birthdays: birthdayEmployees.map(emp => ({
        id: emp.id,
        name: emp.name,
        date_of_birth: moment(emp.date_of_birth).format('YYYY-MM-DD')
      }))
    });

  } catch (error) {
    if (client) await client.query('ROLLBACK'); // Rollback on error
    console.error('Error fetching birthdays or sending notifications:', error.message, error.stack);
    res.status(500).json({ message: 'Server error fetching birthdays or sending notifications.' });
  } finally {
    if (client) client.release();
  }
});


// --- Weekly Off Management (Admin) ---

router.post('/weekly-offs', authenticate, authorizeAdmin, async (req, res) => {
    const { user_id, weekly_off_days, effective_date, end_date } = req.body; // weekly_off_days should be an array of integers (e.g., [0, 6] for Sunday, Saturday)
    
    if (!user_id || !Array.isArray(weekly_off_days) || weekly_off_days.length === 0 || !effective_date) {
        return res.status(400).json({ message: 'User ID, an array of day numbers (0-6), and an effective date are required.' });
    }

    // Validate effective_date format
    if (!moment(effective_date).isValid()) {
        return res.status(400).json({ message: 'Invalid effective date provided.' });
    }

    // Ensure weeklyOffDays is an array of integers
    if (!weekly_off_days.every(Number.isInteger)) {
        return res.status(400).json({ message: 'weekly_off_days must be an array of integers (0-6).' });
    }

    try {
        // Use ON CONFLICT (UPSERT) to update if a record for user_id and effective_date already exists,
        // otherwise insert a new one.
        const result = await pool.query(
            `INSERT INTO weekly_offs (user_id, weekly_off_days, effective_date, end_date)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, effective_date) DO UPDATE SET
                weekly_off_days = EXCLUDED.weekly_off_days,
                end_date = EXCLUDED.end_date,
                updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [user_id, weekly_off_days, effective_date, end_date || null] // Use null if end_date is not provided
        );
        res.status(201).json({ message: 'Weekly off configuration saved successfully.', weeklyOff: result.rows[0] });
    } catch (error) {
        console.error('Error saving weekly off:', error.message, error.stack);
        // More specific error handling for unique constraint, though ON CONFLICT handles it now
        if (error.code === '23505') {
            return res.status(409).json({ message: 'A weekly off assignment for this user on this effective date already exists.' });
        }
        res.status(500).json({ message: 'Server error saving weekly off.' });
    }
});

router.get('/weekly-offs', authenticate, authorizeAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT wo.id, wo.user_id, u.name AS user_name, u.employee_id, wo.weekly_off_days, wo.effective_date, wo.end_date
            FROM weekly_offs wo
            JOIN users u ON wo.user_id = u.id
            ORDER BY u.name ASC, wo.effective_date DESC
        `);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching weekly offs:', error.message, error.stack);
        res.status(500).json({ message: 'Server error fetching weekly offs.' });
    }
});

router.delete('/weekly-offs/:id', authenticate, authorizeAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM weekly_offs WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Weekly off record not found.' });
        }
        res.status(200).json({ message: 'Weekly off record deleted successfully.' });
    } catch (error) {
        console.error('Error deleting weekly off:', error.message, error.stack);
        res.status(500).json({ message: 'Server error deleting weekly off.' });
    }
});

// --- PAYROLL MANAGEMENT ROUTES (ADMIN ONLY) ---

router.post('/payroll/settings', authenticate, authorizeAdmin, async (req, res) => {
    const { setting_name, setting_value, description } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO payroll_settings (setting_name, setting_value, description)
             VALUES ($1, $2, $3)
             ON CONFLICT (setting_name) DO UPDATE SET
                setting_value = EXCLUDED.setting_value,
                description = EXCLUDED.description,
                updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [setting_name, setting_value, description]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error saving payroll setting:', error.message, error.stack);
        res.status(500).json({ message: 'Server error saving payroll setting.' });
    }
});

router.get('/payroll/settings', authenticate, authorizeAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM payroll_settings ORDER BY setting_name');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching payroll settings:', error.message, error.stack);
        res.status(500).json({ message: 'Server error fetching payroll settings.' });
    }
});

router.delete('/payroll/settings/:id', authenticate, authorizeAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM payroll_settings WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Payroll setting not found.' });
        }
        res.json({ message: 'Payroll setting deleted successfully.', deletedSetting: result.rows[0] });
    } catch (error) {
        console.error('Error deleting payroll setting:', error.message, error.stack);
        res.status(500).json({ message: 'Server error deleting payroll setting.' });
    }
});


// POST /api/admin/salary-structures - Set/Update an employee's salary structure
router.post('/salary-structures', authenticate, authorizeAdmin, async (req, res) => {
    const { userId, effectiveDate, basicSalary, hra, conveyanceAllowance, medicalAllowance, specialAllowance, lta, otherEarnings, grossSalary } = req.body;

    // Basic validation
    if (!userId || !effectiveDate || !basicSalary || !hra || !grossSalary) {
        return res.status(400).json({ message: 'Missing required salary structure fields.' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO salary_structures (user_id, effective_date, basic_salary, hra, conveyance_allowance, medical_allowance, special_allowance, lta, other_earnings, gross_salary)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (user_id, effective_date) DO UPDATE SET
                basic_salary = EXCLUDED.basic_salary,
                hra = EXCLUDED.hra,
                conveyance_allowance = EXCLUDED.conveyance_allowance,
                medical_allowance = EXCLUDED.medical_allowance,
                special_allowance = EXCLUDED.special_allowance,
                lta = EXCLUDED.lta,
                other_earnings = EXCLUDED.other_earnings,
                gross_salary = EXCLUDED.gross_salary,
                updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [userId, effectiveDate, basicSalary, hra, conveyanceAllowance || 0, medicalAllowance || 0, specialAllowance || 0, lta || 0, otherEarnings || {}, grossSalary]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error saving salary structure:', error.message, error.stack);
        res.status(500).json({ message: 'Server error saving salary structure.' });
    }
});

// GET /api/admin/salary-structures/:userId - Get an employee's salary structures (latest first)
router.get('/salary-structures/:userId', authenticate, authorizeAdmin, async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await pool.query(
            'SELECT * FROM salary_structures WHERE user_id = $1 ORDER BY effective_date DESC',
            [userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching salary structures:', error.message, error.stack);
        res.status(500).json({ message: 'Server error fetching salary structures.' });
    }
});


// GET /api/admin/payroll/preview/:userId/:year/:month - Preview payslip calculation for a single employee
router.get('/payroll/preview/:userId/:year/:month', authenticate, authorizeAdmin, async (req, res) => {
    const { userId, year, month } = req.params;
    const client = await pool.connect(); 

    try {
        // Fetch necessary payroll settings
        const payrollSettings = (await client.query('SELECT setting_name, setting_value FROM payroll_settings')).rows.reduce((acc, s) => {
            acc[s.setting_name] = s.setting_value;
            return acc;
        }, {});

        const EPF_EMPLOYEE_RATE = parseFloat(payrollSettings.EPF_EMPLOYEE_RATE || '0.12');
        const EPF_EMPLOYER_RATE = parseFloat(payrollSettings.EPF_EMPLOYER_RATE || '0.12');
        const EPF_MAX_SALARY_LIMIT = parseFloat(payrollSettings.EPF_MAX_SALARY_LIMIT || '15000');
        const ESI_EMPLOYEE_RATE = parseFloat(payrollSettings.ESI_EMPLOYEE_RATE || '0.0075');
        const ESI_EMPLOYER_RATE = parseFloat(payrollSettings.ESI_EMPLOYER_RATE || '0.0325');
        const ESI_WAGE_LIMIT = parseFloat(payrollSettings.ESI_WAGE_LIMIT || '21000');
        const HEALTH_INSURANCE_FIXED_FOR_CTC = parseFloat(payrollSettings.HEALTH_INSURANCE_FIXED_FOR_CTC || '0');

        // Fetch Employee's Latest Salary Structure
        let salaryStructure = null;
        const salaryStructureResult = await client.query(
            'SELECT * FROM salary_structures WHERE user_id = $1 ORDER BY effective_date DESC LIMIT 1',
            [userId]
        );
        salaryStructure = salaryStructureResult.rows[0];

        if (!salaryStructure) {
            return res.status(404).json({ message: 'No salary structure found for this employee.' });
        }

        // Fetch employee's details (name, state, designation, joining_date) from users table
        const userDetailsResult = await client.query('SELECT name, state, designation, joining_date, employee_id FROM users WHERE id = $1', [userId]);
        const employeeName = userDetailsResult.rows[0]?.name || 'N/A';
        const employeeId = userDetailsResult.rows[0]?.employee_id || 'N/A';
        const employeeDesignation = userDetailsResult.rows[0]?.designation || 'N/A';
        const employeeJoiningDate = userDetailsResult.rows[0]?.joining_date ? moment(userDetailsResult.rows[0].joining_date).format('YYYY-MM-DD') : null;


        // Get detailed attendance summary using the helper function
        const attendanceSummary = await calculateAttendanceSummary(userId, parseInt(year), parseInt(month), client);

        // Corrected Payable Days Calculation:
        const payableDays = attendanceSummary.totalCalendarDays - (attendanceSummary.unpaidLeaves || 0);

        // Earnings Calculation (Pro-rata based on payableDays)
        const proRataFactor = (attendanceSummary.totalCalendarDays > 0) ? (payableDays / attendanceSummary.totalCalendarDays) : 0;


        let basicSalaryMonthly = parseFloat(salaryStructure.basic_salary || 0) * proRataFactor;
        let hraMonthly = parseFloat(salaryStructure.hra || 0) * proRataFactor;
        let conveyanceAllowanceMonthly = parseFloat(salaryStructure.conveyance_allowance || 0) * proRataFactor;
        let medicalAllowanceMonthly = parseFloat(salaryStructure.medical_allowance || 0) * proRataFactor;
        let specialAllowanceMonthly = parseFloat(salaryStructure.special_allowance || 0) * proRataFactor;
        let ltaMonthly = parseFloat(salaryStructure.lta || 0) * proRataFactor;

        let grossEarnings = basicSalaryMonthly + hraMonthly + conveyanceAllowanceMonthly + medicalAllowanceMonthly + specialAllowanceMonthly + ltaMonthly;

        let otherEarningsParsed = {};
        if (salaryStructure.other_earnings) {
            try {
                // Assuming other_earnings from DB is already a parsed JSON object or can be directly used
                otherEarningsParsed = salaryStructure.other_earnings;
                for (const key in otherEarningsParsed) {
                    grossEarnings += (parseFloat(otherEarningsParsed[key]) || 0) * proRataFactor;
                }
            } catch (e) {
                console.error(`Error parsing other_earnings for user ${userId} during preview:`, e);
            }
        }

        // Statutory Deductions Calculation
        let totalDeductions = 0;
        let epfEmployee = 0;
        let epfEmployer = 0;
        let esiEmployee = 0;
        let esiEmployer = 0;
        let professionalTax = 0;
        let tds = 0;
        let loanDeduction = 0;
        let mediclaimDeduction = 0;
        let otherDeductionsParsed = {};

        // EPF Calculation
        const epfApplicableSalary = Math.min(basicSalaryMonthly, EPF_MAX_SALARY_LIMIT);
        epfEmployee = epfApplicableSalary * EPF_EMPLOYEE_RATE;
        epfEmployer = epfApplicableSalary * EPF_EMPLOYER_RATE;
        totalDeductions += epfEmployee;

        // ESI Calculation
        if (grossEarnings <= ESI_WAGE_LIMIT) {
            esiEmployee = grossEarnings * ESI_EMPLOYEE_RATE;
            esiEmployer = grossEarnings * ESI_EMPLOYER_RATE;
            totalDeductions += esiEmployee;
        } else {
            esiEmployee = 0;
            esiEmployer = 0;
        }


        // Professional Tax Calculation (Updated with new slabs)
        if (grossEarnings > 0) {
            if (grossEarnings >= 8501 && grossEarnings <= 10000) {
                professionalTax = 0.00;
            } else if (grossEarnings >= 10001 && grossEarnings <= 15000) {
                professionalTax = 110.00;
            } else if (grossEarnings >= 15001 && grossEarnings <= 25000) {
                professionalTax = 130.00;
            } else if (grossEarnings >= 25001 && grossEarnings <= 40000) {
                professionalTax = 150.00;
            } else if (grossEarnings > 40001) {
                professionalTax = 200.00;
            }
            console.log(`[PAYROLL_DEBUG] Professional Tax calculated for gross ${grossEarnings}: ${professionalTax}`);
        }
        totalDeductions += professionalTax;

        tds = 0; // Placeholder
        totalDeductions += tds; 

        loanDeduction = 0; // Placeholder for Advance
        totalDeductions += loanDeduction; 

        // Mediclaim Deduction (Conditional logic added)
        if (grossEarnings > 21000) {
            mediclaimDeduction = 410.00;
        } else {
            mediclaimDeduction = 0.00;
        }
        totalDeductions += mediclaimDeduction; 

        if (salaryStructure.other_deductions) {
            try {
                // Assuming other_deductions from DB is already a parsed JSON object or can be directly used
                otherDeductionsParsed = salaryStructure.other_deductions;
                for (const key in otherDeductionsParsed) {
                    totalDeductions += (parseFloat(otherDeductionsParsed[key]) || 0);
                }
            } catch (e) {
                console.error(`Error parsing other_deductions for user ${userId} during preview:`, e);
            }
        }


        // Net Pay Calculation
        let netPay = grossEarnings - totalDeductions;

        // Round all numeric values to 2 decimal places for storage and PDF display
        grossEarnings = parseFloat(grossEarnings.toFixed(2));
        basicSalaryMonthly = parseFloat(basicSalaryMonthly.toFixed(2));
        hraMonthly = parseFloat(hraMonthly.toFixed(2));
        conveyanceAllowanceMonthly = parseFloat(conveyanceAllowanceMonthly.toFixed(2));
        medicalAllowanceMonthly = parseFloat(medicalAllowanceMonthly.toFixed(2));
        specialAllowanceMonthly = parseFloat(specialAllowanceMonthly.toFixed(2));
        ltaMonthly = parseFloat(ltaMonthly.toFixed(2));
        totalDeductions = parseFloat(totalDeductions.toFixed(2));
        epfEmployee = parseFloat(epfEmployee.toFixed(2));
        epfEmployer = parseFloat(epfEmployer.toFixed(2));
        esiEmployee = parseFloat(esiEmployee.toFixed(2));
        esiEmployer = parseFloat(esiEmployer.toFixed(2));
        professionalTax = parseFloat(professionalTax.toFixed(2));
        tds = parseFloat(tds.toFixed(2));
        loanDeduction = parseFloat(loanDeduction.toFixed(2));
        mediclaimDeduction = parseFloat(mediclaimDeduction.toFixed(2));
        netPay = parseFloat(netPay.toFixed(2));

        // Construct payslip data object for PDF generation
        const payrollSlipData = {
            companyInfo: {
                name: "Your Company Name",
                address: "Your Company Address"
            },
            headerDetails: {
                employeeId: employeeId, // Use fetched employee_id
                designation: employeeDesignation,
                joiningDate: employeeJoiningDate,
                employeeName: employeeName,
                monthYear: `${new Date(year, month - 1).toLocaleString('en-US', { month: 'long' })} ${year}`,
                payableDays: parseFloat(payableDays.toFixed(2)), // Use the newly calculated payableDays (this will be 29)
                planDsn: "Jun-25" // Placeholder from image, adjust if dynamic
            },
            earnings: {
                basicDA: parseFloat(basicSalaryMonthly.toFixed(2)),
                houseRentAllowances: parseFloat(hraMonthly.toFixed(2)),
                conveyanceAllowances: parseFloat(conveyanceAllowanceMonthly.toFixed(2)),
                specialAllowances: parseFloat(specialAllowanceMonthly.toFixed(2)),
                lta: parseFloat(ltaMonthly.toFixed(2)),
                medicalAllowances: parseFloat(medicalAllowanceMonthly.toFixed(2)),
                otherEarnings: otherEarningsParsed,
                totalGrossSalary: parseFloat(grossEarnings.toFixed(2))
            },
            deductions: {
                providentFund: parseFloat(epfEmployee.toFixed(2)),
                esi: parseFloat(esiEmployee.toFixed(2)),
                professionalTax: parseFloat(professionalTax.toFixed(2)),
                advance: parseFloat(loanDeduction.toFixed(2)),
                grill: parseFloat((otherDeductionsParsed.grill || 0).toFixed(2)), // Ensure grill is handled if it exists
                mediclaim: parseFloat(mediclaimDeduction.toFixed(2)),
                otherDeductions: otherDeductionsParsed,
                totalDeductions: parseFloat(totalDeductions.toFixed(2))
            },
            summary: {
                netSalary: parseFloat(netPay.toFixed(2)),
                netSalaryInWords: convertNumberToWords(netPay), // Dynamically convert netPay to words
            },
            paymentDetails: {
                salaryPaidBy: "Bank Account" // Placeholder, adjust if dynamic
            },
            signatures: {
                employeeSignature: "", // Placeholder
                directorName: "Ajay Kantha" // Placeholder, adjust if dynamic
            },
            attendance_summary_details: {
                totalCalendarDays: attendanceSummary.totalCalendarDays,
                totalWorkingDaysInMonth: attendanceSummary.totalWorkingDaysInMonth,
                actualWeeklyOffDays: attendanceSummary.actualWeeklyOffDays,
                holidaysCount: attendanceSummary.holidaysCount,
                presentDays: attendanceSummary.presentDays,
                lateDays: attendanceSummary.lateDays,
                leaveDays: attendanceSummary.leaveDays,
                lopDays: attendanceSummary.lopDays,
                absentDays: attendanceSummary.absentDays,
                totalUnpaidLeaves: attendanceSummary.unpaidLeaves, // Ensure this is available
                totalPayableDaysForPayroll: attendanceSummary.totalPayableDaysForPayroll, // New field for clarity
                actualPresentAndPaidLeaveDays: attendanceSummary.actualPresentAndPaidLeaveDays, // Renamed field
                totalWorkingHours: attendanceSummary.totalWorkingHours,
                averageDailyHours: attendanceSummary.averageDailyHours
            },
            healthInsuranceFixedForCTC: HEALTH_INSURANCE_FIXED_FOR_CTC
        };

        res.json(payrollSlipData);

    } catch (error) {
        console.error('Error previewing payroll:', error.message, error.stack);
        res.status(500).json({ message: 'Server error previewing payroll.', error: error.message });
    } finally {
        client.release();
    }
});

// POST /api/admin/payroll/run' - Triggers a payroll calculation and payslip generation for all active employees
router.post('/payroll/run', authenticate, authorizeAdmin, async (req, res) => {
    const { month, year } = req.body;
    const adminId = req.user.id; // Admin performing the run
    const client = await pool.connect();

    if (!month || !year) {
        return res.status(400).json({ message: 'Payroll month and year are required.' });
    }

    try {
        await client.query('BEGIN');

        // Check if a payroll run for this month/year already exists
        let payrollRunResult = await client.query(
            'SELECT id FROM payroll_runs WHERE payroll_month = $1 AND payroll_year = $2',
            [month, year]
        );
        let payrollRunId;

        if (payrollRunResult.rows.length > 0) {
            payrollRunId = payrollRunResult.rows[0].id;
            await client.query(
                `UPDATE payroll_runs SET status = 'Recalculating', updated_at = CURRENT_TIMESTAMP, processed_by = $1
                 WHERE id = $2`,
                [adminId, payrollRunId]
            );
            await client.query('DELETE FROM payslips WHERE payroll_run_id = $1', [payrollRunId]);
        } else {
            const newRunResult = await client.query(
                `INSERT INTO payroll_runs (payroll_month, payroll_year, status, processed_by)
                 VALUES ($1, $2, 'Calculating', $3) RETURNING id`,
                [month, year, adminId]
            );
            payrollRunId = newRunResult.rows[0].id;
        }

        // --- FETCH NECESSARY PAYROLL SETTINGS ---
        const payrollSettings = (await client.query('SELECT setting_name, setting_value FROM payroll_settings')).rows.reduce((acc, s) => {
            acc[s.setting_name] = s.setting_value;
            return acc;
        }, {});

        const EPF_EMPLOYEE_RATE = parseFloat(payrollSettings.EPF_EMPLOYEE_RATE || '0.12');
        const EPF_EMPLOYER_RATE = parseFloat(payrollSettings.EPF_EMPLOYER_RATE || '0.12');
        const EPF_MAX_SALARY_LIMIT = parseFloat(payrollSettings.EPF_MAX_SALARY_LIMIT || '15000');
        const ESI_EMPLOYEE_RATE = parseFloat(payrollSettings.ESI_EMPLOYEE_RATE || '0.0075');
        const ESI_EMPLOYER_RATE = parseFloat(payrollSettings.ESI_EMPLOYER_RATE || '0.0325');
        const ESI_WAGE_LIMIT = parseFloat(payrollSettings.ESI_WAGE_LIMIT || '21000');
        const HEALTH_INSURANCE_FIXED_FOR_CTC = parseFloat(payrollSettings.HEALTH_INSURANCE_FIXED_FOR_CTC || '0');


        // --- FETCH ALL ACTIVE EMPLOYEES ---
        const employees = (await client.query('SELECT id, name, employee_id, email, pan_card_number, bank_account_number, ifsc_code, bank_name, date_of_birth, address, mobile_number, state, designation, joining_date FROM users WHERE role IN ($1, $2)', ['employee', 'admin'])).rows;

        for (const employee of employees) {
            const userId = employee.id;
            console.log(`Processing payroll for: ${employee.name} (ID: ${userId})`);

            // 1. Fetch Employee's Latest Salary Structure
            let salaryStructure = (await client.query(
                'SELECT * FROM salary_structures WHERE user_id = $1 ORDER BY effective_date DESC LIMIT 1',
                [userId]
            )).rows[0];

            if (!salaryStructure) {
                console.warn(`No salary structure found for user ${employee.name} (${userId}). Skipping payslip generation.`);
                continue;
            }

            const employeeDesignation = employee.designation || 'N/A';
            const employeeJoiningDate = employee.joining_date ? moment(employee.joining_date).format('YYYY-MM-DD') : null;


            // 2. Get detailed attendance summary using the helper function
            const attendanceSummary = await calculateAttendanceSummary(userId, parseInt(year), parseInt(month), client);

            // Corrected Payable Days Calculation:
            const payableDays = attendanceSummary.totalCalendarDays - (attendanceSummary.unpaidLeaves || 0);


            // 3. Earnings Calculation (Pro-rata based on payableDays)
            const proRataFactor = (attendanceSummary.totalCalendarDays > 0) ? (payableDays / attendanceSummary.totalCalendarDays) : 0;

            let basicSalaryMonthly = parseFloat(salaryStructure.basic_salary || 0) * proRataFactor;
            let hraMonthly = parseFloat(salaryStructure.hra || 0) * proRataFactor;
            let conveyanceAllowanceMonthly = parseFloat(salaryStructure.conveyance_allowance || 0) * proRataFactor;
            let medicalAllowanceMonthly = parseFloat(salaryStructure.medical_allowance || 0) * proRataFactor;
            let specialAllowanceMonthly = parseFloat(salaryStructure.special_allowance || 0) * proRataFactor;
            let ltaMonthly = parseFloat(salaryStructure.lta || 0) * proRataFactor;

            let grossEarnings = basicSalaryMonthly + hraMonthly + conveyanceAllowanceMonthly + medicalAllowanceMonthly + specialAllowanceMonthly + ltaMonthly;

            let otherEarningsParsed = {};
            if (salaryStructure.other_earnings) {
                try {
                    otherEarningsParsed = salaryStructure.other_earnings;
                    for (const key in otherEarningsParsed) {
                        grossEarnings += (parseFloat(otherEarningsParsed[key]) || 0) * proRataFactor;
                    }
                } catch (e) {
                    console.error(`Error parsing other_earnings for user ${userId}:`, e);
                }
            }


            // 4. Statutory Deductions Calculation
            let totalDeductions = 0;
            let epfEmployee = 0;
            let epfEmployer = 0;
            let esiEmployee = 0;
            let esiEmployer = 0;
            let professionalTax = 0;
            let tds = 0;
            let loanDeduction = 0;
            let mediclaimDeduction = 0;
            let otherDeductions = {};

            // EPF Calculation (Employee & Employer Share)
            const epfApplicableSalary = Math.min(basicSalaryMonthly, EPF_MAX_SALARY_LIMIT);
            epfEmployee = epfApplicableSalary * EPF_EMPLOYEE_RATE;
            epfEmployer = epfApplicableSalary * EPF_EMPLOYER_RATE;
            totalDeductions += epfEmployee;

            // ESI Calculation
            if (grossEarnings <= ESI_WAGE_LIMIT) {
                esiEmployee = grossEarnings * ESI_EMPLOYEE_RATE;
                esiEmployer = grossEarnings * ESI_EMPLOYER_RATE;
                totalDeductions += esiEmployee;
            } else {
                esiEmployee = 0;
                esiEmployer = 0;
            }


            // Professional Tax Calculation (Updated with new slabs)
            if (grossEarnings > 0) {
                if (grossEarnings >= 8501 && grossEarnings <= 10000) {
                    professionalTax = 0.00;
                } else if (grossEarnings >= 10001 && grossEarnings <= 15000) {
                    professionalTax = 110.00;
                } else if (grossEarnings >= 15001 && grossEarnings <= 25000) {
                    professionalTax = 130.00;
                } else if (grossEarnings >= 25001 && grossEarnings <= 40000) {
                    professionalTax = 150.00;
                } else if (grossEarnings > 40001) {
                    professionalTax = 200.00;
                }
                console.log(`[PAYROLL_DEBUG] Professional Tax calculated for gross ${grossEarnings}: ${professionalTax}`);
            }
            totalDeductions += professionalTax;

            tds = 0; // Placeholder
            totalDeductions += tds; 

            loanDeduction = 0; // Example: fetch from a 'employee_loans' table
            totalDeductions += loanDeduction; 

            // Mediclaim Deduction (Conditional logic added)
            if (grossEarnings > 21000) {
                mediclaimDeduction = 410.00;
            } else {
                mediclaimDeduction = 0.00;
            }
            totalDeductions += mediclaimDeduction; 

            if (salaryStructure.other_deductions) {
                try {
                    otherDeductions = salaryStructure.other_deductions;
                    for (const key in otherDeductions) {
                        totalDeductions += (parseFloat(otherDeductions[key]) || 0);
                    }
                } catch (e) {
                    console.error(`Error parsing other_deductions for user ${userId}:`, e);
                }
            }


            // 5. Net Pay Calculation
            let netPay = grossEarnings - totalDeductions;

            // Round all numeric values to 2 decimal places for storage and PDF display
            grossEarnings = parseFloat(grossEarnings.toFixed(2));
            basicSalaryMonthly = parseFloat(basicSalaryMonthly.toFixed(2));
            hraMonthly = parseFloat(hraMonthly.toFixed(2));
            conveyanceAllowanceMonthly = parseFloat(conveyanceAllowanceMonthly.toFixed(2));
            medicalAllowanceMonthly = parseFloat(medicalAllowanceMonthly.toFixed(2));
            specialAllowanceMonthly = parseFloat(specialAllowanceMonthly.toFixed(2));
            ltaMonthly = parseFloat(ltaMonthly.toFixed(2));
            totalDeductions = parseFloat(totalDeductions.toFixed(2));
            epfEmployee = parseFloat(epfEmployee.toFixed(2));
            epfEmployer = parseFloat(epfEmployer.toFixed(2));
            esiEmployee = parseFloat(esiEmployee.toFixed(2));
            esiEmployer = parseFloat(esiEmployer.toFixed(2));
            professionalTax = parseFloat(professionalTax.toFixed(2));
            tds = parseFloat(tds.toFixed(2));
            loanDeduction = parseFloat(loanDeduction.toFixed(2));
            mediclaimDeduction = parseFloat(mediclaimDeduction.toFixed(2));
            netPay = parseFloat(netPay.toFixed(2));

            // Construct payslip data object for PDF generation
            const payslipData = {
                companyInfo: {
                    name: "BEYOND BIM TECHNOLOGIES PRIVATE LIMITED",
                    address: "WEBEL IT PARK, GANDHI MORE, DURGAPUR-713213, WEST BENGAL, INDIA"
                },
                headerDetails: {
                    employeeId: employee.employee_id,
                    designation: employeeDesignation,
                    joiningDate: employeeJoiningDate,
                    employeeName: employee.name,
                    monthYear: `${new Date(year, month - 1).toLocaleString('en-US', { month: 'long' })} ${year}`,
                    payableDays: parseFloat(payableDays.toFixed(2)), // This will be 29
                    planDsn: "Jun-25" // Placeholder from image, adjust if dynamic
                },
                earnings: {
                    basicDA: basicSalaryMonthly,
                    houseRentAllowances: hraMonthly,
                    conveyanceAllowances: conveyanceAllowanceMonthly,
                    specialAllowances: specialAllowanceMonthly,
                    lta: ltaMonthly,
                    medicalAllowances: medicalAllowanceMonthly,
                    otherEarnings: otherEarningsParsed,
                    totalGrossSalary: grossEarnings
                },
                deductions: {
                    providentFund: epfEmployee,
                    esi: esiEmployee,
                    professionalTax: professionalTax,
                    advance: loanDeduction,
                    mediclaim: mediclaimDeduction,
                    otherDeductions: otherDeductions, // Pass the parsed other deductions
                    totalDeductions: totalDeductions
                },
                summary: {
                    netSalary: netPay,
                    netSalaryInWords: convertNumberToWords(netPay),
                },
                paymentDetails: {
                    salaryPaidBy: "Bank Account"
                },
                signatures: {
                    employeeSignature: "",
                    directorName: "Ajay Kantha"
                },
                attendance_summary_details: {
                    totalCalendarDays: attendanceSummary.totalCalendarDays,
                    totalWorkingDaysInMonth: attendanceSummary.totalWorkingDaysInMonth,
                    actualWeeklyOffDays: attendanceSummary.actualWeeklyOffDays,
                    holidaysCount: attendanceSummary.holidaysCount,
                    presentDays: attendanceSummary.presentDays,
                    lateDays: attendanceSummary.lateDays,
                    leaveDays: attendanceSummary.leaveDays,
                    lopDays: attendanceSummary.lopDays,
                    absentDays: attendanceSummary.absentDays,
                    totalUnpaidLeaves: attendanceSummary.unpaidLeaves, // Ensure this is available
                    totalPayableDaysForPayroll: attendanceSummary.totalPayableDaysForPayroll, // New field for clarity
                    actualPresentAndPaidLeaveDays: attendanceSummary.actualPresentAndPaidLeaveDays, // Renamed field
                    totalWorkingHours: attendanceSummary.totalWorkingHours,
                    averageDailyHours: attendanceSummary.averageDailyHours
                },
                healthInsuranceFixedForCTC: HEALTH_INSURANCE_FIXED_FOR_CTC
            };

            let payslipFilePath = null;
            // Note: __dirname is /routes, so we go up one
            const UPLOADS_DIR = path.join(__dirname, '..', 'uploads'); 

            try {
                const payslipFileName = `payslip_${employee.employee_id}_${year}_${String(month).padStart(2, '0')}.pdf`;
                const payslipsDir = path.join(UPLOADS_DIR, 'payslips');
                const fullPayslipPath = path.join(payslipsDir, payslipFileName);

                if (!fs.existsSync(payslipsDir)) {
                    fs.mkdirSync(payslipsDir, { recursive: true });
                }

                console.log(`[PDF_DEBUG] Attempting to generate PDF for ${employee.name}. Full path: ${fullPayslipPath}`);
                await generatePayslipPDF(payslipData, fullPayslipPath); // Call the dedicated PDF generation function
                // Store the relative path
                payslipFilePath = path.join('uploads', 'payslips', payslipFileName);
                console.log(`[PDF_DEBUG] PDF generation complete. File path prepared: ${payslipFilePath}`);

            } catch (pdfError) {
                console.error(`[PDF_DEBUG] Error generating PDF for ${employee.name} (ID: ${userId}):`, pdfError.message, pdfError.stack);
                payslipFilePath = null;
            }


            // 6. Insert/Update Payslip Record in the database
            console.log(`[DB_DEBUG] Attempting to insert/update payslip record for ${employee.name} with file_path: ${payslipFilePath}`);
            await client.query(
                `INSERT INTO payslips (
                    user_id, payroll_run_id, payslip_month, payslip_year,
                    gross_earnings, basic_salary, hra, conveyance_allowance, medical_allowance, special_allowance, lta, other_earnings,
                    total_deductions, epf_employee, epf_employer, esi_employee, esi_employer, professional_tax, tds, loan_deduction, mediclaim_deduction, other_deductions,
                    net_pay, paid_days, unpaid_leaves, days_present, file_path,
                    designation, joining_date
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
                ON CONFLICT (user_id, payslip_month, payslip_year) DO UPDATE SET
                    gross_earnings = EXCLUDED.gross_earnings,
                    basic_salary = EXCLUDED.basic_salary,
                    hra = EXCLUDED.hra,
                    conveyance_allowance = EXCLUDED.conveyance_allowance,
                    medical_allowance = EXCLUDED.medical_allowance,
                    special_allowance = EXCLUDED.special_allowance,
                    lta = EXCLUDED.lta,
                    other_earnings = EXCLUDED.other_earnings,
                    total_deductions = EXCLUDED.total_deductions,
                    epf_employee = EXCLUDED.epf_employee,
                    epf_employer = EXCLUDED.epf_employer,
                    esi_employee = EXCLUDED.esi_employee,
                    esi_employer = EXCLUDED.esi_employer,
                    professional_tax = EXCLUDED.professional_tax,
                    tds = EXCLUDED.tds,
                    loan_deduction = EXCLUDED.loan_deduction,
                    mediclaim_deduction = EXCLUDED.mediclaim_deduction,
                    other_deductions = EXCLUDED.other_deductions,
                    net_pay = EXCLUDED.net_pay,
                    paid_days = EXCLUDED.paid_days,
                    unpaid_leaves = EXCLUDED.unpaid_leaves,
                    days_present = EXCLUDED.days_present,
                    file_path = COALESCE(EXCLUDED.file_path, payslips.file_path),
                    designation = EXCLUDED.designation,
                    joining_date = EXCLUDED.joining_date,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *`,
                [
                    userId, payrollRunId, month, year,
                    grossEarnings, basicSalaryMonthly, hraMonthly, conveyanceAllowanceMonthly, medicalAllowanceMonthly, specialAllowanceMonthly, ltaMonthly, JSON.stringify(otherEarningsParsed),
                    totalDeductions, epfEmployee, epfEmployer, esiEmployee, esiEmployer, professionalTax, tds, loanDeduction, mediclaimDeduction, JSON.stringify(otherDeductions),
                    netPay, payableDays, attendanceSummary.unpaidLeaves, payableDays,
                    payslipFilePath,
                    employeeDesignation,
                    employeeJoiningDate
                ]
            );
        }

        // Update payroll run status to 'Calculated'
        await client.query(
            `UPDATE payroll_runs SET status = 'Calculated', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [payrollRunId]
        );

        await client.query('COMMIT');
        res.json({ message: `Payroll for ${moment().month(month - 1).format('MMMM')} ${year} calculated successfully! Payslips generated and stored.`, payrollRunId });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error running payroll:', error.message, error.stack);
        res.status(500).json({ message: 'Server error running payroll.', error: error.message });
    } finally {
        client.release();
    }
});

// POST /api/admin/payslips/upload - Upload a payslip file (e.g., PDF) for an employee
router.post('/payslips/upload', authenticate, authorizeAdmin, payslipUpload.single('payslipFile'), async (req, res) => {
    const { userId, month, year } = req.body;
    // Store relative path for database, absolute path for file system operations
    const relativeFilePath = req.file ? path.join('uploads', 'payslips', req.file.filename) : null;

    if (!userId || !month || !year || !relativeFilePath) {
        // Clean up uploaded file if validation fails
        if (req.file) {
            fs.unlink(req.file.path, err => {
                if(err) console.error("Error deleting orphaned payslip upload:", err);
            });
        }
        return res.status(400).json({ message: 'Missing required fields or payslip file.' });
    }

    try {
        // Find the payroll_run_id for the given month/year
        let payrollRun = await pool.query(
            'SELECT id FROM payroll_runs WHERE payroll_month = $1 AND payroll_year = $2',
            [month, year]
        );
        let payrollRunId;
        if (payrollRun.rows.length === 0) {
            // If no payroll run exists, create a dummy one or reject
            const newRun = await pool.query(
                `INSERT INTO payroll_runs (payroll_month, payroll_year, status, processed_by, notes)
                 VALUES ($1, $2, 'Uploaded', $3, 'Payslip uploaded manually') RETURNING id`,
                [month, year, req.user.id]
            );
            payrollRunId = newRun.rows[0].id;
        } else {
            payrollRunId = payrollRun.rows[0].id;
        }

        // Insert or update payslip record with file path
        const result = await pool.query(
            `INSERT INTO payslips (user_id, payroll_run_id, payslip_month, payslip_year, file_path,
                                   gross_earnings, basic_salary, hra, total_deductions, net_pay)
             VALUES ($1, $2, $3, $4, $5, 0, 0, 0, 0, 0)
             ON CONFLICT (user_id, payslip_month, payslip_year) DO UPDATE SET
               file_path = EXCLUDED.file_path,
               updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [userId, payrollRunId, month, year, relativeFilePath]
        );
        res.status(201).json({ message: 'Payslip uploaded successfully!', payslip: result.rows[0] });
    } catch (error) {
        console.error('Error uploading payslip:', error.message, error.stack);
        res.status(500).json({ message: 'Server error uploading payslip.', error: error.message });
    }
});

// GET /api/admin/payslips/list/:userId - List all payslips for a specific employee (for admin view)
router.get('/payslips/list/:userId', authenticate, authorizeAdmin, async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await pool.query(
            'SELECT * FROM payslips WHERE user_id = $1 ORDER BY payslip_year DESC, payslip_month DESC',
            [userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching employee payslips for admin:', error.message, error.stack);
        res.status(500).json({ message: 'Server error fetching employee payslips.' });
    }
});

// GET /api/admin/payslips/:payslipId/details - Get full details of a specific payslip
router.get('/payslips/:payslipId/details', authenticate, authorizeAdmin, async (req, res) => {
    const { payslipId } = req.params;
    try {
        const result = await pool.query('SELECT * FROM payslips WHERE id = $1', [payslipId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Payslip not found.' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching payslip details:', error.message, error.stack);
        res.status(500).json({ message: 'Server error fetching payslip details.' });
    }
});


// --- Legacy Admin Redirects ---

router.get('/leaves', authenticate, authorizeAdmin, async (req, res) => {
  res.redirect(307, `/api/admin/leaves?${new URLSearchParams(req.query).toString()}`);
});

router.get('/attendance/daily', authenticate, authorizeAdmin, async (req, res) => {
  res.redirect(307, `/api/admin/attendance?${new URLSearchParams(req.query).toString()}`);
});

router.get('/analytics/monthly-summary', authenticate, authorizeAdmin, async (req, res) => {
  res.redirect(307, `/api/admin/monthly-summary?${new URLSearchParams(req.query).toString()}`);
});

router.post('/leaves/update-cancellation', authenticate, authorizeAdmin, async (req, res) => {
  const { id, status, admin_comment } = req.body;
  if (status === 'approved') {
    req.body.status = 'cancelled';
  } else if (status === 'rejected') {
    req.body.status = 'approved';
  }
  // This will redirect to /api/admin/leaves/:id/status
  res.redirect(307, `leaves/${id}/status`);
});


module.exports = router;