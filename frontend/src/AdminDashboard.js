// AdminDashboard.jsx
// No Firestore imports needed anymore
// import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, where, getDocs } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

const AdminDashboard = ({ user, handleLogout, darkMode, toggleDarkMode, showMessage, apiBaseUrl, accessToken }) => {
     // Define the maximum number of users allowed
    const MAX_ALLOWED_USERS = 30; // You can change this number as needed
    // State for managing employees, attendance records, and UI elements
    const [employees, setEmployees] = React.useState([]);
    const [attendanceRecords, setAttendanceRecords] = React.useState([]);
    const [newEmployeeName, setNewEmployeeName] = React.useState('');
    const [newEmployeeEmail, setNewEmployeeEmail] = React.useState('');
    const [newEmployeeId, setNewEmployeeId] = React.useState(''); // New: Employee ID for registration
    const [newEmployeePassword, setNewEmployeePassword] = React.useState(''); // New: Password for registration
    const [newEmployeeRole, setNewEmployeeRole] = React.useState('employee'); // New: Role for registration
    const [newEmployeeShiftType, setNewEmployeeShiftType] = React.useState('day'); // New: Shift Type for registration
    const [selectedEmployeeId, setSelectedEmployeeId] = React.useState('');
    const [selectedDate, setSelectedDate] = React.useState(moment().format('YYYY-MM-DD'));
    const [checkInTime, setCheckInTime] = React.useState('');
    const [checkOutTime, setCheckOutTime] = React.useState('');
    const [isAddingEmployee, setIsAddingEmployee] = React.useState(false);
    const [isAddingAttendance, setIsAddingAttendance] = React.useState(false);
    const [editingAttendanceId, setEditingAttendanceId] = React.useState(null);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [filterDate, setFilterDate] = React.useState('');
    const [showExportModal, setShowExportModal] = React.useState(false);
    const [exportStartDate, setExportStartDate] = React.useState('');
    const [exportEndDate, setExportEndDate] = React.useState('');
    const [exportEmployeeId, setExportEmployeeId] = React.useState(''); // New: For filtering export
    const [adminStats, setAdminStats] = React.useState(null); // For admin dashboard stats

    // New: State for viewing employee profile details
    const [showProfileModal, setShowProfileModal] = React.useState(false);
    const [viewingEmployeeProfile, setViewingEmployeeProfile] = React.useState(null);

    // NEW: State for editing employee details (for the main employee table form)
    const [isEditingEmployee, setIsEditingEmployee] = React.useState(false);
    const [editingEmployeeData, setEditingEmployeeData] = React.useState(null);

    // NEW: States for editing profile within the modal
    const [isEditingProfileInModal, setIsEditingProfileInModal] = React.useState(false);
    const [editedProfileData, setEditedProfileData] = React.useState(null);
    const [profilePhotoFile, setProfilePhotoFile] = React.useState(null); // For new profile picture upload

    // NEW STATE: For birthdays this month
    const [birthdaysThisMonth, setBirthdaysThisMonth] = React.useState([]);


    // New: Active tab for main navigation
    const [activeTab, setActiveTab] = React.useState('employees'); // 'employees', 'attendance', 'leave-management', 'holidays', 'weekly-offs', 'notifications', 'analytics', 'correction-review', 'profile-requests', 'payroll'

    // NEW: States for filtering attendance records from analytics clicks
    const [attendanceFilterStatus, setAttendanceFilterStatus] = React.useState('');
    const [attendanceFilterDepartment, setAttendanceFilterDepartment] = React.useState(''); // Placeholder for future department filtering

    // NEW: Loading state for AdminDashboard itself - CORRECTLY DECLARED
    const [loading, setLoading] = React.useState(true);


    // Axios instance with token for authenticated requests - MEMOIZED
    const authAxios = React.useMemo(() => {
        return axios.create({
            baseURL: apiBaseUrl,
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
    }, [apiBaseUrl, accessToken]); // Recreate only if apiBaseUrl or accessToken changes


    // Helper function to determine device type from user agent string
    const getDeviceType = (userAgent) => {
        if (!userAgent) return 'N/A';
        userAgent = userAgent.toLowerCase();

        // Check for common mobile keywords
        if (userAgent.includes('mobile') || userAgent.includes('android') || userAgent.includes('iphone') || userAgent.includes('ipad')) {
            return 'Mobile';
        }

        // Check for common desktop OS keywords
        if (userAgent.includes('windows') || userAgent.includes('macintosh') || userAgent.includes('linux')) {
            return 'Desktop';
        }

        // Check for common browsers
        if (userAgent.includes('chrome')) return 'Chrome';
        if (userAgent.includes('firefox')) return 'Firefox';
        if (userAgent.includes('safari')) return 'Safari';
        if (userAgent.includes('edge')) return 'Edge';
        if (userAgent.includes('opera')) return 'Opera';
        if (userAgent.includes('msie') || userAgent.includes('trident')) return 'IE';

        return 'N/A'; // Default if no specific type is identified
    };

    // Function to fetch birthday data
    const fetchBirthdays = async () => {
        try {
            const response = await authAxios.get('/api/admin/employees/birthdays-this-month');
            setBirthdaysThisMonth(response.data.birthdays);
            // The backend automatically sends notifications, so no frontend action needed here
        } catch (error) {
            console.error("Error fetching birthdays:", error.response?.data?.message || error.message);
            showMessage(`Error fetching birthdays: ${error.response?.data?.message || error.message}`, "error");
        }
    };


  React.useEffect(() => {
        const fetchOverallStats = async () => {
            if (!accessToken || !authAxios) {
                console.warn("AdminDashboard: Missing accessToken or authAxios, cannot fetch overall stats.");
                return;
            }

            try {
                const response = await authAxios.get(`${apiBaseUrl}/api/admin/stats`);
                setAdminStats({
                    total_employees: response.data.totalUsers,
                    presentToday: response.data.presentToday,
                    absentToday: response.data.absentToday,
                    onLeaveToday: response.data.onLeaveToday,
                    grand_total_working_hours: response.data.grandTotalWorkingHours,
                    pending_leave_requests: response.data.pending_leave_requests,
                    pending_correction_requests: response.data.pending_correction_requests
                });
            } catch (error) {
                console.error("Error fetching overall admin stats in AdminDashboard:", error.response?.data?.message || error.message);
                showMessage(`Failed to load overall statistics: ${error.response?.data?.message || error.message}`, "error");
                setAdminStats(null);
            }
        };

        fetchOverallStats();
    }, [accessToken, authAxios, apiBaseUrl, showMessage]);

    // Effect hook to fetch data based on active tab and other dependencies
    React.useEffect(() => {
        const fetchData = async () => {
            if (!accessToken) {
                setLoading(false); // Stop loading if no token
                return;
            }

            setLoading(true);
            try {
                // Fetch employees for common use (e.g., dropdowns)
                // This now fetches all new profile data as per backend update
                const employeesResponse = await authAxios.get('/api/admin/users');
                setEmployees(employeesResponse.data);

                if (activeTab === 'attendance') {
                    // Fetch attendance records (admin view, for a specific date or all)
                    const params = {
                        date: filterDate || moment().format('YYYY-MM-DD'),
                        status: attendanceFilterStatus,
                        department: attendanceFilterDepartment // Will be empty for now
                    };
                    const attendanceResponse = await authAxios.get(`/api/admin/attendance`, { params });
                    setAttendanceRecords(attendanceResponse.data);
                } else if (activeTab === 'analytics') {
                    // Always fetch admin stats when analytics tab is active
                    const statsResponse = await authAxios.get(`${apiBaseUrl}/api/admin/stats`);
                    setAdminStats(statsResponse.data);
                    // Also fetch birthdays when analytics tab is active
                    fetchBirthdays();
                }
                // Other tabs (leave-management, holidays, weekly-offs, notifications, correction-review, profile-requests, payroll)
                // will have their own components fetching data
            } catch (error) {
                console.error("Error fetching data for admin dashboard:", error.response?.data?.message || error.message);
                showMessage(`Error fetching data: ${error.response?.data?.message || error.message}`, "error");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        // Initial fetch for birthdays on component mount (can be moved to analytics tab if preferred)
        // fetchBirthdays(); // If you want to fetch birthdays regardless of active tab on initial load

    }, [accessToken, activeTab, filterDate, attendanceFilterStatus, attendanceFilterDepartment, authAxios]); // Re-fetch when token, activeTab, filter, or authAxios changes

    // Function to handle clicks from analytics cards
    const handleAnalyticsClick = (status, department = '') => {
        if (status === 'correction') {
            setActiveTab('correction-review');
            // Optionally, pass a filter to correction-review if it supports it
            // For now, just navigate to the tab
        } else {
            setActiveTab('attendance');
            setAttendanceFilterStatus(status);
            setAttendanceFilterDepartment(department); // Set department filter (if provided)
            setFilterDate(''); // Clear date filter when clicking analytics status, to see all for that status
            setSearchQuery(''); // Clear search query
        }
    };


    // Filtered employees based on search query
    const filteredEmployees = employees.filter(employee =>
        employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.employee_id.toLowerCase().includes(searchQuery.toLowerCase()) // Include employee_id in search
    );

    // Filtered attendance records based on search query and date (already handled by backend filterDate if passed)
    const displayAttendanceRecords = attendanceRecords.filter(record => {
        const employee = employees.find(emp => emp.id === record.user_id);
        const matchesSearch = employee && (
            employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            employee.employee_id.toLowerCase().includes(searchQuery.toLowerCase())
        );
        const matchesStatus = attendanceFilterStatus ? record.status.toLowerCase() === attendanceFilterStatus.toLowerCase() : true;
        return matchesSearch && matchesStatus;
    });


    // Function to handle saving (add or update) an employee from the main employee form
    const handleSaveEmployee = async () => {
        if (!newEmployeeName || !newEmployeeEmail || !newEmployeeId || !newEmployeeRole || !newEmployeeShiftType) {
            if (!isEditingEmployee || newEmployeePassword) {
                showMessage('All employee fields are required.', 'error');
                return;
            }
        }

        if (!isEditingEmployee && employees.length >= MAX_ALLOWED_USERS) {
            showMessage(`User limit of ${MAX_ALLOWED_USERS} reached. Cannot add more employees.`, 'error');
            resetEmployeeForm();
            return;
        }
        
        const employeeData = {
            name: newEmployeeName,
            email: newEmployeeEmail,
            employee_id: newEmployeeId,
            role: newEmployeeRole,
            shift_type: newEmployeeShiftType,
            // New fields for registration/update through main form (if you want to add inputs here)
            // pan_card_number: newPanCardNumber, // Example if you add states for these
            // bank_account_number: newBankAccountNumber,
            // ifsc_code: newIfscCode,
            // bank_name: newBankName,
            // date_of_birth: newDateOfBirth,
        };

        if (!isEditingEmployee || newEmployeePassword) {
            employeeData.password = newEmployeePassword;
        }

        try {
            if (isEditingEmployee && editingEmployeeData) {
                await authAxios.put(`${apiBaseUrl}api/admin/users/${editingEmployeeData.id}`, employeeData);
                showMessage('Employee updated successfully!', 'success');
            } else {
                await authAxios.post(`${apiBaseUrl}/admin/register-employee`, employeeData);
                showMessage('Employee added successfully!', 'success');
            }
            // Clear form and re-fetch data
            setNewEmployeeName('');
            setNewEmployeeEmail('');
            setNewEmployeeId('');
            setNewEmployeePassword('');
            setNewEmployeeRole('employee');
            setNewEmployeeShiftType('day');
            setIsAddingEmployee(false);
            setIsEditingEmployee(false);
            setEditingEmployeeData(null);

            // Re-fetch employees to update the list with new data
            const employeesResponse = await authAxios.get('/api/admin/users');
            setEmployees(employeesResponse.data);
        } catch (error) {
            console.error("Error saving employee:", error.response?.data?.message || error.message);
            showMessage(`Failed to save employee: ${error.response?.data?.message || error.message}`, 'error');
        }
    };

    // Function to initiate editing an employee from the main employee table
    const editEmployee = (employee) => {
        console.log("DEBUG: editEmployee function called for employee:", employee.name);
        setIsAddingEmployee(true); // Open the form
        setIsEditingEmployee(true); // Set to editing mode
        setEditingEmployeeData(employee); // Store data of employee being edited

        // Populate form fields with existing data
        setNewEmployeeName(employee.name);
        setNewEmployeeEmail(employee.email);
        setNewEmployeeId(employee.employee_id);
        setNewEmployeeRole(employee.role);
        setNewEmployeeShiftType(employee.shift_type);
        setNewEmployeePassword(''); // Clear password field for security (don't pre-fill)
        // If you add new fields to the main add/edit form, populate them here too
    };

    // Function to reset the employee form (used for cancel or after save)
    const resetEmployeeForm = () => {
        setIsAddingEmployee(false);
        setIsEditingEmployee(false);
        setEditingEmployeeData(null);
        setNewEmployeeName('');
        setNewEmployeeEmail('');
        setNewEmployeeId('');
        setNewEmployeePassword('');
        setNewEmployeeRole('employee');
        setNewEmployeeShiftType('day');
        // Reset new states for new fields if you add them to this form
    };


    // Function to delete an employee
    const deleteEmployee = async (employeeIdToDelete) => {
        if (window.confirm('Are you sure you want to delete this employee and all their associated data?')) {
            try {
                await authAxios.delete(`${apiBaseUrl}/admin/users/${employeeIdToDelete}`);
                showMessage('Employee and all associated data deleted successfully!', 'success');
                // Re-fetch employees
                const employeesResponse = await authAxios.get('/api/admin/users');
                setEmployees(employeesResponse.data);
            } catch (error) {
                console.error("Error deleting employee:", error.response?.data?.message || error.message);
                showMessage(`Failed to delete employee: ${error.response?.data?.message || error.message}`, 'error');
            }
        }
    };

    // Function to add or update attendance (Admin manual correction/entry)
    const handleAttendanceSubmit = async () => {
        if (!selectedEmployeeId || !selectedDate || !checkInTime) {
            showMessage('Please select an employee, date, and check-in time.', 'error');
            return;
        }

        try {
            const payload = {
                date: selectedDate,
                expected_check_in: checkInTime,
                expected_check_out: checkOutTime || null,
                reason: editingAttendanceId ? 'Admin update attendance' : 'Admin manual attendance entry',
                userId: selectedEmployeeId
            };

            if (editingAttendanceId) {
                const newCorrectionResponse = await authAxios.post(`${apiBaseUrl}/api/attendance/correction-request`, payload);
                await authAxios.post(`${apiBaseUrl}/admin/attendance/correction-review`, {
                    id: newCorrectionResponse.data.data.id,
                    status: 'approved',
                    admin_comment: payload.reason,
                    date: payload.date,
                    userId: payload.userId,
                    expected_check_in: payload.expected_check_in,
                    expected_check_out: payload.expected_check_out
                });
                showMessage('Attendance record updated/corrected successfully!', 'success');

            } else {
                const newCorrectionResponse = await authAxios.post(`${apiBaseUrl}/api/attendance/correction-request`, payload);
                await authAxios.post(`${apiBaseUrl}/admin/attendance/correction-review`, {
                    id: newCorrectionResponse.data.data.id,
                    status: 'approved',
                    admin_comment: payload.reason,
                    date: payload.date,
                    userId: payload.userId,
                    expected_check_in: payload.expected_check_in,
                    expected_check_out: payload.expected_check_out
                });
                showMessage('Attendance record added successfully!', 'success');
            }

            // Reset form and re-fetch attendance
            setSelectedEmployeeId('');
            setSelectedDate(moment().format('YYYY-MM-DD'));
            setCheckInTime('');
            setCheckOutTime('');
            setIsAddingAttendance(false);
            setEditingAttendanceId(null);
            // Re-fetch attendance with current filters
            const params = {
                date: filterDate || moment().format('YYYY-MM-DD'),
                status: attendanceFilterStatus,
                department: attendanceFilterDepartment
            };
            const attendanceResponse = await authAxios.get(`/api/admin/attendance`, { params });
            setAttendanceRecords(attendanceResponse.data);

        } catch (error) {
            console.error("Error saving attendance:", error.response?.data?.message || error.message);
            showMessage(`Failed to save attendance: ${error.response?.data?.message || error.message}`, 'error');
        }
    };

    // Function to edit an attendance record
    const editAttendance = (record) => {
        setSelectedEmployeeId(record.user_id);
        setSelectedDate(record.date);
        setCheckInTime(record.check_in && record.check_in !== 'N/A' ? moment(record.check_in, 'HH:mm:ss').format('HH:mm') : ''); // Ensure HH:mm format
        setCheckOutTime(record.check_out && record.check_out !== 'N/A' ? moment(record.check_out, 'HH:mm:ss').format('HH:mm') : ''); // Ensure HH:mm format
        setEditingAttendanceId(record.user_id); // Use user_id as identifier for editing
        setIsAddingAttendance(true); // Open the form for editing
    };

    // Function to delete an attendance record (mark as absent/delete for a specific day)
    const deleteAttendance = async (userIdToDelete, dateToDelete) => {
        if (window.confirm('Are you sure you want to mark this attendance record as absent? This will remove check-in/out times.')) {
            try {
                await authAxios.post(`${apiBaseUrl}/admin/attendance/mark-absent-forgotten-checkout`, {
                    userId: userIdToDelete,
                    date: dateToDelete
                });
                showMessage('Attendance record marked as absent successfully!', 'success');
                // Re-fetch attendance with current filters
                const params = {
                    date: filterDate || moment().format('YYYY-MM-DD'),
                    status: attendanceFilterStatus,
                    department: attendanceFilterDepartment
                };
                const attendanceResponse = await authAxios.get(`/api/admin/attendance`, { params });
                setAttendanceRecords(attendanceResponse.data);
            } catch (error) {
                console.error("Error deleting attendance:", error.response?.data?.message || error.message);
                showMessage(`Failed to mark attendance as absent: ${error.response?.data?.message || error.message}`, 'error');
            }
        }
    };


    

    // Function to export attendance data to CSV
    const exportAttendanceToCSV = async () => {
        if (!exportStartDate || !exportEndDate) {
            showMessage('Please select both start and end dates for export.', 'error');
            return;
        }

        const startMoment = moment(exportStartDate);
        const endMoment = moment(exportEndDate);

        if (startMoment.isAfter(endMoment)) {
            showMessage('Start date cannot be after end date.', 'error');
            return;
        }

        try {
            const response = await authAxios.get(`${apiBaseUrl}/api/admin/export-attendance`, {
                params: {
                    year: startMoment.year(),
                    month: startMoment.month() + 1, // Moment months are 0-indexed
                    employee_id: exportEmployeeId // Pass employee_id if selected
                },
                responseType: 'blob' // Important for handling file downloads
            });

            const filename = response.headers['content-disposition']?.split('filename=')[1] || `attendance_report_${exportStartDate}_to_${exportEndDate}.csv`;
            saveAs(response.data, filename);

            showMessage('Attendance data exported successfully!', 'success');
            setShowExportModal(false);
            setExportStartDate('');
            setExportEndDate('');
            setExportEmployeeId('');
        } catch (error) {
            console.error("Error exporting attendance:", error.response?.data?.message || error.message);
            showMessage(`Failed to export attendance: ${error.response?.data?.message || error.message}`, 'error');
        }
    };

    // Function to open employee profile modal
    const viewEmployeeProfile = (employee) => {
        setViewingEmployeeProfile(employee);
        // Initialize edited data with current employee data, including new fields
        setEditedProfileData({
            ...employee,
            // Ensure date_of_birth is in YYYY-MM-DD format for input type="date"
            date_of_birth: employee.date_of_birth ? moment(employee.date_of_birth).format('YYYY-MM-DD') : '',
             designation: employee.designation || '',
              joining_date: employee.joining_date ? moment(employee.joining_date).format('YYYY-MM-DD') : ''
            

        });
        setIsEditingProfileInModal(false); // Start in view mode
        setProfilePhotoFile(null); // Clear any previously selected file
        setShowProfileModal(true);
        console.log("DEBUG: Viewing Employee Profile:", employee);
    };

    // Handle changes in the editable profile fields within the modal
    const handleProfileEditChange = (e) => {
        const { name, value } = e.target;
        setEditedProfileData(prevData => ({
            ...prevData,
            [name]: value
        }));
    };

    // Handle file selection for profile picture
    const handleProfilePhotoChange = (e) => {
        setProfilePhotoFile(e.target.files[0]);
    };

    // Function to save changes made in the profile modal
    const handleSaveProfileChanges = async () => {
        if (!editedProfileData) return;

        setLoading(true); // Indicate loading while saving
        try {
            const formData = new FormData();
            // Append all edited text fields, including new ones
            for (const key in editedProfileData) {
                // Exclude profile_photo_url as it's not a direct database field for update
                if (key !== 'profile_photo_url') {
                    formData.append(key, editedProfileData[key] || '');
                }
            }

            // Append profile photo file if selected
            if (profilePhotoFile) {
                formData.append('photo', profilePhotoFile);
            }

            // CORRECTED: Added '/api' prefix to the PUT request URL
            await authAxios.put(`${apiBaseUrl}/api/admin/users/${editedProfileData.id}`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            
            showMessage('Employee profile updated successfully!', 'success');
            setShowProfileModal(false); // Close modal
            setIsEditingProfileInModal(false); // Exit edit mode
            setProfilePhotoFile(null); // Clear file input state
            // Re-fetch employees to update the list with new data
            const employeesResponse = await authAxios.get('/api/admin/users');
            setEmployees(employeesResponse.data);

        } catch (error) {
            console.error("Error saving profile changes:", error.response?.data?.message || error.message);
            showMessage(`Failed to save profile changes: ${error.response?.data?.message || error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className={`flex flex-1 flex-col md:flex-row ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`}> {/* Added flex-col md:flex-row for responsiveness */}
            {/* Sidebar */}
            <aside className={`w-full md:w-64 p-6 border-r ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-lg transition-colors duration-300 flex-shrink-0 md:h-screen md:sticky md:top-0`}>
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">Admin Panel</h1>
                    <button
                        onClick={toggleDarkMode}
                        className="p-2 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
                        aria-label="Toggle dark mode"
                    >
                        {darkMode ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.325 3.325l-.707.707M6.372 6.372l-.707-.707m12.728 0l-.707-.707M6.372 17.628l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9 9 0 008.354-5.646z" />
                            </svg>
                        )}
                    </button>
                </div>
                <nav className="space-y-4">
                    <button
                        onClick={() => {
                            setActiveTab('employees');
                            setAttendanceFilterStatus(''); // Clear filters when changing tab
                            setAttendanceFilterDepartment('');
                        }}
                        className={`w-full text-left py-2 px-4 rounded-md font-medium transition-colors duration-200 ${activeTab === 'employees' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                    >
                        Manage Employees
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab('attendance');
                            setAttendanceFilterStatus(''); // Clear filters when changing tab
                            setAttendanceFilterDepartment('');
                        }}
                        className={`w-full text-left py-2 px-4 rounded-md font-medium transition-colors duration-200 ${activeTab === 'attendance' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                    >
                        View Attendance
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab('leave-management');
                            setAttendanceFilterStatus(''); // Clear filters when changing tab
                            setAttendanceFilterDepartment('');
                        }}
                        className={`w-full text-left py-2 px-4 rounded-md font-medium transition-colors duration-200 ${activeTab === 'leave-management' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                    >
                        Leave Management
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab('holidays');
                            setAttendanceFilterStatus(''); // Clear filters when changing tab
                            setAttendanceFilterDepartment('');
                        }}
                        className={`w-full text-left py-2 px-4 rounded-md font-medium transition-colors duration-200 ${activeTab === 'holidays' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                    >
                        Manage Holidays
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab('weekly-offs');
                            setAttendanceFilterStatus(''); // Clear filters when changing tab
                            setAttendanceFilterDepartment('');
                        }}
                        className={`w-full text-left py-2 px-4 rounded-md font-medium transition-colors duration-200 ${activeTab === 'weekly-offs' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                    >
                        Manage Weekly Offs
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab('notifications');
                            setAttendanceFilterStatus(''); // Clear filters when changing tab
                            setAttendanceFilterDepartment('');
                        }}
                        className={`w-full text-left py-2 px-4 rounded-md font-medium transition-colors duration-200 ${activeTab === 'notifications' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:text-gray-700'}`}
                    >
                        Send Notifications
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab('analytics');
                            setAttendanceFilterStatus(''); // Clear filters when changing tab
                            setAttendanceFilterDepartment('');
                        }}
                        className={`w-full text-left py-2 px-4 rounded-md font-medium transition-colors duration-200 ${activeTab === 'analytics' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                    >
                        Analytics & Reports
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab('correction-review'); // New tab for correction review
                            setAttendanceFilterStatus(''); // Clear filters when changing tab
                            setAttendanceFilterDepartment('');
                        }}
                        className={`w-full text-left py-2 px-4 rounded-md font-medium transition-colors duration-200 ${activeTab === 'correction-review' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:text-gray-700'}`}
                    >
                        Correction Review
                    </button>
                    <button
                        onClick={() => setActiveTab('profile-requests')}
                        className={`w-full text-left py-2 px-4 rounded-md font-medium transition-colors duration-200 ${activeTab === 'profile-requests' ? (darkMode ? 'bg-purple-600 text-white shadow-md' : 'bg-indigo-600 text-white shadow-md') : (darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-200')}`}
                    >
                        Profile Requests
                    </button>

                    <button
                        onClick={() => setActiveTab('payroll')}
                        className={`w-full text-left py-2 px-4 rounded-md font-medium transition-colors duration-200 ${activeTab === 'payroll' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                    >
                        Payroll Management
                    </button>
                    
                    <button
                        onClick={() => setShowExportModal(true)}
                        className={`w-full text-left py-2 px-4 rounded-md font-medium transition-colors duration-200 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700`}
                    >
                        Export Attendance
                    </button>

                    
                </nav>
                <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Logged in as:</p>
                    <p className="font-semibold text-blue-700 dark:text-blue-300">{user?.name || user?.email}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">ID: {user?.id}</p>
                    <button
                        onClick={handleLogout}
                        className="mt-6 w-full py-2 px-4 rounded-md bg-red-600 text-white font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-800 transition-colors duration-200"
                    >
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 overflow-auto">
                {/* Search and Filter (Common for Employees and Attendance) */}
                {(activeTab === 'employees' || activeTab === 'attendance') && (
                    <div className="mb-8 flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0 sm:space-x-4">
                        <div className="relative w-full sm:w-1/2">
                            <input
                                type="text"
                                placeholder="Search employees or attendance..."
                                className="w-full px-4 py-2 pl-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        {activeTab === 'attendance' && (
                            <div className="relative w-full sm:w-auto">
                                <input
                                    type="date"
                                    className="w-full px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                                    value={filterDate}
                                    onChange={(e) => setFilterDate(e.target.value)}
                                />
                            </div>
                        )}
                        {/* Display current filter status if active */}
                        {activeTab === 'attendance' && attendanceFilterStatus && (
                            <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                    Filtering by: <span className="font-bold">{attendanceFilterStatus}</span>
                                </span>
                                <button
                                    onClick={() => setAttendanceFilterStatus('')}
                                    className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                    title="Clear filter"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        )}
                    </div>
                )}


{/* Employee Management Tab */}
{activeTab === 'employees' && (
    <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-8 transition-colors duration-300">
        <h2 className="text-2xl font-semibold mb-6">Manage Employees</h2>

        {/* Add/Edit Employee Form */}
        <div className="mb-6">
            {employees.length < MAX_ALLOWED_USERS && (
                <button
                    onClick={() => {
                        if (isAddingEmployee) { // If currently open, close and reset
                            resetEmployeeForm();
                        } else { // If currently closed, open for adding
                            setIsAddingEmployee(true);
                            setIsEditingEmployee(false); // Ensure not in editing mode when opening for add
                            setEditingEmployeeData(null);
                        }
                    }}
                    className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 shadow-md flex items-center"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    {isAddingEmployee ? 'Cancel' : 'Add New Employee'}
                </button>
            )}
            {isAddingEmployee && (
                <div className="mt-4 p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700">
                    <h3 className="text-lg font-medium mb-4">{isEditingEmployee ? 'Edit Employee Details' : 'New Employee Details'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                            type="text"
                            placeholder="Employee Name"
                            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                            value={newEmployeeName}
                            onChange={(e) => setNewEmployeeName(e.target.value)}
                            required
                        />
                        <input
                            type="email"
                            placeholder="Employee Email"
                            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                            value={newEmployeeEmail}
                            onChange={(e) => setNewEmployeeEmail(e.target.value)}
                            required
                        />
                        <input
                            type="text"
                            placeholder="Employee ID"
                            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                            value={newEmployeeId}
                            onChange={(e) => setNewEmployeeId(e.target.value)}
                            required
                        />
                        <input
                            type="password"
                            placeholder={isEditingEmployee ? "New Password (Optional)" : "Password"}
                            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                            value={newEmployeePassword}
                            onChange={(e) => setNewEmployeePassword(e.target.value)}
                            required={!isEditingEmployee}
                        />
                        <select
                            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                            value={newEmployeeRole}
                            onChange={(e) => setNewEmployeeRole(e.target.value)}
                            required
                        >
                            <option value="employee">Employee</option>
                            <option value="admin">Admin</option>
                        </select>
                        <select
                            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                            value={newEmployeeShiftType}
                            onChange={(e) => setNewEmployeeShiftType(e.target.value)}
                            required
                        >
                            <option value="day">Day</option>
                            <option value="evening">Evening</option>
                        </select>
                        {/* New Fields for Employee Registration/Edit Form (Optional: if you want to add them here directly) */}
                        {/* You would need new states for these, e.g., newPanCardNumber, setNewPanCardNumber */}
                        {/*
                        <input
                            type="text"
                            placeholder="PAN Card Number"
                            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                            value={newPanCardNumber}
                            onChange={(e) => setNewPanCardNumber(e.target.value)}
                        />
                        <input
                            type="date"
                            placeholder="Date of Birth"
                            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                            value={newDateOfBirth}
                            onChange={(e) => setNewDateOfBirth(e.target.value)}
                        />
                        */}
                    </div>
                    <button
                        onClick={handleSaveEmployee}
                        className="mt-4 px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors duration-200 shadow-md"
                    >
                        {isEditingEmployee ? 'Update Employee' : 'Save Employee'}
                    </button>
                </div>
            )}
        </div>

                        {/* Employee List Table */}
                        <div className="overflow-x-auto rounded-lg shadow-md">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Employee ID</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Role</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Shift</th>
                                        {/* NEW TABLE HEADERS FOR NEW FIELDS */}
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">PAN</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Bank Acc.</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">IFSC</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Bank Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">DOB</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {filteredEmployees.length > 0 ? (
                                        filteredEmployees.map(employee => {
                                            console.log("DEBUG: Rendering Edit button for employee:", employee.name);
                                            return (
                                                <tr key={employee.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{employee.name}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{employee.employee_id}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{employee.email}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{employee.role}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{employee.shift_type}</td>
                                                    {/* NEW TABLE DATA CELLS FOR NEW FIELDS */}
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{employee.pan_card_number || 'N/A'}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{employee.bank_account_number || 'N/A'}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{employee.ifsc_code || 'N/A'}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{employee.bank_name || 'N/A'}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{employee.date_of_birth ? moment(employee.date_of_birth).format('YYYY-MM-DD') : 'N/A'}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                        <button
                                                            onClick={() => viewEmployeeProfile(employee)} // New: View Profile button
                                                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-4 transition-colors duration-200"
                                                        >
                                                            View Profile
                                                        </button>
                                                        <button
                                                            onClick={() => editEmployee(employee)}
                                                            className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-4 transition-colors duration-200"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => deleteEmployee(employee.id)}
                                                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors duration-200"
                                                        >
                                                            Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan="11" className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">No employees found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {/* Attendance View Tab */}
                {activeTab === 'attendance' && (
                    <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-300">
                        <h2 className="text-2xl font-semibold mb-6">View Attendance Records</h2>

                        {/* Add/Edit Attendance Form */}
                        <div className="mb-6">
                            <button
                                onClick={() => {
                                    setIsAddingAttendance(!isAddingAttendance);
                                    if (isAddingAttendance) { // If closing, reset edit state
                                        setEditingAttendanceId(null);
                                        setSelectedEmployeeId('');
                                        setSelectedDate(moment().format('YYYY-MM-DD'));
                                        setCheckInTime('');
                                        setCheckOutTime('');
                                    }
                                }}
                                className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 shadow-md flex items-center"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                                </svg>
                                {isAddingAttendance ? 'Cancel' : 'Add New Attendance'}
                            </button>

                            {isAddingAttendance && (
                                <div className="mt-4 p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700">
                                    <h3 className="text-lg font-medium mb-4">{editingAttendanceId ? 'Edit Attendance Record' : 'New Attendance Record'}</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <select
                                            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                                            value={selectedEmployeeId}
                                            onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                            required
                                        >
                                            <option value="">Select Employee</option>
                                            {employees.map(employee => (
                                                <option key={employee.id} value={employee.id}>{employee.name} ({employee.employee_id})</option>
                                            ))}
                                        </select>
                                        <input
                                            type="date"
                                            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                                            value={selectedDate}
                                            onChange={(e) => setSelectedDate(e.target.value)}
                                            required
                                        />
                                        <input
                                            type="time"
                                            placeholder="Check-in Time"
                                            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                                            value={checkInTime}
                                            onChange={(e) => setCheckInTime(e.target.value)}
                                            required
                                        />
                                        <input
                                            type="time"
                                            placeholder="Check-out Time (Optional)"
                                            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                            value={checkOutTime}
                                            onChange={(e) => setCheckOutTime(e.target.value)}
                                        />
                                    </div>
                                    <button
                                        onClick={handleAttendanceSubmit}
                                        className="mt-4 px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors duration-200 shadow-md"
                                    >
                                        {editingAttendanceId ? 'Update Record' : 'Add Record'}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Attendance List Table */}
                        <div className="overflow-x-auto rounded-lg shadow-md">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Employee Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Check-in</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Check-out</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Late Time</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Working Hours</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Extra Hours</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Check-in Device</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Check-out Device</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {displayAttendanceRecords.length > 0 ? (
                                        displayAttendanceRecords.map(record => {
                                            return (
                                                <tr key={`${record.user_id}-${record.date}`} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{record.name}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{record.date}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{record.check_in || 'N/A'}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{record.check_out || 'N/A'}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{record.late_time || '0 min'}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{record.working_hours || '0 hrs'}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{record.extra_hours || '0 hrs'}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{record.status}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{getDeviceType(record.check_in_device)}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{getDeviceType(record.check_out_device)}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                        <button
                                                            onClick={() => editAttendance(record)}
                                                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-4 transition-colors duration-200"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => deleteAttendance(record.user_id, record.date)}
                                                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors duration-200"
                                                        >
                                                            Mark Absent
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan="11" className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">No attendance records found for this date or search.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {/* Leave Management Tab */}
                {activeTab === 'leave-management' && (
                    <AdminLeaveManagement
                        showMessage={showMessage}
                        apiBaseUrl={apiBaseUrl}
                        accessToken={accessToken}
                        authAxios={authAxios}
                    />
                )}

                {/* Manage Holidays Tab */}
                {activeTab === 'holidays' && (
                    <HolidayManagement
                        showMessage={showMessage}
                        apiBaseUrl={apiBaseUrl}
                        accessToken={accessToken}
                        authAxios={authAxios}
                    />
                )}

                {/* Manage Weekly Offs Tab */}
                {activeTab === 'weekly-offs' && (
                    <WeeklyOffManagement
                        showMessage={showMessage}
                        apiBaseUrl={apiBaseUrl}
                        accessToken={accessToken}
                        authAxios={authAxios}
                    />
                )}

                {/* Send Notifications Tab */}
                {activeTab === 'notifications' && (
                    <AdminNotifications
                        showMessage={showMessage}
                        apiBaseUrl={apiBaseUrl}
                        accessToken={accessToken}
                        authAxios={authAxios}
                    />
                )}

                {/* Analytics & Reports Tab */}
                {activeTab === 'analytics' && (
                    <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-8 transition-colors duration-300">
                        <AdminAnalyticsReports
                            showMessage={showMessage}
                            apiBaseUrl={apiBaseUrl}
                            accessToken={accessToken}
                            authAxios={authAxios}
                            adminStats={adminStats}
                            handleAnalyticsClick={handleAnalyticsClick}
                        />
                        {/* NEW SECTION: Birthdays This Month */}
                        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                            <h3 className="text-xl font-semibold mb-4">Birthdays This Month</h3>
                            {birthdaysThisMonth.length > 0 ? (
                                <ul className="list-disc list-inside space-y-2">
                                    {birthdaysThisMonth.map(emp => (
                                        <li key={emp.id} className="text-gray-700 dark:text-gray-300">
                                            <span className="font-medium">{emp.name}</span> - {moment(emp.date_of_birth).format('MMMM Do')}
                                            {moment(emp.date_of_birth).date() === moment().date() && (
                                                <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full dark:bg-yellow-800 dark:text-yellow-100">
                                                    Today! 🎂
                                                </span>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-gray-500 dark:text-gray-400">No birthdays this month.</p>
                            )}
                        </div>
                    </section>
                )}

                {/* Correction Review Tab */}
                {activeTab === 'correction-review' && (
                    <AdminCorrectionReview
                        showMessage={showMessage}
                        apiBaseUrl={apiBaseUrl}
                        accessToken={accessToken}
                        authAxios={authAxios}
                    />
                )}
                {/* Profile Requests Tab (already existing, just ensuring it's here) */}
                {activeTab === 'profile-requests' && (
                    <section className={`p-6 rounded-lg shadow-md transition-colors duration-300 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                        <AdminProfileRequests
                            showMessage={showMessage}
                            apiBaseUrl={apiBaseUrl}
                            accessToken={accessToken}
                            darkMode={darkMode}
                        />
                    </section>
                )}

                {/* Payroll Management Tab */}
                {activeTab === 'payroll' && (
                    <AdminPayrollManagement
                        showMessage={showMessage}
                        apiBaseUrl={apiBaseUrl}
                        accessToken={accessToken}
                        authAxios={authAxios}
                        employees={employees}
                        darkMode={darkMode}
                    />
                )}
           
                
            </main>

            {/* Export Modal */}
            {showExportModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
                    <div className={`bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                        <h3 className="text-xl font-semibold mb-6">Export Attendance Data</h3>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="exportStartDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                                <input
                                    type="date"
                                    id="exportStartDate"
                                    className="w-full px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                                    value={exportStartDate}
                                    onChange={(e) => setExportStartDate(e.target.value)}
                                />
                            </div>
                            <div>
                                <label htmlFor="exportEndDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                                <input
                                    type="date"
                                    id="exportEndDate"
                                    className="w-full px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                    value={exportEndDate}
                                    onChange={(e) => setExportEndDate(e.target.value)}
                                />
                            </div>
                            <div>
                                <label htmlFor="exportEmployee" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Employee (Optional)</label>
                                <select
                                    id="exportEmployee"
                                    className="w-full px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                                    value={exportEmployeeId}
                                    onChange={(e) => setExportEmployeeId(e.target.value)}
                                >
                                    <option value="">All Employees</option>
                                    {employees.map(employee => (
                                        <option key={employee.id} value={employee.employee_id}>{employee.name} ({employee.employee_id})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end space-x-4">
                            <button
                                onClick={() => setShowExportModal(false)}
                                className="px-6 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={exportAttendanceToCSV}
                                className="px-6 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-200"
                            >
                                Export
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Employee Profile View/Edit Modal */}
            {showProfileModal && viewingEmployeeProfile && editedProfileData && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
                    <div className={`bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-sm sm:max-w-md h-[80vh] flex flex-col ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                        <h3 className="text-2xl font-semibold mb-6">
                            {isEditingProfileInModal ? `Edit Profile: ${editedProfileData.name}` : `Employee Profile: ${viewingEmployeeProfile.name}`}
                        </h3>
                        <div className="space-y-4 overflow-y-auto flex-1 pr-2">
                            {/* Profile Photo Section */}
                            <div className="flex flex-col items-center mb-4">
                                <img
                                    src={editedProfileData.profile_photo_url || "https://placehold.co/128x128/cccccc/000000?text=No+Image"}
                                    alt={`${editedProfileData.name}'s profile`}
                                    className="w-32 h-32 rounded-full object-cover border-4 border-blue-400"
                                    onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/128x128/cccccc/000000?text=No+Image"; }}
                                />
                                {isEditingProfileInModal && (
                                    <div className="mt-4">
                                        <label htmlFor="profilePhotoUpload" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Upload New Profile Picture
                                        </label>
                                        <input
                                            type="file"
                                            id="profilePhotoUpload"
                                            accept="image/*"
                                            className="block w-full text-sm text-gray-900 dark:text-gray-300
                                                       file:mr-4 file:py-2 file:px-4
                                                       file:rounded-md file:border-0
                                                       file:text-sm file:font-semibold
                                                       file:bg-blue-50 file:text-blue-700
                                                       hover:file:bg-blue-100"
                                            onChange={handleProfilePhotoChange}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Editable Fields */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name:</label>
                                    {isEditingProfileInModal ? (
                                        <input
                                            type="text"
                                            name="name"
                                            value={editedProfileData.name || ''}
                                            onChange={handleProfileEditChange}
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    ) : (
                                        <p className="mt-1 text-gray-900 dark:text-white">{viewingEmployeeProfile.name}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Employee ID:</label>
                                    {isEditingProfileInModal ? (
                                        <input
                                            type="text"
                                            name="employee_id"
                                            value={editedProfileData.employee_id || ''}
                                            onChange={handleProfileEditChange}
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    ) : (
                                        <p className="mt-1 text-gray-900 dark:text-white">{viewingEmployeeProfile.employee_id}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email:</label>
                                    {isEditingProfileInModal ? (
                                        <input
                                            type="email"
                                            name="email"
                                            value={editedProfileData.email || ''}
                                            onChange={handleProfileEditChange}
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    ) : (
                                        <p className="mt-1 text-gray-900 dark:text-white">{viewingEmployeeProfile.email}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Role:</label>
                                    {isEditingProfileInModal ? (
                                        <select
                                            name="role"
                                            value={editedProfileData.role || 'employee'}
                                            onChange={handleProfileEditChange}
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        >
                                            <option value="employee">Employee</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    ) : (
                                        <p className="mt-1 text-gray-900 dark:text-white">{viewingEmployeeProfile.role}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Shift Type:</label>
                                    {isEditingProfileInModal ? (
                                        <select
                                            name="shift_type"
                                            value={editedProfileData.shift_type || 'day'}
                                            onChange={handleProfileEditChange}
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        >
                                            <option value="day">Day</option>
                                            <option value="evening">Evening</option>
                                        </select>
                                    ) : (
                                        <p className="mt-1 text-gray-900 dark:text-white">{viewingEmployeeProfile.shift_type}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone Number:</label>
                                    {isEditingProfileInModal ? (
                                        <input
                                            type="text"
                                            name="mobile_number"
                                            value={editedProfileData.mobile_number || ''}
                                            onChange={handleProfileEditChange}
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Enter phone number"
                                        />
                                    ) : (
                                        <p className="mt-1 text-gray-900 dark:text-white">{viewingEmployeeProfile.mobile_number || 'N/A'}</p>
                                    )}
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Address:</label>
                                    {isEditingProfileInModal ? (
                                        <textarea
                                            name="address"
                                            value={editedProfileData.address || ''}
                                            onChange={handleProfileEditChange}
                                            rows="2"
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Enter employee's address"
                                        ></textarea>
                                    ) : (
                                        <p className="mt-1 text-gray-900 dark:text-white">{viewingEmployeeProfile.address || 'N/A'}</p>
                                    )}
                                </div>

                                <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Designation:</label>
    {isEditingProfileInModal ? (
        <input
            type="text"
            name="designation"
            value={editedProfileData.designation || ''}
            onChange={handleProfileEditChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter designation"
        />
    ) : (
        <p className="mt-1 text-gray-900 dark:text-white">{viewingEmployeeProfile.designation || 'N/A'}</p>
    )}
</div>

<div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Joining Date:</label>
    {isEditingProfileInModal ? (
        <input
            type="date"
            name="joining_date"
            value={editedProfileData.joining_date || ''} // Should be YYYY-MM-DD
            onChange={handleProfileEditChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
    ) : (
        <p className="mt-1 text-gray-900 dark:text-white">{viewingEmployeeProfile.joining_date ? moment(viewingEmployeeProfile.joining_date).format('YYYY-MM-DD') : 'N/A'}</p>
    )}
</div>

                                {/* NEW PROFILE FIELDS */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">PAN Card Number:</label>
                                    {isEditingProfileInModal ? (
                                        <input
                                            type="text"
                                            name="pan_card_number"
                                            value={editedProfileData.pan_card_number || ''}
                                            onChange={handleProfileEditChange}
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Enter PAN card number"
                                        />
                                    ) : (
                                        <p className="mt-1 text-gray-900 dark:text-white">{viewingEmployeeProfile.pan_card_number || 'N/A'}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date of Birth:</label>
                                    {isEditingProfileInModal ? (
                                        <input
                                            type="date"
                                            name="date_of_birth"
                                            value={editedProfileData.date_of_birth || ''} // Should be YYYY-MM-DD
                                            onChange={handleProfileEditChange}
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    ) : (
                                        <p className="mt-1 text-gray-900 dark:text-white">{viewingEmployeeProfile.date_of_birth ? moment(viewingEmployeeProfile.date_of_birth).format('YYYY-MM-DD') : 'N/A'}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bank Account Number:</label>
                                    {isEditingProfileInModal ? (
                                        <input
                                            type="text"
                                            name="bank_account_number"
                                            value={editedProfileData.bank_account_number || ''}
                                            onChange={handleProfileEditChange}
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Enter bank account number"
                                        />
                                    ) : (
                                        <p className="mt-1 text-gray-900 dark:text-white">{viewingEmployeeProfile.bank_account_number || 'N/A'}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">IFSC Code:</label>
                                    {isEditingProfileInModal ? (
                                        <input
                                            type="text"
                                            name="ifsc_code"
                                            value={editedProfileData.ifsc_code || ''}
                                            onChange={handleProfileEditChange}
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Enter IFSC code"
                                        />
                                    ) : (
                                        <p className="mt-1 text-gray-900 dark:text-white">{viewingEmployeeProfile.ifsc_code || 'N/A'}</p>
                                    )}
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bank Name:</label>
                                    {isEditingProfileInModal ? (
                                        <input
                                            type="text"
                                            name="bank_name"
                                            value={editedProfileData.bank_name || ''}
                                            onChange={handleProfileEditChange}
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Enter bank name"
                                        />
                                    ) : (
                                        <p className="mt-1 text-gray-900 dark:text-white">{viewingEmployeeProfile.bank_name || 'N/A'}</p>
                                    )}
                                </div>

                                {/* Placeholder for KYC Details */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">KYC Details:</label>
                                    {isEditingProfileInModal ? (
                                        <textarea
                                            name="kyc_details"
                                            value={editedProfileData.kyc_details || ''}
                                            onChange={handleProfileEditChange}
                                            rows="3"
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Enter KYC details (e.g., Aadhaar number, etc.)"
                                        ></textarea>
                                    ) : (
                                        <p className="mt-1 text-gray-900 dark:text-white">{viewingEmployeeProfile.kyc_details || 'N/A'}</p>
                                    )}
                                </div>
                                {/* Placeholder for Personal Details */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Personal Details:</label>
                                    {isEditingProfileInModal ? (
                                        <textarea
                                            name="personal_details"
                                            value={editedProfileData.personal_details || ''}
                                            onChange={handleProfileEditChange}
                                            rows="3"
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Enter personal details (e.g., Marital Status, Blood Group)"
                                        ></textarea>
                                    ) : (
                                        <p className="mt-1 text-gray-900 dark:text-white">{viewingEmployeeProfile.personal_details || 'N/A'}</p>
                                    )}
                                </div>
                                {/* Placeholder for Family History */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Family History:</label>
                                    {isEditingProfileInModal ? (
                                        <textarea
                                            name="family_history"
                                            value={editedProfileData.family_history || ''}
                                            onChange={handleProfileEditChange}
                                            rows="3"
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Enter family details (e.g., Father's Name, Mother's Name, Spouse/Children details)"
                                        ></textarea>
                                    ) : (
                                        <p className="mt-1 text-gray-900 dark:text-white">{viewingEmployeeProfile.family_history || 'N/A'}</p>
                                    )}
                                </div>
                            </div>
                            <p><span className="font-medium">Joined On:</span> {moment(viewingEmployeeProfile.created_at).format('YYYY-MM-DD')}</p>
                        </div>
                        <div className="mt-6 flex justify-end space-x-4">
                            {isEditingProfileInModal ? (
                                <>
                                    <button
                                        onClick={() => setIsEditingProfileInModal(false)} // Cancel edit, revert to view
                                        className="px-6 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveProfileChanges}
                                        className="px-6 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors duration-200"
                                    >
                                        Save Changes
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={() => setIsEditingProfileInModal(true)} // Switch to edit mode
                                        className="px-6 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-200"
                                    >
                                        Edit Profile
                                    </button>
                                    <button
                                        onClick={() => setShowProfileModal(false)}
                                        className="px-6 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                                    >
                                        Close
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Make the component globally accessible
window.AdminDashboard = AdminDashboard;
