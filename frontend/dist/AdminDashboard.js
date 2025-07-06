// AdminDashboard.jsx
// No Firestore imports needed anymore
// import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, where, getDocs } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

const AdminDashboard = ({
  user,
  handleLogout,
  darkMode,
  toggleDarkMode,
  showMessage,
  apiBaseUrl,
  accessToken
}) => {
  // Define the maximum number of users allowed
  const MAX_ALLOWED_USERS = 10; // You can change this number as needed
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

  // New: Active tab for main navigation
  const [activeTab, setActiveTab] = React.useState('employees'); // 'employees', 'attendance', 'leave-management', 'holidays', 'weekly-offs', 'notifications', 'analytics', 'correction-review'

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
  const getDeviceType = userAgent => {
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
        // MODIFIED: Assumes backend /api/admin/users returns full profile data
        const employeesResponse = await authAxios.get('/api/admin/users');
        setEmployees(employeesResponse.data);
        if (activeTab === 'attendance') {
          // Fetch attendance records (admin view, for a specific date or all)
          // MODIFIED: Include status and department filters in the API call
          const params = {
            date: filterDate || moment().format('YYYY-MM-DD'),
            status: attendanceFilterStatus,
            department: attendanceFilterDepartment // Will be empty for now
          };
          const attendanceResponse = await authAxios.get(`/api/admin/attendance`, {
            params
          });
          setAttendanceRecords(attendanceResponse.data);
        } else if (activeTab === 'analytics') {
          // Always fetch admin stats when analytics tab is active
          const statsResponse = await authAxios.get(`${apiBaseUrl}/api/admin/stats`);
          setAdminStats(statsResponse.data);
          // For monthly summary, we might need a separate component or more state
        }
        // Other tabs (leave-management, holidays, weekly-offs, notifications, correction-review)
        // will have their own components fetching data
      } catch (error) {
        console.error("Error fetching data for admin dashboard:", error.response?.data?.message || error.message);
        showMessage(`Error fetching data: ${error.response?.data?.message || error.message}`, "error");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
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
  const filteredEmployees = employees.filter(employee => employee.name.toLowerCase().includes(searchQuery.toLowerCase()) || employee.email.toLowerCase().includes(searchQuery.toLowerCase()) || employee.employee_id.toLowerCase().includes(searchQuery.toLowerCase()) // Include employee_id in search
  );

  // Filtered attendance records based on search query and date (already handled by backend filterDate if passed)
  // This client-side filter is mostly for refining results if the backend doesn't handle all combinations,
  // or for the search bar when attendanceFilterStatus/Department are active.
  const displayAttendanceRecords = attendanceRecords.filter(record => {
    const employee = employees.find(emp => emp.id === record.user_id);
    const matchesSearch = employee && (employee.name.toLowerCase().includes(searchQuery.toLowerCase()) || employee.employee_id.toLowerCase().includes(searchQuery.toLowerCase()));
    // Backend should ideally handle status/department filtering, but keeping this for robustness
    const matchesStatus = attendanceFilterStatus ? record.status.toLowerCase() === attendanceFilterStatus.toLowerCase() : true;
    // const matchesDepartment = attendanceFilterDepartment ? employee.department === attendanceFilterDepartment : true; // Uncomment if employee has department

    return matchesSearch && matchesStatus; // && matchesDepartment;
  });

  // Function to handle saving (add or update) an employee from the main employee form
  const handleSaveEmployee = async () => {
    if (!newEmployeeName || !newEmployeeEmail || !newEmployeeId || !newEmployeeRole || !newEmployeeShiftType) {
      // Password is only required for new employee creation
      if (!isEditingEmployee || newEmployeePassword) {
        // If not editing, or editing but password field is empty
        showMessage('All employee fields are required.', 'error');
        return;
      }
    }

    // --- START NEW MODIFICATION FOR USER LIMIT ---
    // Check if adding a new employee and if the limit has been reached
    if (!isEditingEmployee && employees.length >= MAX_ALLOWED_USERS) {
      showMessage(`User limit of ${MAX_ALLOWED_USERS} reached. Cannot add more employees.`, 'error');
      // Reset the form if the user tries to add when limit is reached
      resetEmployeeForm();
      return; // Stop the function execution
    }
    // --- END NEW MODIFICATION ---

    const employeeData = {
      name: newEmployeeName,
      email: newEmployeeEmail,
      employee_id: newEmployeeId,
      role: newEmployeeRole,
      shift_type: newEmployeeShiftType
    };

    // Only include password if it's a new employee or if password field is explicitly filled during edit
    if (!isEditingEmployee || newEmployeePassword) {
      employeeData.password = newEmployeePassword;
    }
    try {
      if (isEditingEmployee && editingEmployeeData) {
        // Update existing employee
        await authAxios.put(`${apiBaseUrl}/admin/users/${editingEmployeeData.id}`, employeeData);
        showMessage('Employee updated successfully!', 'success');
      } else {
        // Add new employee
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

      // Re-fetch employees
      const employeesResponse = await authAxios.get('/api/admin/users');
      setEmployees(employeesResponse.data);
    } catch (error) {
      console.error("Error saving employee:", error.response?.data?.message || error.message);
      showMessage(`Failed to save employee: ${error.response?.data?.message || error.message}`, 'error');
    }
  };

  // Function to initiate editing an employee from the main employee table
  const editEmployee = employee => {
    console.log("DEBUG: editEmployee function called for employee:", employee.name); // NEW DEBUG LOG
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
  };

  // Function to delete an employee
  const deleteEmployee = async employeeIdToDelete => {
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
        // For editing, we'll use the correction-review endpoint to "force" an attendance record.
        // This is a simplification. A more robust solution might have a direct 'admin add/update attendance' endpoint.
        // We assume the backend's correction-review can handle direct updates if a correction doesn't exist.
        // The current backend logic for /admin/attendance/correction-review implies it's for *pending* corrections.
        // To truly edit an existing attendance record, a separate PUT /api/admin/attendance endpoint would be ideal.
        // For this example, we'll assume the correction-review endpoint can be used to "force" a state.
        // This part might need further refinement based on the exact backend implementation for direct admin edits.

        // Simplified approach: Create a correction request and immediately approve it.
        // This ensures the backend's logic for processing corrections is used.
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
        // For adding new attendance, submit a correction request and immediately approve it.
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
      const attendanceResponse = await authAxios.get(`/api/admin/attendance`, {
        params
      });
      setAttendanceRecords(attendanceResponse.data);
    } catch (error) {
      console.error("Error saving attendance:", error.response?.data?.message || error.message);
      showMessage(`Failed to save attendance: ${error.response?.data?.message || error.message}`, 'error');
    }
  };

  // Function to edit an attendance record
  const editAttendance = record => {
    setSelectedEmployeeId(record.user_id);
    setSelectedDate(record.date);
    // Convert 'hh:mm A' to 'HH:mm' for input type="time"
    setCheckInTime(record.check_in && record.check_in !== 'N/A' ? moment(record.check_in, 'hh:mm A').format('HH:mm') : '');
    setCheckOutTime(record.check_out && record.check_out !== 'N/A' ? moment(record.check_out, 'hh:mm A').format('HH:mm') : '');
    setEditingAttendanceId(record.user_id); // Use user_id as identifier for editing
    setIsAddingAttendance(true); // Open the form for editing
  };

  // Function to delete an attendance record (mark as absent/delete for a specific day)
  const deleteAttendance = async (userIdToDelete, dateToDelete) => {
    if (window.confirm('Are you sure you want to mark this attendance record as absent? This will remove check-in/out times.')) {
      try {
        // Use the mark-absent-forgotten-checkout endpoint to set status to absent
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
        const attendanceResponse = await authAxios.get(`/api/admin/attendance`, {
          params
        });
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
      // Backend handles the CSV generation and sends it as a file
      const response = await authAxios.get(`${apiBaseUrl}/api/admin/export-attendance`, {
        params: {
          year: startMoment.year(),
          month: startMoment.month() + 1,
          // Moment months are 0-indexed
          employee_id: exportEmployeeId // Pass employee_id if selected
        },
        responseType: 'blob' // Important for handling file downloads
      });

      // Use FileSaver.js to save the blob
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
  const viewEmployeeProfile = employee => {
    setViewingEmployeeProfile(employee);
    setEditedProfileData({
      ...employee
    }); // Initialize edited data with current employee data
    setIsEditingProfileInModal(false); // Start in view mode
    setProfilePhotoFile(null); // Clear any previously selected file
    setShowProfileModal(true);
    // --- DEBUG LOG START ---
    console.log("DEBUG: Viewing Employee Profile:", employee);
    // --- DEBUG LOG END ---
  };

  // Handle changes in the editable profile fields within the modal
  const handleProfileEditChange = e => {
    const {
      name,
      value
    } = e.target;
    setEditedProfileData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };

  // Handle file selection for profile picture
  const handleProfilePhotoChange = e => {
    setProfilePhotoFile(e.target.files[0]);
  };

  // Function to save changes made in the profile modal
  const handleSaveProfileChanges = async () => {
    if (!editedProfileData) return;
    setLoading(true); // Indicate loading while saving
    try {
      const formData = new FormData();
      // Append all edited text fields
      for (const key in editedProfileData) {
        // For KYC, Personal, and Family History, send as plain text
        formData.append(key, editedProfileData[key] || '');
      }

      // Append profile photo file if selected
      if (profilePhotoFile) {
        formData.append('photo', profilePhotoFile); // Changed to 'photo' to match backend upload.single('photo')
      }

      // Make a PUT request to update the employee
      // Note: Axios with FormData automatically sets Content-Type to multipart/form-data
      await authAxios.put(`${apiBaseUrl}/admin/users/${editedProfileData.id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data' // Important for file uploads
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
  return /*#__PURE__*/React.createElement("div", {
    className: `flex flex-1 flex-col md:flex-row ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`
  }, " ", /*#__PURE__*/React.createElement("aside", {
    className: `w-full md:w-64 p-6 border-r ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-lg transition-colors duration-300 flex-shrink-0 md:h-screen md:sticky md:top-0`
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-8"
  }, /*#__PURE__*/React.createElement("h1", {
    className: "text-2xl font-bold text-blue-600 dark:text-blue-400"
  }, "Admin Panel"), /*#__PURE__*/React.createElement("button", {
    onClick: toggleDarkMode,
    className: "p-2 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800",
    "aria-label": "Toggle dark mode"
  }, darkMode ? /*#__PURE__*/React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    className: "h-6 w-6 text-yellow-400",
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M12 3v1m0 16v1m9-9h-1M4 12H3m15.325 3.325l-.707.707M6.372 6.372l-.707-.707m12.728 0l-.707-.707M6.372 17.628l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
  })) : /*#__PURE__*/React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    className: "h-6 w-6 text-gray-700",
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9 9 0 008.354-5.646z"
  })))), /*#__PURE__*/React.createElement("nav", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setActiveTab('employees');
      setAttendanceFilterStatus(''); // Clear filters when changing tab
      setAttendanceFilterDepartment('');
    },
    className: `w-full text-left py-2 px-4 rounded-md font-medium transition-colors duration-200 ${activeTab === 'employees' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`
  }, "Manage Employees"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setActiveTab('attendance');
      setAttendanceFilterStatus(''); // Clear filters when changing tab
      setAttendanceFilterDepartment('');
    },
    className: `w-full text-left py-2 px-4 rounded-md font-medium transition-colors duration-200 ${activeTab === 'attendance' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`
  }, "View Attendance"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setActiveTab('leave-management');
      setAttendanceFilterStatus(''); // Clear filters when changing tab
      setAttendanceFilterDepartment('');
    },
    className: `w-full text-left py-2 px-4 rounded-md font-medium transition-colors duration-200 ${activeTab === 'leave-management' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`
  }, "Leave Management"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setActiveTab('holidays');
      setAttendanceFilterStatus(''); // Clear filters when changing tab
      setAttendanceFilterDepartment('');
    },
    className: `w-full text-left py-2 px-4 rounded-md font-medium transition-colors duration-200 ${activeTab === 'holidays' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`
  }, "Manage Holidays"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setActiveTab('weekly-offs');
      setAttendanceFilterStatus(''); // Clear filters when changing tab
      setAttendanceFilterDepartment('');
    },
    className: `w-full text-left py-2 px-4 rounded-md font-medium transition-colors duration-200 ${activeTab === 'weekly-offs' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`
  }, "Manage Weekly Offs"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setActiveTab('notifications');
      setAttendanceFilterStatus(''); // Clear filters when changing tab
      setAttendanceFilterDepartment('');
    },
    className: `w-full text-left py-2 px-4 rounded-md font-medium transition-colors duration-200 ${activeTab === 'notifications' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:text-gray-700'}`
  }, "Send Notifications"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setActiveTab('analytics');
      setAttendanceFilterStatus(''); // Clear filters when changing tab
      setAttendanceFilterDepartment('');
    },
    className: `w-full text-left py-2 px-4 rounded-md font-medium transition-colors duration-200 ${activeTab === 'analytics' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`
  }, "Analytics & Reports"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setActiveTab('correction-review'); // New tab for correction review
      setAttendanceFilterStatus(''); // Clear filters when changing tab
      setAttendanceFilterDepartment('');
    },
    className: `w-full text-left py-2 px-4 rounded-md font-medium transition-colors duration-200 ${activeTab === 'correction-review' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:text-gray-700'}`
  }, "Correction Review"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setActiveTab('profile-requests') // Assuming you have an activeTab state
    ,
    className: `w-full text-left py-2 px-4 rounded-md font-medium transition-colors duration-200 ${activeTab === 'profile-requests' ? darkMode ? 'bg-purple-600 text-white shadow-md' : 'bg-indigo-600 text-white shadow-md' : darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-200'}`
  }, "Profile Requests"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowExportModal(true),
    className: `w-full text-left py-2 px-4 rounded-md font-medium transition-colors duration-200 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700`
  }, "Export Attendance")), /*#__PURE__*/React.createElement("div", {
    className: "mt-8 pt-8 border-t border-gray-200 dark:border-gray-700"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-gray-600 dark:text-gray-400 mb-2"
  }, "Logged in as:"), /*#__PURE__*/React.createElement("p", {
    className: "font-semibold text-blue-700 dark:text-blue-300"
  }, user?.name || user?.email), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-gray-500 dark:text-gray-400"
  }, "ID: ", user?.id), /*#__PURE__*/React.createElement("button", {
    onClick: handleLogout,
    className: "mt-6 w-full py-2 px-4 rounded-md bg-red-600 text-white font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-800 transition-colors duration-200"
  }, "Logout"))), /*#__PURE__*/React.createElement("main", {
    className: "flex-1 p-8 overflow-auto"
  }, (activeTab === 'employees' || activeTab === 'attendance') && /*#__PURE__*/React.createElement("div", {
    className: "mb-8 flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0 sm:space-x-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "relative w-full sm:w-1/2"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "Search employees or attendance...",
    className: "w-full px-4 py-2 pl-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500",
    value: searchQuery,
    onChange: e => setSearchQuery(e.target.value)
  }), /*#__PURE__*/React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    className: "h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400",
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
  }))), activeTab === 'attendance' && /*#__PURE__*/React.createElement("div", {
    className: "relative w-full sm:w-auto"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    className: "w-full px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500",
    value: filterDate,
    onChange: e => setFilterDate(e.target.value)
  })), activeTab === 'attendance' && attendanceFilterStatus && /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-sm font-medium text-blue-600 dark:text-blue-400"
  }, "Filtering by: ", /*#__PURE__*/React.createElement("span", {
    className: "font-bold"
  }, attendanceFilterStatus)), /*#__PURE__*/React.createElement("button", {
    onClick: () => setAttendanceFilterStatus(''),
    className: "text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300",
    title: "Clear filter"
  }, /*#__PURE__*/React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    className: "h-4 w-4",
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M6 18L18 6M6 6l12 12"
  }))))), activeTab === 'employees' && /*#__PURE__*/React.createElement("section", {
    className: "bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-8 transition-colors duration-300"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "text-2xl font-semibold mb-6"
  }, "Manage Employees"), /*#__PURE__*/React.createElement("div", {
    className: "mb-6"
  }, employees.length < MAX_ALLOWED_USERS &&
  /*#__PURE__*/
  // <--- ADD THIS LINE
  React.createElement("button", {
    onClick: () => {
      if (isAddingEmployee) {
        // If currently open, close and reset
        resetEmployeeForm();
      } else {
        // If currently closed, open for adding
        setIsAddingEmployee(true);
        setIsEditingEmployee(false); // Ensure not in editing mode when opening for add
        setEditingEmployeeData(null);
      }
    },
    className: "px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 shadow-md flex items-center"
  }, /*#__PURE__*/React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    className: "h-5 w-5 mr-2",
    viewBox: "0 0 20 20",
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z",
    clipRule: "evenodd"
  })), isAddingEmployee ? 'Cancel' : 'Add New Employee'), " ", isAddingEmployee && /*#__PURE__*/React.createElement("div", {
    className: "mt-4 p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-medium mb-4"
  }, isEditingEmployee ? 'Edit Employee Details' : 'New Employee Details'), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-4"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "Employee Name",
    className: "px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500",
    value: newEmployeeName,
    onChange: e => setNewEmployeeName(e.target.value),
    required: true
  }), /*#__PURE__*/React.createElement("input", {
    type: "email",
    placeholder: "Employee Email",
    className: "px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500",
    value: newEmployeeEmail,
    onChange: e => setNewEmployeeEmail(e.target.value),
    required: true
  }), /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "Employee ID",
    className: "px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500",
    value: newEmployeeId,
    onChange: e => setNewEmployeeId(e.target.value),
    required: true
  }), /*#__PURE__*/React.createElement("input", {
    type: "password",
    placeholder: isEditingEmployee ? "New Password (Optional)" : "Password",
    className: "px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500",
    value: newEmployeePassword,
    onChange: e => setNewEmployeePassword(e.target.value),
    required: !isEditingEmployee // Required only if not editing
  }), /*#__PURE__*/React.createElement("select", {
    className: "px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500",
    value: newEmployeeRole,
    onChange: e => setNewEmployeeRole(e.target.value),
    required: true
  }, /*#__PURE__*/React.createElement("option", {
    value: "employee"
  }, "Employee"), /*#__PURE__*/React.createElement("option", {
    value: "admin"
  }, "Admin")), /*#__PURE__*/React.createElement("select", {
    className: "px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500",
    value: newEmployeeShiftType,
    onChange: e => setNewEmployeeShiftType(e.target.value),
    required: true
  }, /*#__PURE__*/React.createElement("option", {
    value: "day"
  }, "Day"), /*#__PURE__*/React.createElement("option", {
    value: "evening"
  }, "Evening"))), /*#__PURE__*/React.createElement("button", {
    onClick: handleSaveEmployee,
    className: "mt-4 px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors duration-200 shadow-md"
  }, isEditingEmployee ? 'Update Employee' : 'Save Employee'))), /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto rounded-lg shadow-md"
  }, /*#__PURE__*/React.createElement("table", {
    className: "min-w-full divide-y divide-gray-200 dark:divide-gray-700"
  }, /*#__PURE__*/React.createElement("thead", {
    className: "bg-gray-50 dark:bg-gray-700"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Name"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Employee ID"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Email"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Role"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Shift"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Actions"))), /*#__PURE__*/React.createElement("tbody", {
    className: "bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700"
  }, filteredEmployees.length > 0 ? filteredEmployees.map(employee => {
    console.log("DEBUG: Rendering Edit button for employee:", employee.name); // NEW DEBUG LOG
    return /*#__PURE__*/React.createElement("tr", {
      key: employee.id,
      className: "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
    }, /*#__PURE__*/React.createElement("td", {
      className: "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white"
    }, employee.name), /*#__PURE__*/React.createElement("td", {
      className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
    }, employee.employee_id), /*#__PURE__*/React.createElement("td", {
      className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
    }, employee.email), /*#__PURE__*/React.createElement("td", {
      className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
    }, employee.role), /*#__PURE__*/React.createElement("td", {
      className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
    }, employee.shift_type), /*#__PURE__*/React.createElement("td", {
      className: "px-6 py-4 whitespace-nowrap text-sm font-medium"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => viewEmployeeProfile(employee) // New: View Profile button
      ,
      className: "text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-4 transition-colors duration-200"
    }, "View Profile"), /*#__PURE__*/React.createElement("button", {
      onClick: () => editEmployee(employee) // NEW: Edit Employee button
      ,
      className: "text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-4 transition-colors duration-200"
    }, "Edit"), /*#__PURE__*/React.createElement("button", {
      onClick: () => deleteEmployee(employee.id),
      className: "text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors duration-200"
    }, "Delete")));
  }) : /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "6",
    className: "px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400"
  }, "No employees found.")))))), activeTab === 'attendance' && /*#__PURE__*/React.createElement("section", {
    className: "bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-300"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "text-2xl font-semibold mb-6"
  }, "View Attendance Records"), /*#__PURE__*/React.createElement("div", {
    className: "mb-6"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setIsAddingAttendance(!isAddingAttendance);
      if (isAddingAttendance) {
        // If closing, reset edit state
        setEditingAttendanceId(null);
        setSelectedEmployeeId('');
        setSelectedDate(moment().format('YYYY-MM-DD'));
        setCheckInTime('');
        setCheckOutTime('');
      }
    },
    className: "px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 shadow-md flex items-center"
  }, /*#__PURE__*/React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    className: "h-5 w-5 mr-2",
    viewBox: "0 0 20 20",
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z",
    clipRule: "evenodd"
  })), isAddingAttendance ? 'Cancel' : 'Add New Attendance'), isAddingAttendance && /*#__PURE__*/React.createElement("div", {
    className: "mt-4 p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-medium mb-4"
  }, editingAttendanceId ? 'Edit Attendance Record' : 'New Attendance Record'), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-4"
  }, /*#__PURE__*/React.createElement("select", {
    className: "px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500",
    value: selectedEmployeeId,
    onChange: e => setSelectedEmployeeId(e.target.value),
    required: true
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Select Employee"), employees.map(employee => /*#__PURE__*/React.createElement("option", {
    key: employee.id,
    value: employee.id
  }, employee.name, " (", employee.employee_id, ")"))), /*#__PURE__*/React.createElement("input", {
    type: "date",
    className: "px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500",
    value: selectedDate,
    onChange: e => setSelectedDate(e.target.value),
    required: true
  }), /*#__PURE__*/React.createElement("input", {
    type: "time",
    placeholder: "Check-in Time",
    className: "px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500",
    value: checkInTime,
    onChange: e => setCheckInTime(e.target.value),
    required: true
  }), /*#__PURE__*/React.createElement("input", {
    type: "time",
    placeholder: "Check-out Time (Optional)",
    className: "px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500",
    value: checkOutTime,
    onChange: e => setCheckOutTime(e.target.value)
  })), /*#__PURE__*/React.createElement("button", {
    onClick: handleAttendanceSubmit,
    className: "mt-4 px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors duration-200 shadow-md"
  }, editingAttendanceId ? 'Update Record' : 'Add Record'))), /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto rounded-lg shadow-md"
  }, /*#__PURE__*/React.createElement("table", {
    className: "min-w-full divide-y divide-gray-200 dark:divide-gray-700"
  }, /*#__PURE__*/React.createElement("thead", {
    className: "bg-gray-50 dark:bg-gray-700"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Employee Name"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Date"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Check-in"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Check-out"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Late Time"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Working Hours"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Extra Hours"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Status"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Check-in Device"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Check-out Device"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Actions"))), /*#__PURE__*/React.createElement("tbody", {
    className: "bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700"
  }, displayAttendanceRecords.length > 0 ? displayAttendanceRecords.map(record => {
    return /*#__PURE__*/React.createElement("tr", {
      key: `${record.user_id}-${record.date}`,
      className: "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
    }, /*#__PURE__*/React.createElement("td", {
      className: "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white"
    }, record.name), /*#__PURE__*/React.createElement("td", {
      className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
    }, record.date), /*#__PURE__*/React.createElement("td", {
      className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
    }, record.check_in || 'N/A'), /*#__PURE__*/React.createElement("td", {
      className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
    }, record.check_out || 'N/A'), /*#__PURE__*/React.createElement("td", {
      className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
    }, record.late_time || '0 min'), /*#__PURE__*/React.createElement("td", {
      className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
    }, record.working_hours || '0 hrs'), /*#__PURE__*/React.createElement("td", {
      className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
    }, record.extra_hours || '0 hrs'), /*#__PURE__*/React.createElement("td", {
      className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
    }, record.status), /*#__PURE__*/React.createElement("td", {
      className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
    }, getDeviceType(record.check_in_device)), " ", /*#__PURE__*/React.createElement("td", {
      className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
    }, getDeviceType(record.check_out_device)), " ", /*#__PURE__*/React.createElement("td", {
      className: "px-6 py-4 whitespace-nowrap text-sm font-medium"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => editAttendance(record),
      className: "text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-4 transition-colors duration-200"
    }, "Edit"), /*#__PURE__*/React.createElement("button", {
      onClick: () => deleteAttendance(record.user_id, record.date),
      className: "text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors duration-200"
    }, "Mark Absent")));
  }) : /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "11",
    className: "px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400"
  }, "No attendance records found for this date or search.")))))), activeTab === 'leave-management' && /*#__PURE__*/React.createElement(AdminLeaveManagement, {
    showMessage: showMessage,
    apiBaseUrl: apiBaseUrl,
    accessToken: accessToken,
    authAxios: authAxios // Pass authAxios
  }), activeTab === 'holidays' && /*#__PURE__*/React.createElement(HolidayManagement, {
    showMessage: showMessage,
    apiBaseUrl: apiBaseUrl,
    accessToken: accessToken,
    authAxios: authAxios // Pass authAxios
  }), activeTab === 'weekly-offs' && /*#__PURE__*/React.createElement(WeeklyOffManagement, {
    showMessage: showMessage,
    apiBaseUrl: apiBaseUrl,
    accessToken: accessToken,
    authAxios: authAxios // Pass authAxios
  }), activeTab === 'notifications' && /*#__PURE__*/React.createElement(AdminNotifications, {
    showMessage: showMessage,
    apiBaseUrl: apiBaseUrl,
    accessToken: accessToken,
    authAxios: authAxios // Pass authAxios
  }), activeTab === 'analytics' && /*#__PURE__*/React.createElement(AdminAnalyticsReports, {
    showMessage: showMessage,
    apiBaseUrl: apiBaseUrl,
    accessToken: accessToken,
    authAxios: authAxios // Pass authAxios
    ,
    adminStats: adminStats // Pass stats to analytics component
    ,
    handleAnalyticsClick: handleAnalyticsClick // Pass the new click handler
  }), activeTab === 'correction-review' && /*#__PURE__*/React.createElement(AdminCorrectionReview, {
    showMessage: showMessage,
    apiBaseUrl: apiBaseUrl,
    accessToken: accessToken,
    authAxios: authAxios // Pass authAxios
  }), activeTab === 'profile-requests' && /*#__PURE__*/React.createElement("section", {
    className: `p-6 rounded-lg shadow-md transition-colors duration-300 ${darkMode ? 'bg-gray-800' : 'bg-white'}`
  }, /*#__PURE__*/React.createElement(AdminProfileRequests, {
    showMessage: showMessage,
    apiBaseUrl: apiBaseUrl,
    accessToken: accessToken,
    darkMode: darkMode
  }))), showExportModal && /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50"
  }, /*#__PURE__*/React.createElement("div", {
    className: `bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md ${darkMode ? 'text-white' : 'text-gray-800'}`
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-semibold mb-6"
  }, "Export Attendance Data"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "exportStartDate",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
  }, "Start Date"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    id: "exportStartDate",
    className: "w-full px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500",
    value: exportStartDate,
    onChange: e => setExportStartDate(e.target.value)
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "exportEndDate",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
  }, "End Date"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    id: "exportEndDate",
    className: "w-full px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500",
    value: exportEndDate,
    onChange: e => setExportEndDate(e.target.value)
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "exportEmployee",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
  }, "Select Employee (Optional)"), /*#__PURE__*/React.createElement("select", {
    id: "exportEmployee",
    className: "w-full px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500",
    value: exportEmployeeId,
    onChange: e => setExportEmployeeId(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "All Employees"), employees.map(employee => /*#__PURE__*/React.createElement("option", {
    key: employee.id,
    value: employee.employee_id
  }, employee.name, " (", employee.employee_id, ")"))))), /*#__PURE__*/React.createElement("div", {
    className: "mt-6 flex justify-end space-x-4"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowExportModal(false),
    className: "px-6 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
  }, "Cancel"), /*#__PURE__*/React.createElement("button", {
    onClick: exportAttendanceToCSV,
    className: "px-6 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-200"
  }, "Export")))), showProfileModal && viewingEmployeeProfile && editedProfileData && /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50"
  }, /*#__PURE__*/React.createElement("div", {
    className: `bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-sm sm:max-w-md h-[80vh] flex flex-col ${darkMode ? 'text-white' : 'text-gray-800'}`
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-2xl font-semibold mb-6"
  }, isEditingProfileInModal ? `Edit Profile: ${editedProfileData.name}` : `Employee Profile: ${viewingEmployeeProfile.name}`), /*#__PURE__*/React.createElement("div", {
    className: "space-y-4 overflow-y-auto flex-1 pr-2"
  }, " ", /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col items-center mb-4"
  }, /*#__PURE__*/React.createElement("img", {
    src: editedProfileData.profile_photo_url || "https://placehold.co/128x128/cccccc/000000?text=No+Image",
    alt: `${editedProfileData.name}'s profile`,
    className: "w-32 h-32 rounded-full object-cover border-4 border-blue-400",
    onError: e => {
      e.target.onerror = null;
      e.target.src = "https://placehold.co/128x128/cccccc/000000?text=No+Image";
    }
  }), isEditingProfileInModal && /*#__PURE__*/React.createElement("div", {
    className: "mt-4"
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "profilePhotoUpload",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
  }, "Upload New Profile Picture"), /*#__PURE__*/React.createElement("input", {
    type: "file",
    id: "profilePhotoUpload",
    accept: "image/*",
    className: "block w-full text-sm text-gray-900 dark:text-gray-300\r file:mr-4 file:py-2 file:px-4\r file:rounded-md file:border-0\r file:text-sm file:font-semibold\r file:bg-blue-50 file:text-blue-700\r hover:file:bg-blue-100",
    onChange: handleProfilePhotoChange
  }))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Name:"), isEditingProfileInModal ? /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "name",
    value: editedProfileData.name || '',
    onChange: handleProfileEditChange,
    className: "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
  }) : /*#__PURE__*/React.createElement("p", {
    className: "mt-1 text-gray-900 dark:text-white"
  }, viewingEmployeeProfile.name)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Employee ID:"), isEditingProfileInModal ? /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "employee_id",
    value: editedProfileData.employee_id || '',
    onChange: handleProfileEditChange,
    className: "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
  }) : /*#__PURE__*/React.createElement("p", {
    className: "mt-1 text-gray-900 dark:text-white"
  }, viewingEmployeeProfile.employee_id)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Email:"), isEditingProfileInModal ? /*#__PURE__*/React.createElement("input", {
    type: "email",
    name: "email",
    value: editedProfileData.email || '',
    onChange: handleProfileEditChange,
    className: "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
  }) : /*#__PURE__*/React.createElement("p", {
    className: "mt-1 text-gray-900 dark:text-white"
  }, viewingEmployeeProfile.email)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Role:"), isEditingProfileInModal ? /*#__PURE__*/React.createElement("select", {
    name: "role",
    value: editedProfileData.role || 'employee',
    onChange: handleProfileEditChange,
    className: "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
  }, /*#__PURE__*/React.createElement("option", {
    value: "employee"
  }, "Employee"), /*#__PURE__*/React.createElement("option", {
    value: "admin"
  }, "Admin")) : /*#__PURE__*/React.createElement("p", {
    className: "mt-1 text-gray-900 dark:text-white"
  }, viewingEmployeeProfile.role)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Shift Type:"), isEditingProfileInModal ? /*#__PURE__*/React.createElement("select", {
    name: "shift_type",
    value: editedProfileData.shift_type || 'day',
    onChange: handleProfileEditChange,
    className: "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
  }, /*#__PURE__*/React.createElement("option", {
    value: "day"
  }, "Day"), /*#__PURE__*/React.createElement("option", {
    value: "evening"
  }, "Evening")) : /*#__PURE__*/React.createElement("p", {
    className: "mt-1 text-gray-900 dark:text-white"
  }, viewingEmployeeProfile.shift_type)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Phone Number:"), isEditingProfileInModal ? /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "mobile_number" // Corrected name to mobile_number
    ,
    value: editedProfileData.mobile_number || '' // Corrected to mobile_number
    ,
    onChange: handleProfileEditChange,
    className: "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500",
    placeholder: "Enter phone number"
  }) : /*#__PURE__*/React.createElement("p", {
    className: "mt-1 text-gray-900 dark:text-white"
  }, viewingEmployeeProfile.mobile_number || 'N/A')), /*#__PURE__*/React.createElement("div", {
    className: "md:col-span-2"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Address:"), isEditingProfileInModal ? /*#__PURE__*/React.createElement("textarea", {
    name: "address",
    value: editedProfileData.address || '',
    onChange: handleProfileEditChange,
    rows: "2",
    className: "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500",
    placeholder: "Enter employee's address"
  }) : /*#__PURE__*/React.createElement("p", {
    className: "mt-1 text-gray-900 dark:text-white"
  }, viewingEmployeeProfile.address || 'N/A')), /*#__PURE__*/React.createElement("div", {
    className: "md:col-span-2"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "KYC Details:"), isEditingProfileInModal ? /*#__PURE__*/React.createElement("textarea", {
    name: "kyc_details",
    value: editedProfileData.kyc_details || '',
    onChange: handleProfileEditChange,
    rows: "3",
    className: "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500",
    placeholder: "Enter KYC details (e.g., Aadhaar number, PAN, etc.)"
  }) : /*#__PURE__*/React.createElement("p", {
    className: "mt-1 text-gray-900 dark:text-white"
  }, viewingEmployeeProfile.kyc_details || 'N/A')), /*#__PURE__*/React.createElement("div", {
    className: "md:col-span-2"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Personal Details:"), isEditingProfileInModal ? /*#__PURE__*/React.createElement("textarea", {
    name: "personal_details",
    value: editedProfileData.personal_details || '',
    onChange: handleProfileEditChange,
    rows: "3",
    className: "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500",
    placeholder: "Enter personal details (e.g., Date of Birth, Marital Status, Blood Group)"
  }) : /*#__PURE__*/React.createElement("p", {
    className: "mt-1 text-gray-900 dark:text-white"
  }, viewingEmployeeProfile.personal_details || 'N/A')), /*#__PURE__*/React.createElement("div", {
    className: "md:col-span-2"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Family History:"), isEditingProfileInModal ? /*#__PURE__*/React.createElement("textarea", {
    name: "family_history",
    value: editedProfileData.family_history || '',
    onChange: handleProfileEditChange,
    rows: "3",
    className: "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500",
    placeholder: "Enter family details (e.g., Father's Name, Mother's Name, Spouse/Children details)"
  }) : /*#__PURE__*/React.createElement("p", {
    className: "mt-1 text-gray-900 dark:text-white"
  }, viewingEmployeeProfile.family_history || 'N/A'))), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("span", {
    className: "font-medium"
  }, "Joined On:"), " ", moment(viewingEmployeeProfile.created_at).format('YYYY-MM-DD'))), /*#__PURE__*/React.createElement("div", {
    className: "mt-6 flex justify-end space-x-4"
  }, isEditingProfileInModal ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    onClick: () => setIsEditingProfileInModal(false) // Cancel edit, revert to view
    ,
    className: "px-6 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
  }, "Cancel"), /*#__PURE__*/React.createElement("button", {
    onClick: handleSaveProfileChanges,
    className: "px-6 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors duration-200"
  }, "Save Changes")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    onClick: () => setIsEditingProfileInModal(true) // Switch to edit mode
    ,
    className: "px-6 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-200"
  }, "Edit Profile"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowProfileModal(false),
    className: "px-6 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
  }, "Close"))))));
};
window.AdminDashboard = AdminDashboard;