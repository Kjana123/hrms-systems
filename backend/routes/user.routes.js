// routes/user.routes.js
console.log(`[FILE_LOAD_CHECK] routes/user.routes.js loaded at ${new Date().toISOString()}`);

const express = require('express');
const router = express.Router();
const moment = require('moment-timezone');
const pool = require('../db');
const { authenticate } = require('../middleware/authenticate');
const upload = require('../config/multer'); // Import multer config
const { calculateAttendanceSummary } = require('../utils/payroll'); // Import helper

// --- Employee Attendance ---

router.get('/users/me', authenticate, async (req, res) => {
    // req.user contains the decoded JWT payload from the 'authenticate' middleware
    const user_id = req.user.id; 
    
    let client = null;
    try {
        client = await pool.connect();
        // Fetch ALL necessary user details. Adjust the SELECT columns to match what your frontend needs.
        const result = await client.query(
            `SELECT 
                id, name, email, employee_id, role, shift_type, is_active, 
                profile_photo_url, pan_card_number, bank_account_number, 
                ifsc_code, bank_name, date_of_birth, personal_details, 
                family_history, address, mobile_number, kyc_details, created_at
             FROM users 
             WHERE id = $1`,
            [user_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User profile not found.' });
        }
        
        // Return the user data
        res.status(200).json(result.rows[0]);

    } catch (error) {
        console.error('[PROFILE_API_ERROR] Error fetching user profile:', error.message, error.stack);
        res.status(500).json({ message: `Server error fetching user profile: ${error.message}` });
    } finally {
        if (client) client.release();
    }
});

// Employee attendance history and details
router.get('/attendance', authenticate, async (req, res) => {
    const user_id = req.user.id;
    const { date, month, year } = req.query;

    console.log(`[ATTENDANCE_API_DEBUG] Received GET /api/attendance request for user ${user_id}`);
    console.log(`[ATTENDANCE_API_DEBUG] Query params - date: ${date}, month: ${month}, year: ${year}`);

    let client = null;
    try {
        client = await pool.connect();

        let startDate, endDate;

        if (date) {
            const parsedDate = moment(date, 'YYYY-MM-DD', true);
            if (!parsedDate.isValid()) {
                return res.status(400).json({ message: 'Invalid date format provided.' });
            }
            startDate = parsedDate.tz('Asia/Kolkata').startOf('day');
            endDate = startDate.clone().endOf('day');
            console.log(`[ATTENDANCE_API_DEBUG] Fetching attendance for specific date: ${startDate.format('YYYY-MM-DD')}`);
        } else {
            const validMonth = month && parseInt(month, 10) >= 1 && parseInt(month, 10) <= 12 ? parseInt(month, 10) : moment().tz('Asia/Kolkata').month() + 1;
            const validYear = year && parseInt(year, 10) >= 2000 && parseInt(year, 10) <= 2099 ? parseInt(year, 10) : moment().tz('Asia/Kolkata').year();
            startDate = moment([validYear, validMonth - 1, 1]).tz('Asia/Kolkata').startOf('month');
            endDate = startDate.clone().endOf('month');
            console.log(`[ATTENDANCE_API_DEBUG] Fetching attendance for month ${validMonth}, year ${validYear}. Range: ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')}`);
        }

        // Fetch raw attendance data
        const attendanceResult = await client.query(
            `SELECT
                id, user_id, date, check_in, check_out, status, late_time,
                working_hours, extra_hours, check_in_latitude, check_in_longitude,
                check_out_latitude, check_out_longitude, check_in_device, check_out_device,
                reason, admin_comment, created_at, updated_at
            FROM attendance
            WHERE user_id = $1 AND date BETWEEN $2 AND $3
            ORDER BY date ASC`,
            [user_id, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]
        );

        console.log(`[ATTENDANCE_API_DEBUG] Raw attendance query returned ${attendanceResult.rows.length} rows.`);

        const attendanceMap = new Map(
            attendanceResult.rows.map(att => [moment(att.date).format('YYYY-MM-DD'), att])
        );

        // Fetch holidays
        const holidayResult = await client.query(
            `SELECT holiday_date FROM holidays WHERE holiday_date BETWEEN $1 AND $2`,
            [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]
        );
        const holidays = new Set(holidayResult.rows.map(row => moment(row.holiday_date).format('YYYY-MM-DD')));
        console.log(`[ATTENDANCE_API_DEBUG] Holidays in period:`, Array.from(holidays));


        // Fetch weekly off configurations for the employee that are relevant to the period
        const weeklyOffsConfigResult = await client.query(
            `SELECT weekly_off_days, effective_date, end_date FROM weekly_offs
             WHERE user_id = $1
             AND effective_date <= $2 -- Configuration must be effective on or before the end of the period
             ORDER BY effective_date DESC`,
            [user_id, endDate.format('YYYY-MM-DD')]
        );
        const weeklyOffsConfigs = weeklyOffsConfigResult.rows;
        console.log(`[ATTENDANCE_API_DEBUG] Raw weekly_offs_configs from DB (${weeklyOffsConfigs.length} rows):`, weeklyOffsConfigs);


        // Create a set of weekly off dates for the current period, considering effective dates
        const employeeSpecificWeeklyOffDates = new Set();
        for (let d = startDate.clone(); d.isSameOrBefore(endDate); d.add(1, 'day')) {
            const currentMomentDayOfWeek = d.day(); // 0 for Sunday, 6 for Saturday
            const formattedDate = d.format('YYYY-MM-DD');

            // Find the most recent weekly off configuration applicable to 'd'
            const relevantWeeklyOffConfig = weeklyOffsConfigs
                .find(row => {
                    const woEffectiveDate = moment.utc(row.effective_date);
                    const woEndDate = row.end_date ? moment.utc(row.end_date) : null;
                    // Check if 'd' is within the effective range of this config
                    return d.isSameOrAfter(woEffectiveDate, 'day') && (!woEndDate || d.isSameOrBefore(woEndDate, 'day'));
                });

            let isWeeklyOffForThisDay = false;
            if (relevantWeeklyOffConfig && Array.isArray(relevantWeeklyOffConfig.weekly_off_days)) {
                isWeeklyOffForThisDay = relevantWeeklyOffConfig.weekly_off_days.includes(currentMomentDayOfWeek);
            }

            if (isWeeklyOffForThisDay) {
                employeeSpecificWeeklyOffDates.add(formattedDate);
            }
        }
        console.log(`[ATTENDANCE_API_DEBUG] Calculated employeeSpecificWeeklyOffDates:`, Array.from(employeeSpecificWeeklyOffDates));


        // Fetch leave applications
        const leaveResult = await client.query(
            `SELECT from_date, to_date, status, is_half_day, leave_type_id FROM leave_applications
             WHERE user_id = $1 AND (
                 from_date BETWEEN $2 AND $3 OR
                 to_date BETWEEN $2 AND $3 OR
                 $2 BETWEEN from_date AND to_date
             ) AND status IN ('approved', 'overridden_by_correction', 'cancellation_pending')`,
            [user_id, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]
        );

        // Fetch leave types to get is_paid status
        const leaveTypesResult = await client.query('SELECT id, is_paid FROM leave_types');
        const leaveTypesMap = new Map(leaveTypesResult.rows.map(lt => [lt.id, lt.is_paid]));

        const records = [];
        const userShiftResult = await client.query('SELECT shift_type FROM users WHERE id = $1', [user_id]);
        const userShiftType = userShiftResult.rows[0]?.shift_type || 'day';
        const EXPECTED_SHIFT_START_TIME_DAY = '10:00:00';
        const EXPECTED_SHIFT_START_TIME_EVENING = '19:00:00';
        const STANDARD_WORKING_HOURS = 9.0;

        for (let d = startDate.clone(); d.isSameOrBefore(endDate); d.add(1, 'day')) {
            const targetDate = d.format('YYYY-MM-DD');
            const dayOfWeek = d.format('dddd');

            let record = {
                id: null,
                date: targetDate,
                day: dayOfWeek,
                shift: userShiftType,
                check_in: null,
                check_out: null,
                late_time: 0,
                working_hours: 0,
                extra_hours: 0,
                status: 'ABSENT', // Default status
                check_in_device: null,
                check_out_device: null,
                reason: null,
                admin_comment: null,
                created_at: null,
                updated_at: null
            };

            // --- REVISED LOGIC: Prioritize Holiday/Weekly Off/Leave status over attendance records ---
            if (holidays.has(targetDate)) {
                record.status = 'HOLIDAY';
            } else if (employeeSpecificWeeklyOffDates.has(targetDate)) {
                record.status = 'WEEKLY OFF';
            } else {
                // If not a holiday or weekly off, then check for approved leave
                const leave = leaveResult.rows.find(l =>
                    moment(targetDate).isBetween(l.from_date, l.to_date, 'day', '[]') && l.status === 'approved'
                );

                if (leave) {
                    const isLeavePaid = leaveTypesMap.get(leave.leave_type_id);
                    if (isLeavePaid === false) {
                        record.status = 'LOP';
                    } else {
                        record.status = leave.is_half_day ? 'HALF DAY LEAVE' : 'ON LEAVE';
                    }
                } else {
                    // If not a holiday, weekly off, or approved leave, check actual attendance record
                    const attendance = attendanceMap.get(targetDate);
                    if (attendance) {
                        const checkInMoment = attendance.check_in ? moment.tz(`${targetDate} ${attendance.check_in}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Kolkata') : null;
                        let checkOutMoment = attendance.check_out ? moment.tz(`${targetDate} ${attendance.check_out}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Kolkata') : null;

                        const shiftStart = userShiftType === 'evening'
                            ? moment.tz(`${targetDate} ${EXPECTED_SHIFT_START_TIME_EVENING}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Kolkata')
                            : moment.tz(`${targetDate} ${EXPECTED_SHIFT_START_TIME_DAY}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Kolkata');

                        let lateTimeMinutes = 0;
                        let currentStatus = 'ABSENT';

                        if (checkInMoment) {
                            if (checkInMoment.isAfter(shiftStart)) {
                                lateTimeMinutes = Math.floor(moment.duration(checkInMoment.diff(shiftStart)).asMinutes());
                                currentStatus = 'LATE';
                            } else {
                                currentStatus = 'PRESENT';
                            }
                        }

                        let workingHours = 0;
                        let extraHours = 0;
                        if (checkInMoment && checkOutMoment) {
                            if (checkOutMoment.isBefore(checkInMoment)) {
                                checkOutMoment = checkOutMoment.add(1, 'day');
                            }
                            workingHours = parseFloat((checkOutMoment.diff(checkInMoment, 'minutes') / 60).toFixed(2));
                            if (workingHours > STANDARD_WORKING_HOURS) {
                                extraHours = parseFloat((workingHours - STANDARD_WORKING_HOURS).toFixed(2));
                            }
                        }

                        record = {
                            ...record,
                            id: attendance.id,
                            check_in: checkInMoment ? checkInMoment.utc().format() : null,
                            check_out: checkOutMoment ? checkOutMoment.utc().format() : null,
                            late_time: lateTimeMinutes,
                            working_hours: workingHours,
                            extra_hours: extraHours,
                            status: ['PRESENT', 'LATE', 'ABSENT', 'ON_LEAVE', 'LOP', 'HALF-DAY'].includes(attendance.status.toUpperCase()) ?
                                    String(attendance.status).replace(/_/g, ' ').toUpperCase() : currentStatus,
                            check_in_device: attendance.check_in_device || null,
                            check_out_device: attendance.check_out_device || null,
                            reason: attendance.reason || null,
                            admin_comment: attendance.admin_comment || null,
                            created_at: attendance.created_at || null,
                            updated_at: attendance.updated_at || null
                        };
                    } else {
                        record.status = 'ABSENT';
                    }
                }
            }
            if (['HOLIDAY', 'WEEKLY OFF', 'ON LEAVE', 'HALF DAY LEAVE', 'LOP'].includes(record.status)) {
                record.check_in = null;
                record.check_out = null;
                record.late_time = 0;
                record.working_hours = 0;
                record.extra_hours = 0;
            }

            records.push(record);
        }

        console.log(`[ATTENDANCE_API_DEBUG] Final records array size before sending: ${records.length}`);

        if (date) {
            const singleRecord = records.find(r => r.date === date);
            console.log(`[ATTENDANCE_API_DEBUG] Single record found for date ${date}:`, singleRecord);
            res.status(200).json(singleRecord || null);
        } else {
            res.status(200).json(records);
        }

    } catch (error) {
        console.error('[ATTENDANCE_API_ERROR] Error in /api/attendance GET route:', error.message, error.stack);
        if (!res.headersSent) {
            res.status(500).json({ message: `Server error fetching attendance data: ${error.message}` });
        }
    } finally {
        if (client) {
            client.release();
        }
    }
});


// Employee check-in endpoint (Already updated for UTC ISO in response)
router.post('/attendance/check-in', authenticate, async (req, res) => {
    let client = null; // Initialize client to null
    try {
        client = await pool.connect(); // Assign client here

        const { latitude, longitude } = req.body;
        const user_id = req.user.id;
        const shiftType = req.user.shift_type;
        const device = req.useragent ? req.useragent.source : 'Unknown Device';
        const today = moment().tz('Asia/Kolkata').format('YYYY-MM-DD');
        const currentTime = moment().tz('Asia/Kolkata').format('HH:mm:ss'); // Store time as HH:mm:ss in DB

        console.log(`Backend: Check-in request for user ${user_id} on ${today} at ${currentTime}`);
        console.log(`Backend: Latitude: ${latitude}, Longitude: ${longitude}, Device: ${device}`);

        await client.query('BEGIN');

        const expectedShiftStartTime = shiftType === 'evening' ? '18:00:00' : '09:00:00';
        const shiftStartMoment = moment(expectedShiftStartTime, 'HH:mm:ss');
        const checkInMoment = moment(currentTime, 'HH:mm:ss');

        let lateTimeMinutes = 0;
        if (checkInMoment.isAfter(shiftStartMoment)) {
            lateTimeMinutes = Math.floor(moment.duration(checkInMoment.diff(shiftStartMoment)).asMinutes());
        }

        const upsertQuery = `
            INSERT INTO attendance (
                user_id, date, check_in, status, late_time,
                check_in_latitude, check_in_longitude, check_in_device
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (user_id, date) DO UPDATE SET
                check_in = COALESCE(attendance.check_in, EXCLUDED.check_in),
                status = COALESCE(attendance.status, EXCLUDED.status),
                late_time = COALESCE(attendance.late_time, EXCLUDED.late_time),
                check_in_latitude = COALESCE(attendance.check_in_latitude, EXCLUDED.check_in_latitude),
                check_in_longitude = COALESCE(attendance.check_in_longitude, EXCLUDED.check_in_longitude),
                check_in_device = COALESCE(attendance.check_in_device, EXCLUDED.check_in_device),
                updated_at = CURRENT_TIMESTAMP
            RETURNING *;
        `;
        console.log(`[CHECK-IN DB WRITE DEBUG] Attempting to write check_in: ${currentTime} for date: ${today}`);
        const upsertResult = await client.query(upsertQuery, [
            user_id,
            today,
            currentTime,
            lateTimeMinutes > 0 ? 'LATE' : 'PRESENT',
            lateTimeMinutes,
            latitude,
            longitude,
            device
        ]);

        const attendanceRecord = upsertResult.rows[0];
        console.log('Backend: UPSERT result attendanceRecord:', attendanceRecord);

        if (!attendanceRecord) {
            await client.query('ROLLBACK');
            console.error('Backend: CRITICAL ERROR: UPSERT operation for check-in did not return a row. User ID:', user_id, 'Date:', today);
            return res.status(500).json({ message: 'Internal server error: Failed to record attendance due to an unexpected database response.' });
        }

        const returnedCheckInTime = attendanceRecord.check_in ? moment(attendanceRecord.check_in, 'HH:mm:ss').format('HH:mm:ss') : null;
        console.log(`Backend: Returned check-in time from DB: ${returnedCheckInTime}, Current attempt time: ${currentTime}`);

        if (returnedCheckInTime && returnedCheckInTime !== currentTime) {
            await client.query('ROLLBACK');
            console.log('Backend: Check-in rejected - Already checked in today.');
            return res.status(400).json({ message: 'You have already checked in today.' });
        }

        await client.query('COMMIT');
        console.log('Backend: Check-in successful, transaction committed.');

        // Convert times to UTC ISO 8601 strings before sending to frontend
        const checkInMomentIST = attendanceRecord.check_in ? moment.tz(`${today} ${attendanceRecord.check_in}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Kolkata') : null;
        const checkOutMomentIST = attendanceRecord.check_out ? moment.tz(`${today} ${attendanceRecord.check_out}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Kolkata') : null;

        res.status(201).json({
            message: 'Checked in successfully.',
            attendance: {
                ...attendanceRecord,
                check_in: checkInMomentIST ? checkInMomentIST.utc().format() : null,
                check_out: checkOutMomentIST ? checkOutMomentIST.utc().format() : null,
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Backend: Error in /api/attendance/check-in (caught in catch block):', error.message, error.stack, error);
        // Ensure only one response is sent
        if (!res.headersSent) {
            res.status(500).json({ message: `Server error during check-in: ${error.message}` });
        }
    } finally {
        if (client) {
            client.release();
        }
    }
});

// Check-out endpoint (Already updated for UTC ISO in response)
router.post('/attendance/check-out', authenticate, async (req, res) => {
    let client = null; // Initialize client to null
    try {
        client = await pool.connect(); // Assign client here

        const { latitude, longitude } = req.body;
        const user_id = req.user.id;
        const device = req.useragent ? req.useragent.source : 'Unknown Device';
        const today = moment().tz('Asia/Kolkata').format('YYYY-MM-DD');
        const currentTime = moment().tz('Asia/Kolkata').format('HH:mm:ss'); // Store time as HH:mm:ss in DB

        console.log(`Backend: Check-out request for user ${user_id} on ${today} at ${currentTime}`);
        console.log(`Backend: Latitude: ${latitude}, Longitude: ${longitude}, Device: ${device}`);

        await client.query('BEGIN');

        const result = await client.query(
            'SELECT * FROM attendance WHERE user_id = $1 AND date = $2',
            [user_id, today]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            console.log('Backend: Check-out rejected - No check-in record found for today.');
            return res.status(400).json({ message: 'You must check in before checking out.' });
        }

        const attendanceRecord = result.rows[0];

        if (!attendanceRecord.check_in) {
            await client.query('ROLLBACK');
            console.log('Backend: Check-out rejected - Check-in time is null.');
            return res.status(400).json({ message: 'You must check in before checking out.' });
        }

        if (attendanceRecord.check_out) {
            await client.query('ROLLBACK');
            console.log('Backend: Check-out rejected - Already checked out today.');
            return res.status(400).json({ message: 'You have already checked out today.' });
        }

        const checkInTimeStr = attendanceRecord.check_in;
        const checkOutTimeStr = currentTime;

        // Correctly parse time strings by combining with today's date for moment objects
        const checkInMomentWithDate = moment.tz(`${today} ${checkInTimeStr}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Kolkata');
        let checkOutMomentWithDate = moment.tz(`${today} ${checkOutTimeStr}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Kolkata');

        if (checkOutMomentWithDate.isBefore(checkInMomentWithDate)) {
            checkOutMomentWithDate.add(1, 'day');
        }

        let workingHours = 0;
        if (checkOutMomentWithDate.isAfter(checkInMomentWithDate)) {
            workingHours = parseFloat((checkOutMomentWithDate.diff(checkInMomentWithDate, 'minutes') / 60).toFixed(2));
        }

        const STANDARD_WORKING_HOURS = 8.5;
        let extraHours = workingHours > STANDARD_WORKING_HOURS ? parseFloat((workingHours - STANDARD_WORKING_HOURS).toFixed(2)) : 0;

        const updateResult = await client.query(
            `UPDATE attendance
             SET check_out = $1, working_hours = $2, extra_hours = $3,
                 check_out_latitude = $4, check_out_longitude = $5, check_out_device = $6, updated_at = CURRENT_TIMESTAMP
             WHERE id = $7 RETURNING *`,
            [
                currentTime,
                workingHours,
                extraHours,
                latitude,
                longitude,
                device,
                attendanceRecord.id
            ]
        );

        await client.query('COMMIT');
        console.log('Backend: Check-out successful, transaction committed.');

        // Convert times to UTC ISO 8601 strings before sending to frontend
        const updatedAttendanceRecord = updateResult.rows[0];
        const checkInMomentIST = updatedAttendanceRecord.check_in ? moment.tz(`${today} ${updatedAttendanceRecord.check_in}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Kolkata') : null;
        const checkOutMomentIST = updatedAttendanceRecord.check_out ? moment.tz(`${today} ${updatedAttendanceRecord.check_out}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Kolkata') : null;

        res.status(200).json({
            message: 'Checked out successfully.',
            attendance: {
                ...updatedAttendanceRecord,
                check_in: checkInMomentIST ? checkInMomentIST.utc().format() : null,
                check_out: checkOutMomentIST ? checkOutMomentIST.utc().format() : null,
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Backend: Error in /api/attendance/check-out (caught in catch block):', error.message, error.stack, error);
        // Ensure only one response is sent
        if (!res.headersSent) {
            res.status(500).json({ message: `Server error during check-out: ${error.message}` });
        }
    } finally {
        if (client) {
            client.release();
        }
    }
});

// --- Correction Endpoints ---

// Employee submits attendance correction request
router.post('/attendance/correction-request', authenticate, async (req, res) => {
  const { date, expected_check_in, expected_check_out, reason } = req.body;
  const user_id = req.user.id;
  const userName = req.user.name; // Get user name from authenticated user
  const employeeId = req.user.employee_id; // Get employee ID from authenticated user

  if (!date || !expected_check_in || !reason) {
    return res.status(400).json({ message: 'Date, expected check-in, and reason are required.' });
  }

  try {
    // Check if a pending correction request already exists for this user and date
    const existingRequest = await pool.query(
      'SELECT id FROM corrections WHERE user_id = $1 AND date = $2 AND status = $3',
      [user_id, date, 'pending']
    );

    if (existingRequest.rows.length > 0) {
      return res.status(409).json({ message: 'A pending correction request for this date already exists.' });
    }

    const result = await pool.query(
      'INSERT INTO corrections (user_id, user_name, employee_id, date, expected_check_in, expected_check_out, reason, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [user_id, userName, employeeId, date, expected_check_in, expected_check_out || null, reason, 'pending']
    );

    // Notify admin about new correction request (optional, could be a separate notification system)
    await pool.query(
      'INSERT INTO notifications (user_id, message, is_admin_notification) VALUES ($1, $2, $3)',
      [user_id, `New attendance correction request from ${userName} (${employeeId}) for ${date}.`, true] // Notify admin
    );

    res.status(201).json({ message: 'Correction request submitted successfully.', data: result.rows[0] });
  } catch (error) {
    console.error('Error submitting correction request:', error);
    res.status(500).json({ message: 'Server error submitting correction request: ' + error.message });
  }
});

router.get('/corrections', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const { rows } = await client.query(
      'SELECT id, user_id, user_name, employee_id, date, expected_check_in, expected_check_out, reason, status, assigned_admin_name, created_at FROM corrections WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Get user corrections error:', error.message, error.stack);
    res.status(500).json({ message: `Server error getting user corrections: ${error.message}` });
  } finally {
    client.release();
  }
});


// --- Leave Application ---

router.post('/leaves/apply', authenticate, async (req, res) => {
    const client = await pool.connect(); // Use client for transaction
    try {
        const { leave_type_id, from_date, to_date, reason, is_half_day } = req.body;
        const user_id = req.user.id;
        const userName = req.user.name;
        const employeeId = req.user.employee_id;

        if (!leave_type_id || !from_date || !to_date || !reason) {
            return res.status(400).json({ message: 'All leave application fields are required.' });
        }
        if (!moment(from_date).isValid() || !moment(to_date).isValid() || moment(from_date).isAfter(moment(to_date))) {
            return res.status(400).json({ message: 'Invalid date range provided.' });
        }

        await client.query('BEGIN'); // Start transaction

        const leaveTypeResult = await client.query('SELECT name, is_paid FROM leave_types WHERE id = $1', [leave_type_id]);
        if (leaveTypeResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Invalid leave type.' });
        }
        const leaveType = leaveTypeResult.rows[0];

        // Calculate duration excluding weekends and holidays
        let duration;
        if (is_half_day) {
            duration = 0.5; // If it's a half-day application, the duration is simply 0.5
        } else {
            let currentDay = moment(from_date);
            let calculatedDays = 0;
            // Fetch holidays using the correct column name
            const holidaysResult = await client.query('SELECT holiday_date FROM holidays');
            const holidayDates = new Set(holidaysResult.rows.map(row => moment(row.holiday_date).format('YYYY-MM-DD')));

            // Fetch weekly offs for the user
            const weeklyOffsConfigResult = await client.query(
                `SELECT weekly_off_days, effective_date FROM weekly_offs WHERE user_id = $1 ORDER BY effective_date DESC`,
                [user_id]
            );

            while (currentDay.isSameOrBefore(moment(to_date))) {
                const dateStr = currentDay.format('YYYY-MM-DD');
                const dayOfWeek = currentDay.day(); // 0 for Sunday, 6 for Saturday

                let isWeekend = false;
                // Determine the most recent weekly off configuration for the current date
                const relevantWeeklyOffConfig = weeklyOffsConfigResult.rows
                    .filter(row => moment.utc(row.effective_date).isSameOrBefore(currentDay, 'day'))
                    .sort((a, b) => moment.utc(b.effective_date).diff(moment.utc(a.effective_date)))[0];

                if (relevantWeeklyOffConfig && Array.isArray(relevantWeeklyOffConfig.weekly_off_days)) {
                    isWeekend = relevantWeeklyOffConfig.weekly_off_days.includes(dayOfWeek);
                } else {
                    // Fallback to default weekends if no specific config found or invalid
                    isWeekend = (dayOfWeek === 0 || dayOfWeek === 6); // Default to Sunday and Saturday
                }

                const isHoliday = holidayDates.has(dateStr);

                if (!isWeekend && !isHoliday) {
                    calculatedDays += 1; // Count full working days
                }
                currentDay.add(1, 'day');
            }
            duration = calculatedDays;
        }

        // Allow application irrespective of balance. Balance check and deduction happens on approval.
        const result = await client.query(
            'INSERT INTO leave_applications (user_id, user_name, employee_id, leave_type_id, from_date, to_date, reason, is_half_day, status, duration) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
            [user_id, userName, employeeId, leave_type_id, from_date, to_date, reason, is_half_day || false, 'pending', duration]
        );

        // Notify the user about their application
        await client.query(
            'INSERT INTO notifications (user_id, message) VALUES ($1, $2)',
            [user_id, `Your leave application for ${leaveType.name} from ${from_date} to ${to_date} (${duration} days) has been submitted for approval.`]
        );

        await client.query('COMMIT'); // Commit transaction
        res.status(201).json({ message: 'Leave application submitted!', data: result.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK'); // Rollback on error
        console.error('Error applying for leave:', error.message, error.stack);
        res.status(500).json({ message: 'Server error applying for leave.' });
    } finally {
        client.release();
    }
});



// Employee view of their leave applications
router.get('/leaves/my', authenticate, async (req, res) => {
    const user_id = req.user.id;
    let client; // Declare client here
    try {
        client = await pool.connect(); // Assign client here
        const result = await client.query(
            `SELECT
                la.id,
                la.user_id,
                la.leave_type_id,
                la.from_date,
                la.to_date,
                la.reason,
                la.status,
                la.is_half_day,
                la.admin_comment,
                la.cancellation_reason,
                la.created_at,
                la.updated_at,
                lt.name AS leave_type_name,
                lt.is_paid
            FROM leave_applications la
            JOIN leave_types lt ON CAST(la.leave_type_id AS INTEGER) = lt.id
            WHERE la.user_id = $1
            ORDER BY la.created_at DESC`,
            [user_id]
        );

        // Map over the results to calculate duration_days on the fly
        const leaveApplications = result.rows.map(app => {
            const fromDate = moment(app.from_date);
            const toDate = moment(app.to_date);

            // Calculate duration in days, including both start and end dates
            // Add 1 to the difference because diff() is exclusive of the end date
            let calculatedDurationDays = toDate.diff(fromDate, 'days') + 1;

            // Adjust for half-day if applicable
            if (app.is_half_day && calculatedDurationDays === 1) {
                calculatedDurationDays = 0.5;
            } else if (app.is_half_day && calculatedDurationDays > 1) {
                console.warn(`[LEAVE_DURATION_WARNING] Multi-day leave (${app.id}) is marked as half-day.
                                Review if this is intended or if half-day applies to a specific part of the leave.`);
            }

            return {
                ...app,
                // Assign the calculated duration to the 'duration' field,
                // which your frontend table expects.
                duration: parseFloat(calculatedDurationDays.toFixed(2))
            };
        });

        res.status(200).json(leaveApplications);
    } catch (error) {
        console.error('Error fetching user leave applications:', error.message, error.stack);
        res.status(500).json({ message: 'Server error fetching leave applications.' });
    } finally {
        if (client) {
            client.release();
        }
    }
});

// NEW: Public/Employee route to get all leave types (no admin auth required)
router.get('/leaves/types', authenticate, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name, description, is_paid, default_days_per_year FROM leave_types ORDER BY name ASC');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching public leave types:', error);
        res.status(500).json({ message: 'Server error fetching leave types for employees.' });
    }
});

// Employee: Request cancellation of an approved leave
router.put('/leaves/:id/request-cancellation', authenticate, async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id; // User making the request
    const { cancellation_reason } = req.body || {};

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Fetch the leave application to ensure it belongs to the user and is in 'approved' status
        const leaveAppResult = await client.query(
            'SELECT * FROM leave_applications WHERE id = $1 AND user_id = $2 FOR UPDATE',
            [id, user_id]
        );

        if (leaveAppResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Leave application not found or does not belong to you.' });
        }

        const leaveApplication = leaveAppResult.rows[0];

        // Only allow cancellation request for 'approved' leaves
        if (leaveApplication.status !== 'approved') {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Only approved leaves can be requested for cancellation.' });
        }

        // Update the leave application status to 'cancellation_pending'
        const updateLeaveQuery = `
            UPDATE leave_applications
            SET status = 'cancellation_pending', cancellation_reason = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *;
        `;
        const result = await client.query(updateLeaveQuery, [cancellation_reason || null, id]);

        // Notify all admins about the pending cancellation request
        const adminsResult = await client.query('SELECT id FROM users WHERE role = \'admin\'');
        const adminIds = adminsResult.rows.map(row => row.id);

        for (const adminId of adminIds) {
            await client.query(
                `INSERT INTO notifications (user_id, message, is_read, is_admin_notification, type)
                 VALUES ($1, $2, FALSE, TRUE, 'leave_cancellation_request');`,
                [adminId, `Employee ${req.user.name} (${req.user.employee_id}) has requested to cancel their leave from ${leaveApplication.from_date} to ${leaveApplication.to_date} (Type: ${leaveApplication.leave_type_name || 'N/A'}).`]
            );
        }

        // Also notify the user that their cancellation request has been submitted
        await client.query(
            `INSERT INTO notifications (user_id, message, is_read, is_admin_notification, type)
             VALUES ($1, $2, FALSE, FALSE, 'leave_cancellation_submitted');`,
            [user_id, `Your cancellation request for leave from ${leaveApplication.from_date} to ${leaveApplication.to_date} has been submitted for admin review.`]
        );

        await client.query('COMMIT');
        res.status(200).json({ message: 'Leave cancellation request submitted successfully!', leave: result.rows[0] });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error requesting leave cancellation:', error.message, error.stack);
        res.status(500).json({ message: 'Server error requesting leave cancellation.' });
    } finally {
        client.release();
    }
});


// --- Holiday Endpoints ---
router.get('/holidays', authenticate, async (req, res) => {
  try {
    const { year } = req.query;
    const targetYear = year || moment().tz('Asia/Kolkata').year();
    // Corrected column name to holiday_date
    const { rows } = await pool.query('SELECT * FROM holidays WHERE EXTRACT(YEAR FROM holiday_date)=$1 ORDER BY holiday_date', [targetYear]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching holidays:', error.message, error.stack);
    res.status(500).json({ message: 'Server error fetching holidays.' });
  }
});

// --- Notification Endpoints ---
router.get('/notifications/my', authenticate, async (req, res) => {
  const user_id = req.user.id;
  const { unreadOnly } = req.query;
  let queryText = 'SELECT id, user_id, message, created_at, is_read FROM notifications WHERE user_id = $1 OR user_id IS NULL';
  const queryParams = [user_id];
  if (unreadOnly === 'true') {
    queryText += ' AND is_read = FALSE';
  }
  queryText += ' ORDER BY created_at DESC';
  try {
    const { rows } = await pool.query(queryText, queryParams);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching user notifications:', error.message, error.stack);
    res.status(500).json({ message: 'Server error fetching notifications.' });
  }
});

router.put('/notifications/:id/read', authenticate, async (req, res) => {
  const { id } = req.params;
  const user_id = req.user.id;
  try {
    const checkNotification = await pool.query('SELECT user_id FROM notifications WHERE id = $1', [id]);
    if (checkNotification.rows.length === 0) {
      return res.status(404).json({ message: 'Notification not found.' });
    }
    const notificationOwnerId = checkNotification.rows[0].user_id;
    // Allow owner or admin to mark as read
    if (notificationOwnerId !== null && notificationOwnerId !== user_id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. You can only mark your own or global notifications as read.' });
    }
    const result = await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 RETURNING *',
      [id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error marking notification as read:', error.message, error.stack);
    res.status(500).json({ message: 'Server error marking notification as read.' });
  }
});

// --- User Profile Management ---

// User Photo Upload
router.post('/users/photo', authenticate, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No photo uploaded.' });
    }
    const photoFilename = req.file.filename; // Just the filename
    await pool.query('UPDATE users SET profile_photo = $1 WHERE id = $2', [photoFilename, req.user.id]);
    res.json({ message: 'Profile photo uploaded successfully.', photo_url: `/uploads/profile_photos/${photoFilename}` });
  } catch (error) {
    console.error('Error uploading profile photo:', error.message, error.stack);
    res.status(500).json({ message: 'Server error uploading profile photo.' });
  }
});

// NEW ENDPOINT: Employee submits a profile update request for admin review
router.post('/employee/profile-update-request', authenticate, async (req, res) => {
  const { requested_data, reason } = req.body; // requested_data should be a JSON object of fields to update
  const user_id = req.user.id;
  const userName = req.user.name;
  const employeeId = req.user.employee_id;

  if (!requested_data || Object.keys(requested_data).length === 0 || !reason) {
    return res.status(400).json({ message: 'Requested data and reason are required.' });
  }

  // Basic validation for requested_data structure (optional, but good practice)
  const allowedFields = ['pan_card_number', 'bank_account_number', 'ifsc_code', 'bank_name', 'date_of_birth', 'address', 'mobile_number', 'kyc_details', 'personal_details', 'family_history'];
  const invalidFields = Object.keys(requested_data).filter(field => !allowedFields.includes(field));
  if (invalidFields.length > 0) {
    return res.status(400).json({ message: `Invalid fields in request: ${invalidFields.join(', ')}` });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Check for existing pending request from this user to prevent duplicates
    const existingRequest = await client.query(
      'SELECT id FROM profile_update_requests WHERE user_id = $1 AND status = $2',
      [user_id, 'pending']
    );
    if (existingRequest.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'You already have a pending profile update request.' });
    }

    const result = await client.query(
      'INSERT INTO profile_update_requests (user_id, requested_data, reason, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [user_id, requested_data, reason, 'pending']
    );

    // Notify admin about the new request
    // user_id = null means it's a global notification for all admins
    await client.query(
      'INSERT INTO notifications (user_id, message, is_admin_notification) VALUES ($1, $2, $3)',
      [null, `New profile update request from ${userName} (ID: ${employeeId}).`, true]
    );

    await client.query('COMMIT');
    res.status(201).json({ message: 'Profile update request submitted successfully.', data: result.rows[0] });

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Error submitting profile update request:', error.message, error.stack);
    res.status(500).json({ message: 'Server error submitting profile update request.' });
  } finally {
    if (client) client.release();
  }
});


// --- Employee Analytics & Dashboards ---

// Employee Analytics Endpoint
router.get('/analytics', authenticate, async (req, res) => {
    const { year, month } = req.query;
    const user_id = req.user.id; // Get user ID from authenticated request

    if (!year || !month) {
        console.error('[ANALYTICS ERROR] Year and month are required.');
        return res.status(400).json({ message: 'Year and month are required.' });
    }
    if (!/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(month) || parseInt(month) < 1 || parseInt(month) > 12) {
        console.error(`[ANALYTICS ERROR] Invalid year or month format: Year=${year}, Month=${month}`);
        return res.status(400).json({ message: 'Invalid year or month format.' });
    }

    const client = await pool.connect();
    try {
        // CALL THE SHARED HELPER FUNCTION
        const attendanceSummary = await calculateAttendanceSummary(user_id, parseInt(year), parseInt(month), client);

        // Map the output from calculateAttendanceSummary to the keys expected by your frontend
        const responseData = {
            presentDays: attendanceSummary.presentDays,
            lateDays: attendanceSummary.lateDays,
            leaveDays: attendanceSummary.leaveDays, // This is onLeaveDays (paid leaves)
            lopDays: attendanceSummary.lopDays, // This is unpaid leaves
            holidays: attendanceSummary.holidaysCount,
            weeklyOffs: attendanceSummary.actualWeeklyOffDays,
            absentDays: attendanceSummary.absentDays, // Unaccounted absent working days
            totalWorkingDays: attendanceSummary.totalWorkingDaysInMonth, // Total expected working days
            totalWorkingHours: attendanceSummary.totalWorkingHours,
            averageDailyHours: attendanceSummary.averageDailyHours,
            dailyStatusMap: attendanceSummary.dailyStatusMap // Pass the daily status map
        };

        console.log(`[ANALYTICS DEBUG] Final Analytics Data (from calculateAttendanceSummary):`, responseData);

        res.json(responseData);

    } catch (error) {
        console.error('Error in /api/analytics:', error.message, error.stack);
        res.status(500).json({ message: `Server error fetching analytics: ${error.message}` });
    } finally {
        client.release();
    }
});

// Leave Balance Endpoint (Employee)
router.get('/leaves/my-balances', authenticate, async (req, res) => {
    const user_id = req.user.id;
    try {
        const result = await pool.query(`
            SELECT
                lb.user_id,
                u.name AS user_name,
                u.employee_id,
                lb.leave_type,
                lb.current_balance,
                lb.total_days_allocated,
                lt.description,
                lt.is_paid,
                lt.default_days_per_year,
                lb.last_updated AS updated_at
            FROM leave_balances lb
            JOIN users u ON lb.user_id = u.id
            LEFT JOIN leave_types lt ON lb.leave_type = lt.name
            WHERE lb.user_id = $1
            ORDER BY lb.leave_type ASC
        `, [user_id]);

        // Filter out LOP if current_balance is 0 or less, or if it's not explicitly requested
        const filteredBalances = result.rows.filter(balance => {
            if (balance.leave_type === 'LOP') {
                // Only include LOP if its balance is positive (meaning outstanding LOP days)
                return parseFloat(balance.current_balance) > 0;
            }
            return true; // Include all other leave types
        });

        res.status(200).json(filteredBalances);
    } catch (error) {
        console.error('Error in /api/leaves/my-balances:', error.message, error.stack);
        res.status(500).json({ message: `Server error fetching leave balances: ${error.message}` });
    }
});

// GET /api/employee/payslips/my - Get all payslips for the logged-in employee
router.get('/employee/payslips/my', authenticate, async (req, res) => {
    const userId = req.user.id; // Get user ID from authenticated token
    try {
        const result = await pool.query(
            'SELECT id, payslip_month, payslip_year, gross_earnings, net_pay, file_path, created_at FROM payslips WHERE user_id = $1 ORDER BY payslip_year DESC, payslip_month DESC',
            [userId]
        );
        res.json(result.rows);
    }
    catch (error) {
        console.error('Error fetching my payslips:', error.message, error.stack);
        res.status(500).json({ message: 'Server error fetching your payslips.' });
    }
});

// GET /api/employee/payslips/:payslipId/download - Download a specific payslip file
router.get('/employee/payslips/:payslipId/download', authenticate, async (req, res) => {
    const { payslipId } = req.params;
    const userId = req.user.id; // Get user ID from authenticated token

    try {
        const result = await pool.query(
            'SELECT file_path FROM payslips WHERE id = $1 AND user_id = $2',
            [payslipId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Payslip not found or you do not have permission to download it.' });
        }

        const filePath = result.rows[0].file_path;
        const absolutePath = path.join(__dirname, '..', filePath); // Construct absolute path from project root

        // Ensure the file exists and is a PDF
        if (fs.existsSync(absolutePath) && path.extname(absolutePath).toLowerCase() === '.pdf') {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${path.basename(absolutePath)}"`);
            res.sendFile(absolutePath);
        } else {
            res.status(404).json({ message: 'Payslip file not found or is not a PDF.' });
        }
    } catch (error) {
        console.error('Error downloading payslip:', error.message, error.stack);
        res.status(500).json({ message: 'Server error downloading payslip.' });
    }
});

// GET /api/employee/weekly-offs - Get weekly off configurations for the logged-in employee
router.get('/employee/weekly-offs', authenticate, async (req, res) => {
    const user_id = req.user.id;
    const { month, year } = req.query;

    if (!month || !year) {
        return res.status(400).json({ message: 'Month and year are required.' });
    }

    const startDateOfMonth = moment.utc(`${year}-${month}-01`);
    const endDateOfMonth = moment.utc(startDateOfMonth).endOf('month');

    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT id, user_id, weekly_off_days, effective_date FROM weekly_offs
             WHERE user_id = $1
             AND effective_date <= $2
             ORDER BY effective_date DESC`, // Order by effective_date to get the most recent config
            [user_id, endDateOfMonth.format('YYYY-MM-DD')]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching employee weekly offs:', error.message, error.stack);
        res.status(500).json({ message: 'Server error fetching weekly offs.' });
    } finally {
        client.release();
    }
});

// GET /api/employee/holidays - Get public holidays for the month
router.get('/employee/holidays', authenticate, async (req, res) => {
    const { month, year } = req.query;

    if (!month || !year) {
        return res.status(400).json({ message: 'Month and year are required.' });
    }

    const startDateOfMonth = moment.utc(`${year}-${month}-01`);
    const endDateOfMonth = moment.utc(startDateOfMonth).endOf('month');

    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT id, holiday_date, holiday_name FROM holidays
             WHERE holiday_date BETWEEN $1 AND $2
             ORDER BY holiday_date`,
            [startDateOfMonth.format('YYYY-MM-DD'), endDateOfMonth.format('YYYY-MM-DD')]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching public holidays:', error.message, error.stack);
        res.status(500).json({ message: 'Server error fetching public holidays.' });
    } finally {
        client.release();
    }
});

// NEW ENDPOINT: Get birthdays for the current month
router.get('/birthdays/this-month', authenticate, async (req, res) => {
  try {
    const currentMonth = moment().month() + 1; // Get current month (1-indexed)

    const { rows } = await pool.query(
      `SELECT
        id, name, employee_id, email, profile_photo, date_of_birth
       FROM users
       WHERE EXTRACT(MONTH FROM date_of_birth) = $1
       ORDER BY EXTRACT(DAY FROM date_of_birth) ASC`,
      [currentMonth]
    );

    // Format profile_photo URL and date_of_birth
    const birthdays = rows.map(user => ({
      id: user.id,
      name: user.name,
      employee_id: user.employee_id,
      email: user.email,
      profile_photo_url: user.profile_photo ? `/uploads/profile_photos/${user.profile_photo}` : null,
      date_of_birth: user.date_of_birth ? moment(user.date_of_birth).format('YYYY-MM-DD') : null,
    }));

    res.json(birthdays);
  } catch (error) {
    console.error('Error fetching birthdays this month:', error.message, error.stack);
    res.status(500).json({ message: 'Server error fetching birthdays.' });
  }
});


// --- Legacy Endpoint Redirects (Moved from index.js) ---

router.get('/holidays', authenticate, async (req, res) => {
  res.redirect(307, `/api/holidays?${new URLSearchParams(req.query).toString()}`);
});

router.get('/leaves', authenticate, async (req, res) => {
  res.redirect(307, '/api/leaves/my');
});

router.post('/leaves/apply', authenticate, async (req, res) => {
  res.redirect(307, '/api/leaves/apply');
});

router.get('/leave-balances', authenticate, async (req, res) => {
  res.redirect(307, '/api/leaves/my-balances');
});

router.get('/notifications', authenticate, async (req, res) => {
  res.redirect(307, `/api/notifications/my?${new URLSearchParams(req.query).toString()}`);
});

// Note: The /admin redirects will be in admin.routes.js

module.exports = router;