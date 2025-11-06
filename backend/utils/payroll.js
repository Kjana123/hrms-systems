// utils/payroll.js
console.log(`[FILE_LOAD_CHECK] utils/payroll.js loaded at ${new Date().toISOString()}`);

const moment = require('moment-timezone');
const PDFDocument = require('pdfkit'); // For PDF generation
const fs = require('fs');
const path = require('path');

// Helper function to map day names to Moment.js day numbers (0-6)
const dayNameToMomentDay = {
    'Sunday': 0,
    'Monday': 1,
    'Tuesday': 2,
    'Wednesday': 3,
    'Thursday': 4,
    'Friday': 5,
    'Saturday': 6
};

// Helper function to calculate attendance summary (used by both summary and payroll calculation)
async function calculateAttendanceSummary(userId, year, month, client, leaveApplications, rejectedLeaves) {
    console.log(`[CODE_VERSION_CHECK] Running calculateAttendanceSummary v8.21 (July 17, 2025 - Attendance Layout & Typo Fix)`);
    // Ensure month is always two digits for consistent parsing
    const formattedMonth = String(month).padStart(2, '0');
    const startDateOfMonth = moment.utc(`${year}-${formattedMonth}-01`);
    const endDateOfMonth = moment.utc(startDateOfMonth).endOf('month');
    const totalCalendarDays = endDateOfMonth.date(); // Number of days in the month

    console.log(`[ATTENDANCE_SUMMARY_DEBUG] Calculating for User ID: ${userId}, Month: ${formattedMonth}, Year: ${year}`);
    console.log(`[ATTENDANCE_SUMMARY_DEBUG] Period: ${startDateOfMonth.format('YYYY-MM-DD')} to ${endDateOfMonth.format('YYYY-MM-DD')}`);

    // Fetch all weekly off configurations for the employee that are relevant to the month
    const weeklyOffsConfigResult = await client.query(
        `SELECT weekly_off_days, effective_date, end_date FROM weekly_offs
         WHERE user_id = $1
         AND effective_date <= $2`, // Weekly off config is effective from this date onwards
        [userId, endDateOfMonth.format('YYYY-MM-DD')]
    );
    const weeklyOffsConfig = weeklyOffsConfigResult.rows;
    console.log(`[ATTENDANCE_SUMMARY_DEBUG] Raw weekly_offs_config from DB (${weeklyOffsConfig.length} rows):`, weeklyOffsConfig);

    // Fetch all public holidays for the month
    const holidaysResult = await client.query(
        `SELECT holiday_date FROM holidays
         WHERE holiday_date BETWEEN $1 AND $2`,
        [startDateOfMonth.format('YYYY-MM-DD'), endDateOfMonth.format('YYYY-MM-DD')]
    );
    const publicHolidayDates = new Set(holidaysResult.rows.map(row => moment.utc(row.holiday_date).format('YYYY-MM-DD')));
    console.log(`[ATTENDANCE_SUMMARY_DEBUG] Public Holiday Dates for month:`, Array.from(publicHolidayDates));

    // Fetch attendance records for the month
    const attendanceRecords = (await client.query(
        `SELECT date, status, check_in, check_out, working_hours, late_time, extra_hours, daily_leave_duration FROM attendance
         WHERE user_id = $1 AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3`,
        [userId, month, year]
    )).rows;
    console.log(`[ATTENDANCE_SUMMARY_DEBUG] Raw attendance records from DB (${attendanceRecords.length} rows):`, attendanceRecords);

    const attendanceMap = new Map(
        attendanceRecords.map(att => [moment.utc(att.date).format('YYYY-MM-DD'), att])
    );

    // Convert leave applications to maps for efficient lookup by date
    // Note: This function now expects leaveApplications and rejectedLeaves as arguments
    const leaveMap = new Map(); // Stores approved/pending leaves
    if (Array.isArray(leaveApplications)) {
        leaveApplications.forEach(leave => {
            const startDate = moment.utc(leave.start_date);
            const endDate = moment.utc(leave.end_date);
            for (let m = moment.utc(startDate); m.isSameOrBefore(endDate, 'day'); m.add(1, 'days')) {
                leaveMap.set(m.format('YYYY-MM-DD'), leave);
            }
        });
    }

    // Rejected leaves map is still used, but its interaction with holidays/weekly offs is changed.
    const rejectedLeaveMap = new Map(); // Stores rejected leaves
    if (Array.isArray(rejectedLeaves)) {
        rejectedLeaves.forEach(leave => {
            const startDate = moment.utc(leave.start_date);
            const endDate = moment.utc(leave.end_date);
            for (let m = moment.utc(startDate); m.isSameOrBefore(endDate, 'day'); m.add(1, 'days')) {
                rejectedLeaveMap.set(m.format('YYYY-MM-DD'), leave);
            }
        });
    }


    let presentDays = 0;
    let lateDays = 0;
    let onLeaveDays = 0; // This will sum *paid* leaves from attendance status
    let lopDays = 0; // This will sum *unpaid* leaves from attendance status
    let absentWorkingDays = 0; // Days that should have been worked but weren't present/leave/lop
    let totalActualWorkingHours = 0;
    let actualWeeklyOffDays = 0;
    let holidaysCount = 0;
    let totalExpectedWorkingDays = 0; // Days employee was expected to work (not WO, not Holiday)

    const today = moment.utc().startOf('day');

    // Map to store daily statuses for the attendance history table / analytics display
    const dailyStatusMap = new Map();


    for (let day = 1; day <= totalCalendarDays; day++) {
        const currentDate = moment.utc(`${year}-${formattedMonth}-${String(day).padStart(2, '0')}`);
        const formattedDate = currentDate.format('YYYY-MM-DD');
        const currentMomentDayOfWeek = currentDate.day(); // 0 for Sunday, 6 for Saturday

        // Determine the most recent weekly off configuration for the current date
        const relevantWeeklyOffConfig = weeklyOffsConfig
            .filter(row => moment.utc(row.effective_date).isSameOrBefore(currentDate, 'day'))
            .sort((a, b) => moment.utc(b.effective_date).diff(moment.utc(a.effective_date)))[0]; // Get the latest one

        let isWeeklyOffForThisDay = false;
        if (relevantWeeklyOffConfig && Array.isArray(relevantWeeklyOffConfig.weekly_off_days)) {
            const woEffectiveDate = moment.utc(relevantWeeklyOffConfig.effective_date);
            const woEndDate = relevantWeeklyOffConfig.end_date ? moment.utc(relevantWeeklyOffConfig.end_date) : null;

            isWeeklyOffForThisDay = relevantWeeklyOffConfig.weekly_off_days.includes(currentMomentDayOfWeek) &&
                                     currentDate.isSameOrAfter(woEffectiveDate, 'day') &&
                                     (!woEndDate || currentDate.isSameOrBefore(woEndDate, 'day'));
        }

        const isPublicHoliday = publicHolidayDates.has(formattedDate);

        let dayCategorized = false; // Flag to ensure a day is categorized only once

        // --- REVERTED LOGIC: Holidays and Weekly Offs are ALWAYS considered non-working/paid days ---
        // The presence of a rejected leave on these days does NOT change their status to absent/LOP.
        if (isPublicHoliday) {
            holidaysCount++;
            dailyStatusMap.set(formattedDate, 'HOLIDAY');
            dayCategorized = true;
            continue; // Skip further processing for holidays
        }
        if (isWeeklyOffForThisDay) {
            actualWeeklyOffDays++;
            dailyStatusMap.set(formattedDate, 'WEEKLY OFF');
            dayCategorized = true;
            continue; // Skip further processing for weekly offs
        }
        // --- END REVERTED LOGIC ---

        // This is an expected working day (not holiday or weekly off)
        totalExpectedWorkingDays++; // Increment here for accurate total working days

        const record = attendanceMap.get(formattedDate);

        // --- NEW LOGIC: Directly use attendance.status for counts ---
        if (record) {
            switch (record.status.toUpperCase()) {
                case 'PRESENT':
                    presentDays++;
                    totalActualWorkingHours += (parseFloat(record.working_hours) || 0);
                    dailyStatusMap.set(formattedDate, 'PRESENT');
                    console.log(`[ATTENDANCE_SUMMARY_DEBUG] Date: ${formattedDate} - Counted as PRESENT (Working Hours: ${record.working_hours || 0})`);
                    dayCategorized = true;
                    break;
                case 'LATE':
                    presentDays++; // Still a present day
                    lateDays++;
                    totalActualWorkingHours += (parseFloat(record.working_hours) || 0);
                    dailyStatusMap.set(formattedDate, 'LATE');
                    console.log(`[ATTENDANCE_SUMMARY_DEBUG] Date: ${formattedDate} - Counted as LATE/PRESENT (Working Hours: ${record.working_hours || 0})`);
                    dayCategorized = true;
                    break;
                case 'ON_LEAVE': // This is the paid leave status from attendance table
                    // MODIFIED: Sum daily_leave_duration
                    onLeaveDays += (parseFloat(record.daily_leave_duration) || 0);
                    dailyStatusMap.set(formattedDate, 'ON LEAVE');
                    console.log(`[ATTENDANCE_SUMMARY_DEBUG] Date: ${formattedDate} - Counted as ON LEAVE (Paid, Duration: ${record.daily_leave_duration || 0})`);
                    dayCategorized = true;
                    break;
                case 'LOP': // This is the unpaid leave status from attendance table
                    // MODIFIED: Sum daily_leave_duration
                    lopDays += (parseFloat(record.daily_leave_duration) || 0);
                    dailyStatusMap.set(formattedDate, 'LOP');
                    console.log(`[ATTENDANCE_SUMMARY_DEBUG] Date: ${formattedDate} - Counted as LOP (Unpaid, Duration: ${record.daily_leave_duration || 0})`);
                    dayCategorized = true;
                    break;
                case 'HALF-DAY':
                    presentDays += 0.5; // Count as half present
                    totalActualWorkingHours += (parseFloat(record.working_hours) || 0);
                    dailyStatusMap.set(formattedDate, 'HALF-DAY');
                    console.log(`[ATTENDANCE_SUMMARY_DEBUG] Date: ${formattedDate} - Counted as HALF-DAY ATTENDANCE (Working Hours: ${record.working_hours || 0})`);
                    dayCategorized = true;
                    break;
                case 'ABSENT':
                    absentWorkingDays++;
                    dailyStatusMap.set(formattedDate, 'ABSENT');
                    console.log(`[ATTENDANCE_SUMMARY_DEBUG] Date: ${formattedDate} - Counted as ABSENT (from attendance record)`);
                    dayCategorized = true;
                    break;
                default:
                    // If it's a past/current day and not explicitly handled by a known status, it's an absent day
                    if (currentDate.isSameOrBefore(today, 'day')) {
                        absentWorkingDays++;
                        dailyStatusMap.set(formattedDate, 'ABSENT');
                        console.log(`[ATTENDANCE_SUMMARY_DEBUG] Date: ${formattedDate} - Defaulted to ABSENT (unhandled status in record)`);
                    } else {
                        dailyStatusMap.set(formattedDate, 'N/A'); // Future days are N/A
                        console.log(`[ATTENDANCE_SUMMARY_DEBUG] Date: ${formattedDate} - Future day with no record, not counted as absent.`);
                    }
                    dayCategorized = true; // Still categorized, even if unknown status
                    break;
            }
        }

        // If no attendance record, and not categorized by holiday/weekly off, and it's a past/current working day
        if (!dayCategorized && !record && currentDate.isSameOrBefore(today, 'day')) {
            absentWorkingDays++;
            dailyStatusMap.set(formattedDate, 'ABSENT');
            console.log(`[ATTENDANCE_SUMMARY_DEBUG] Date: ${formattedDate} - Counted as ABSENT (no attendance record found for past/current working day)`);
        } else if (!dayCategorized && !record && currentDate.isAfter(today, 'day')) {
            dailyStatusMap.set(formattedDate, 'N/A'); // Future days without records are N/A
            console.log(`[ATTENDANCE_SUMMARY_DEBUG] Date: ${formattedDate} - Future day with no record, not counted as absent.`);
        }
    }

    // Final calculation adjustments
    // totalUnpaidLeaves now correctly sums LOP days (from attendance records) and general absent days
    const totalUnpaidLeaves = lopDays + absentWorkingDays;

    // This is the total number of days the employee is paid for, consistent with the main payroll calculation
    const totalPayableDaysForPayroll = totalCalendarDays - totalUnpaidLeaves;

    // This is a specific metric: days physically present or on approved paid leave
    const actualPresentAndPaidLeaveDays = presentDays + onLeaveDays;

    // CORRECTED: averageDailyHours should only consider days with actual recorded working hours
    const totalDaysWithRecordedHours = presentDays; // Only days where actual hours were logged (PRESENT or LATE)
    const averageDailyHours = totalDaysWithRecordedHours > 0 ? parseFloat((totalActualWorkingHours / totalDaysWithRecordedHours).toFixed(2)) : 0;


    console.log(`[ATTENDANCE_SUMMARY_DEBUG] Final Counts:`);
    console.log(`[ATTENDANCE_SUMMARY_DEBUG]   Present Days: ${presentDays}`);
    console.log(`[ATTENDANCE_SUMMARY_DEBUG]   Late Days (from attendance): ${lateDays}`);
    console.log(`[ATTENDANCE_SUMMARY_DEBUG]   On Leave Days (Paid Approved Leaves from Attendance): ${onLeaveDays}`);
    console.log(`[ATTENDANCE_SUMMARY_DEBUG]   LOP Days (Unpaid Leaves from Attendance): ${lopDays}`);
    console.log(`[ATTENDANCE_SUMMARY_DEBUG]   Absent Working Days (from Attendance): ${absentWorkingDays}`);
    console.log(`[ATTENDANCE_SUMMARY_DEBUG]   Total Unpaid Leaves (LOP + Absent): ${totalUnpaidLeaves}`);
    console.log(`[ATTENDANCE_SUMMARY_DEBUG]   Total Payable Days for Payroll: ${totalPayableDaysForPayroll}`); // New metric
    console.log(`[ATTENDANCE_SUMMARY_DEBUG]   Actual Present & Paid Leave Days: ${actualPresentAndPaidLeaveDays}`); // Renamed metric
    console.log(`[ATTENDANCE_SUMMARY_DEBUG]   Total Actual Working Hours: ${totalActualWorkingHours.toFixed(2)}`);
    console.log(`[ATTENDANCE_SUMMARY_DEBUG]   Average Daily Hours: ${averageDailyHours}`);
    console.log(`[ATTENDANCE_SUMMARY_DEBUG]   Holidays Count: ${holidaysCount}`);
    console.log(`[ATTENDANCE_SUMMARY_DEBUG]   Actual Weekly Off Days: ${actualWeeklyOffDays}`);
    console.log(`[ATTENDANCE_SUMMARY_DEBUG]   Total Expected Working Days in Month: ${totalExpectedWorkingDays}`);


    return {
        totalCalendarDays,
        totalWorkingDaysInMonth: totalExpectedWorkingDays,
        actualWeeklyOffDays,
        holidaysCount,
        presentDays: parseFloat(presentDays.toFixed(2)),
        lateDays: parseFloat(lateDays.toFixed(2)),
        leaveDays: parseFloat(onLeaveDays.toFixed(2)), // This is the sum of 'on_leave' durations
        lopDays: parseFloat(lopDays.toFixed(2)),      // This is the sum of 'lop' durations
        absentDays: parseFloat(absentWorkingDays.toFixed(2)), // Unaccounted absences
        
        // Renamed for clarity and added the new total payable days
        actualPresentAndPaidLeaveDays: parseFloat(actualPresentAndPaidLeaveDays.toFixed(2)),
        totalPayableDaysForPayroll: parseFloat(totalPayableDaysForPayroll.toFixed(2)), // This will be 29 in your example

        unpaidLeaves: parseFloat(totalUnpaidLeaves.toFixed(2)), // Total unpaid for salary calculation
        totalWorkingHours: parseFloat(totalActualWorkingHours.toFixed(2)),
        averageDailyHours: averageDailyHours,
        dailyStatusMap: Object.fromEntries(dailyStatusMap) // Convert Map to plain object for JSON serialization
    };
}

// Helper function to convert numbers to words (Indian Rupees specific)
// This is the version you confirmed was working for PDF generation.
function convertNumberToWords(num) {
    if (typeof num !== 'number') {
        num = parseFloat(num);
    }
    if (isNaN(num) || num < 0) {
        return 'Invalid Number';
    }
    if (num === 0) {
        return 'Zero';
    }

    // Round to the nearest whole number before converting to words
    let num_int = Math.round(num);

    const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
    const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    const g = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion', 'septillion', 'octillion', 'nonillion', 'decillion'];

    let str = '';
    let i = 0;

    while (num_int > 0) {
        let p = num_int % 1000;
        if (p > 0) {
            let h = Math.floor(p / 100);
            let t = p % 100;
            let s = '';

            if (h > 0) {
                s += a[h] + 'hundred ';
            }

            if (t < 20) {
                s += a[t];
            } else {
                s += b[Math.floor(t / 10)] + ' ' + a[t % 10];
            }
            str = s.trim() + ' ' + g[i] + ' ' + str;
        }
        num_int = Math.floor(num_int / 1000);
        i++;
    }

    let result = str.trim();
    // Capitalize the first letter of each word
    result = result.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    return result.replace(/\s+/g, ' ').trim() + ' Only';
}


// Function to generate PDF payslip using PDFKit
async function generatePayslipPDF(data, outputPath) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        // Define the path to the logo image
        // We use path.resolve to get the absolute path from the project root
        //const logoPath = path.resolve(__dirname, '..', 'uploads', 'company_logo', 'logo.jpeg'); // Changed to logo.jpeg

        // --- Company Info and Logo Section ---
        const companyNameX = doc.page.margins.left;
        const companyNameY = doc.page.margins.top;
        const companyAddressY = companyNameY + doc.fontSize(16).heightOfString(data.companyInfo.name) + 2;

        const logoWidth = 120; // Increased width for bigger logo
        const logoHeight = 60; // Increased height
        const logoX = doc.page.width - doc.page.margins.right - logoWidth;
        const logoY = companyNameY;

        // Draw company name and address (left-aligned)
        doc.fontSize(16).font('Helvetica-Bold').text(data.companyInfo.name, companyNameX, companyNameY, { align: 'left' });
        doc.fontSize(10).font('Helvetica').text(data.companyInfo.address, companyNameX, companyAddressY, { align: 'left' });
        
        // Add logo if the file exists
        // if (fs.existsSync(logoPath)) {
        //     try {
        //         // Use fit to ensure aspect ratio is maintained within the given bounds
        //         doc.image(logoPath, logoX, logoY, { fit: [logoWidth, logoHeight], align: 'right', valign: 'top' });
        //     } catch (imgError) {
        //         console.error(`Error embedding logo: ${imgError.message}`);
        //     }
        // } else {
        //     console.warn(`Logo file not found at: ${logoPath}. Skipping logo embedding.`);
        // }

        // Calculate the highest point reached by the header elements to start new content below it
        let currentY = Math.max(companyAddressY + doc.fontSize(10).heightOfString(data.companyInfo.address), logoY + logoHeight) + 20;
        doc.y = currentY;

        // --- Salary Slip Title ---
        doc.fontSize(18).text('SALARY SLIP', { align: 'center', underline: true });
        doc.moveDown();
        currentY = doc.y;

        // --- Employee Header Details (Two-column layout) ---
        doc.fontSize(10);
        const headerLeftColX = doc.page.margins.left;
        const headerRightColX = doc.page.width / 2 + 30;
        const headerColWidth = (doc.page.width / 2) - doc.page.margins.left - 30;
        const headerRowHeight = 18;

        // Define fixed widths for labels and calculated start positions for values
        const leftLabelWidth = 80; // Max width for labels in the left column (e.g., "Employee ID:")
        const rightLabelWidth = 95; // Max width for labels in the right column (e.g., "Employee Name:")
        const valuePadding = 5; // Small padding between label and value

        const leftValueX = headerLeftColX + leftLabelWidth + valuePadding;
        const rightValueX = headerRightColX + rightLabelWidth + valuePadding;

        // Row 1
        doc.text(`Employee ID:`, headerLeftColX, currentY, { width: leftLabelWidth, align: 'left' });
        doc.font('Helvetica-Bold').text(`${data.headerDetails.employeeId}`, leftValueX, currentY, { width: headerColWidth - leftLabelWidth - valuePadding, align: 'left' });
        
        doc.font('Helvetica').text(`Employee Name:`, headerRightColX, currentY, { width: rightLabelWidth, align: 'left' });
        doc.font('Helvetica-Bold').text(`${data.headerDetails.employeeName}`, rightValueX, currentY, { width: headerColWidth - rightLabelWidth - valuePadding, align: 'left' });
        currentY += headerRowHeight;
        doc.y = currentY;

        // Row 2
        doc.font('Helvetica').text(`Designation:`, headerLeftColX, currentY, { width: leftLabelWidth, align: 'left' });
        doc.font('Helvetica-Bold').text(`${data.headerDetails.designation}`, leftValueX, currentY, { width: headerColWidth - leftLabelWidth - valuePadding, align: 'left' });
        
        doc.font('Helvetica').text(`Month/Year:`, headerRightColX, currentY, { width: rightLabelWidth, align: 'left' });
        doc.font('Helvetica-Bold').text(`${data.headerDetails.monthYear}`, rightValueX, currentY, { width: headerColWidth - rightLabelWidth - valuePadding, align: 'left' });
        currentY += headerRowHeight;
        doc.y = currentY;

        // Row 3
        doc.font('Helvetica').text(`Joining Date:`, headerLeftColX, currentY, { width: leftLabelWidth, align: 'left' });
        doc.font('Helvetica-Bold').text(`${data.headerDetails.joiningDate}`, leftValueX, currentY, { width: headerColWidth - leftLabelWidth - valuePadding, align: 'left' });
        
        doc.font('Helvetica').text(`Payable Days:`, headerRightColX, currentY, { width: rightLabelWidth, align: 'left' });
        doc.font('Helvetica-Bold').text(`${data.headerDetails.payableDays}`, rightValueX, currentY, { width: headerColWidth - rightLabelWidth - valuePadding, align: 'left' });
        currentY += headerRowHeight;
        doc.y = currentY + 25;

        // --- Earnings and Deductions Tables (Side-by-Side) ---
        const tableStartY = doc.y;
        const tableColumnPadding = 20; // Padding between the two main table columns
        const singleTableWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right - tableColumnPadding) / 2;
        const tableLeftX = doc.page.margins.left;
        const tableRightX = tableLeftX + singleTableWidth + tableColumnPadding;
        const tableRowHeight = 18;
        const amountColWidth = 70; // Fixed width for amount columns
        const descriptionColWidth = singleTableWidth - amountColWidth; // Width for description columns

        // Earnings Title
        doc.fontSize(12).text('Earnings', tableLeftX, tableStartY, { underline: true });
        // Deductions Title
        doc.text('Deductions', tableRightX, tableStartY, { underline: true });
        let currentTableY = tableStartY + doc.fontSize(12).heightOfString('Earnings') + 5;

        // Table Headers (Earnings)
        doc.fontSize(10).font('Helvetica-Bold').text('Description', tableLeftX, currentTableY, { width: descriptionColWidth });
        // Corrected: Use "Amount (Rs.)"
        doc.text('Amount (Rs.)', tableLeftX + descriptionColWidth, currentTableY, { align: 'right', width: amountColWidth }); 

        // Table Headers (Deductions)
        doc.fontSize(10).font('Helvetica-Bold').text('Description', tableRightX, currentTableY, { width: descriptionColWidth });
        // Corrected: Use "Amount (Rs.)"
        doc.text('Amount (Rs.)', tableRightX + descriptionColWidth, currentTableY, { align: 'right', width: amountColWidth }); 
        currentTableY += tableRowHeight;

        // Draw line below headers for both tables
        doc.lineWidth(0.5);
        doc.lineCap('butt').moveTo(tableLeftX, currentTableY - 2).lineTo(tableLeftX + singleTableWidth, currentTableY - 2).stroke();
        doc.lineCap('butt').moveTo(tableRightX, currentTableY - 2).lineTo(tableRightX + singleTableWidth, currentTableY - 2).stroke();

        doc.font('Helvetica'); // Reset font for table content

        // Prepare data for iteration
        const earningsRows = [
            { desc: 'Basic + DA', val: (data.earnings.basicDA || 0).toFixed(2) },
            { desc: 'House Rent Allowances', val: (data.earnings.houseRentAllowances || 0).toFixed(2) },
            { desc: 'Conveyance Allowances', val: (data.earnings.conveyanceAllowances || 0).toFixed(2) },
            { desc: 'Special Allowances', val: (data.earnings.specialAllowances || 0).toFixed(2) },
            { desc: 'LTA', val: (data.earnings.lta || 0).toFixed(2) },
            { desc: 'Medical Allowances', val: (data.earnings.medicalAllowances || 0).toFixed(2) }
        ];
        if (data.earnings.otherEarnings) {
            for (const key in data.earnings.otherEarnings) {
                earningsRows.push({ desc: key, val: parseFloat(data.earnings.otherEarnings[key] || 0).toFixed(2) });
            }
        }

        const deductionsRows = [
            { desc: 'Provident Fund', val: (data.deductions.providentFund || 0).toFixed(2) },
            { desc: 'ESI', val: (data.deductions.esi || 0).toFixed(2) },
            { desc: 'Professional Tax', val: (data.deductions.professionalTax || 0).toFixed(2) },
            { desc: 'Advance', val: (data.deductions.advance || 0).toFixed(2) },
            { desc: 'GHI', val: (data.deductions.mediclaim || 0).toFixed(2) },
            { desc: 'TDS', val: (data.deductions.tds || 0).toFixed(2) }
        ];
        if (data.deductions.otherDeductions) {
            for (const key in data.deductions.otherDeductions) {
                if (key !== 'grill') {
                    deductionsRows.push({ desc: key, val: parseFloat(data.deductions.otherDeductions[key] || 0).toFixed(2) });
                }
            }
        }
        
        const totalTableRows = Math.max(earningsRows.length, deductionsRows.length);

        for (let i = 0; i < totalTableRows; i++) {
            // Ensure both columns start at the same Y position for each row
            const startRowY = currentTableY;

            // Earnings Column
            if (earningsRows[i]) {
                doc.fontSize(10).text(earningsRows[i].desc, tableLeftX, startRowY, { width: descriptionColWidth });
                doc.text(earningsRows[i].val, tableLeftX + descriptionColWidth, startRowY, { align: 'right', width: amountColWidth });
            }

            // Deductions Column
            if (deductionsRows[i]) {
                doc.fontSize(10).text(deductionsRows[i].desc, tableRightX, startRowY, { width: descriptionColWidth });
                doc.text(deductionsRows[i].val, tableRightX + descriptionColWidth, startRowY, { align: 'right', width: amountColWidth });
            }
            currentTableY += tableRowHeight; // Increment Y for the next row
        }

        // --- Total Gross Salary and Total Deductions ---
        // Get the current Y position after drawing the lines
        const totalAmountsY = currentTableY + 5; // Add some space before totals
        doc.lineWidth(0.5);
        doc.lineCap('butt').moveTo(tableLeftX, totalAmountsY - 2).lineTo(tableLeftX + singleTableWidth, totalAmountsY - 2).stroke(); // Line above total gross
        doc.lineCap('butt').moveTo(tableRightX, totalAmountsY - 2).lineTo(tableRightX + singleTableWidth, totalAmountsY - 2).stroke(); // Line above total deductions

        doc.font('Helvetica-Bold').fontSize(10).text('Total Gross Salary', tableLeftX, totalAmountsY, { width: descriptionColWidth });
        doc.text((data.earnings.totalGrossSalary || 0).toFixed(2), tableLeftX + descriptionColWidth, totalAmountsY, { align: 'right', width: amountColWidth });

        // Position Total Deductions label and value on the same line
        doc.text('Total Deductions', tableRightX, totalAmountsY, { width: descriptionColWidth });
        doc.text((data.deductions.totalDeductions || 0).toFixed(2), tableRightX + descriptionColWidth, totalAmountsY, { align: 'right', width: amountColWidth });
        doc.moveDown(1); // Space after totals


        // --- Net Pay Summary and Salary Paid By ---
        const netPayLabelX = doc.page.margins.left;
        const netPayValueX = netPayLabelX + 100; // X position for the values

        doc.y = doc.y + 10; // Add some vertical spacing
        const netPayLineY = doc.y; // Capture the Y for this line

        doc.fontSize(12).font('Helvetica-Bold').text(`Net Pay:`, netPayLabelX, netPayLineY); // Print label
        // Corrected: Print "Rs." prefix and then the amount.
        doc.text(`Rs. ${(data.summary.netSalary || 0).toFixed(2)}`, netPayValueX, netPayLineY, { align: 'left', width: 150 });
        doc.moveDown(0.5);

        doc.fontSize(10).font('Helvetica').text(`Salary In Words:`, netPayLabelX, doc.y, { continued: true });
        // Adjust the width for Salary In Words to prevent cutting off
        // Use a larger width for the text to allow it to wrap naturally
        doc.text(`${data.summary.netSalaryInWords}`, netPayLabelX + 100, doc.y, { align: 'left', width: doc.page.width - (netPayLabelX + 100) - doc.page.margins.right, lineBreak: true });
        doc.moveDown();

        doc.fontSize(10).text(`Salary Paid By:`, netPayLabelX, doc.y, { continued: true });
        doc.text(`${data.paymentDetails.salaryPaidBy}`, netPayLabelX + 100, doc.y, { align: 'left', width: doc.page.width - netPayValueX - doc.page.margins.right });
        doc.moveDown(2);


        // --- Signatures and System Generated Text (Footer) ---
        const signatureLeftX = doc.page.margins.left;
        const signatureRightX = doc.page.width / 2 + 30;
        const signatureColWidth = (doc.page.width / 2) - doc.page.margins.left - 30;
        
        doc.fontSize(10).text('Employee Signature', signatureLeftX, doc.y, { width: signatureColWidth });
        
        // Director name and system generated text on the right
        const directorNameY = doc.y; // Capture current Y for director name
        doc.text(`Director - ${data.signatures.directorName}`, signatureRightX, directorNameY, { align: 'right', width: signatureColWidth });
        doc.moveDown(0.5); // Move down for the system generated text

        // System generated text (as per image_46cbdd.png)
        doc.fontSize(8).font('Helvetica-Oblique').text('This is a system generated payslip, hence the signature is not required.', signatureRightX, doc.y, { align: 'right', width: signatureColWidth });

        doc.end();

        stream.on('finish', () => {
            console.log(`PDF generated at: ${outputPath}`);
            resolve();
        });
        stream.on('error', (err) => {
            console.error(`Error writing PDF to file: ${err}`);
            reject(err);
        });
    });
}


module.exports = {
  calculateAttendanceSummary,
  convertNumberToWords,
  generatePayslipPDF,
};