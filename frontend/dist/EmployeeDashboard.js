// EmployeeDashboard.jsx - Designed for Babel script environment (no import/export)

// IMPORTANT: Set default timezone for Moment.js to Asia/Kolkata (IST)
// This will make all moment() calls interpret times in IST context.
// Ensure moment-timezone-with-data.js is loaded via <script> tag before this file.
moment.tz.setDefault('Asia/Kolkata');
console.log(`[GLOBAL DEBUG] Script loaded. Current Moment (IST): ${moment().format('YYYY-MM-DD HH:mm:ss.SSS')}`);

// Assume React, ReactDOM, moment, and axios are globally available via <script> tags.
// Example:
// <script src="https://unpkg.com/react@18/umd/react-dom.development.js"></script>
// <script src="https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js"></script>
// <script src="https://cdnjs.cloudflare.com/ajax/libs/moment-timezone/0.5.34/moment-timezone-with-data.min.js"></script>
// <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>

const EmployeeDashboard = ({
  user,
  handleLogout,
  darkMode,
  toggleDarkMode,
  showMessage,
  apiBaseUrl,
  accessToken
}) => {
  // State for overall loading and active tab
  const [loading, setLoading] = React.useState(true); // Overall loading for the dashboard
  const [activeTab, setActiveTab] = React.useState('dashboard'); // 'dashboard', 'apply-leave', 'my-leaves', 'correction', 'profile', 'notifications', 'leave-balances'

  // State for attendance data
  const [attendanceToday, setAttendanceToday] = React.useState(null);
  const [loadingAttendanceToday, setLoadingAttendanceToday] = React.useState(true);
  const [attendanceRecords, setAttendanceRecords] = React.useState([]); // For monthly history
  const [loadingAttendanceHistory, setLoadingAttendanceHistory] = React.useState(true);
  const [selectedMonth, setSelectedMonth] = React.useState(moment().month() + 1); // 1-indexed
  const [selectedYear, setSelectedYear] = React.useState(moment().year());

  // State for analytics data
  const [analyticsData, setAnalyticsData] = React.useState(null); // For monthly analytics
  const [loadingAnalyticsData, setLoadingAnalyticsData] = React.useState(true); // New loading state for analytics

  // State for notifications
  const [unreadNotificationsCount, setUnreadNotificationsCount] = React.useState(0); // New state for unread notifications
  const [allNotifications, setAllNotifications] = React.useState([]); // New state to hold all notifications

  // State for leave balances
  const [leaveBalances, setLeaveBalances] = React.useState([]); // New state for leave balances

  // Axios instance with token for authenticated requests
  // Assumes 'axios' is globally available
  const authAxios = axios.create({
    baseURL: apiBaseUrl,
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  // Function to fetch today's attendance
  const fetchAttendanceToday = async () => {
    setLoadingAttendanceToday(true);
    try {
      // Use moment() without arguments, which will now default to IST due to setDefault
      const todayIST = moment().format('YYYY-MM-DD'); // This date is for the query parameter
      console.log(`[FETCH DEBUG] fetchAttendanceToday: Requesting attendance for date: ${todayIST}`);
      const response = await authAxios.get(`${apiBaseUrl}/api/attendance`, {
        params: {
          date: todayIST
        }
      });
      // Ensure status is capitalized for consistency with getStatusClasses
      const data = response.data;
      if (data && data.status) {
        data.status = data.status.toUpperCase();
      }
      setAttendanceToday(data);
      console.log(`[FETCH DEBUG] fetchAttendanceToday: Received today's attendance:`, data);
      if (data && data.check_in) {
        console.log(`[FETCH DEBUG]   attendanceToday.check_in (raw): ${data.check_in}`);
        // CORRECTED: Parse without format string, then format directly (will be in IST due to setDefault)
        console.log(`[FETCH DEBUG]   Parsed check_in (moment object, IST):`, moment(data.check_in));
        console.log(`[FETCH DEBUG]   Formatted check_in (IST):`, moment(data.check_in).format('hh:mm A'));
      }
    } catch (error) {
      console.error(`[FETCH ERROR] Error fetching today's attendance:`, error.response?.data?.message || error.message);
      setAttendanceToday(null); // Clear attendance if there's an error
    } finally {
      setLoadingAttendanceToday(false);
    }
  };

  // Function to fetch monthly attendance history
  const fetchAttendanceHistory = async () => {
    setLoadingAttendanceHistory(true);
    try {
      console.log(`[FETCH DEBUG] fetchAttendanceHistory: Requesting history for month: ${selectedMonth}, year: ${selectedYear}`);
      const response = await authAxios.get(`${apiBaseUrl}/api/attendance`, {
        params: {
          month: selectedMonth,
          year: selectedYear
        }
      });
      // Ensure all statuses in history are capitalized for consistency
      const formattedRecords = response.data.map(record => {
        const updatedRecord = {
          ...record,
          status: record.status.toUpperCase()
        };
        console.log(`[FETCH DEBUG]   Record for date ${updatedRecord.date}:`, updatedRecord);
        if (updatedRecord.check_in) {
          console.log(`[FETCH DEBUG]     record.check_in (raw) for ${updatedRecord.date}: ${updatedRecord.check_in}`);
          // CORRECTED: Parse without format string, then format directly (will be in IST due to setDefault)
          console.log(`[FETCH DEBUG]     Parsed record.check_in (moment object, IST):`, moment(updatedRecord.check_in));
          console.log(`[FETCH DEBUG]     Formatted record.check_in (IST):`, moment(updatedRecord.check_in).format('hh:mm A'));
        }
        return updatedRecord;
      });
      setAttendanceRecords(formattedRecords);
      console.log(`[FETCH DEBUG] fetchAttendanceHistory: Received attendance history:`, formattedRecords);
    } catch (error) {
      console.error(`[FETCH ERROR] Error fetching attendance history:`, error.response?.data?.message || error.message);
      setAttendanceRecords([]); // Clear records on error
    } finally {
      setLoadingAttendanceHistory(false);
    }
  };

  // Function to fetch monthly analytics
  const fetchMonthlyAnalytics = async () => {
    setLoadingAnalyticsData(true); // Set loading true before fetching
    try {
      console.log(`[FETCH DEBUG] fetchMonthlyAnalytics: Requesting analytics for month: ${selectedMonth}, year: ${selectedYear}`);
      const analyticsResponse = await authAxios.get(`${apiBaseUrl}/api/analytics`, {
        params: {
          month: selectedMonth,
          year: selectedYear
        }
      });
      // --- IMPORTANT DEBUG: Log the raw data received for analytics ---
      console.log(`[FETCH DEBUG] fetchMonthlyAnalytics: Raw API response data:`, analyticsResponse.data);
      setAnalyticsData(analyticsResponse.data || null);
      // --- IMPORTANT DEBUG: Log the state *after* it's set ---
      console.log(`[FETCH DEBUG] fetchMonthlyAnalytics: analyticsData state after set:`, analyticsResponse.data);
    } catch (error) {
      console.error(`[FETCH ERROR] Error fetching monthly analytics:`, error.response?.data?.message || error.message);
      setAnalyticsData(null); // Set to null on error
    } finally {
      setLoadingAnalyticsData(false); // Set loading false after fetch completes (success or error)
    }
  };

  // Function to fetch unread notifications count
  const fetchAllNotificationsAndCount = async () => {
    try {
      // Fetch ALL notifications for the user
      const response = await authAxios.get(`${apiBaseUrl}/api/notifications/my`);
      setAllNotifications(response.data); // Store the full list
      // Calculate unread count from the full list
      const currentUnreadCount = response.data.filter(n => !n.is_read).length;
      setUnreadNotificationsCount(currentUnreadCount); // Update the unread count
    } catch (error) {
      console.error("Error fetching notifications or count:", error.response?.data?.message || error.message);
      setAllNotifications([]); // Clear on error
      setUnreadNotificationsCount(0); // Set count to 0 on error
    }
  };

  // Function to fetch leave balances
  const fetchLeaveBalances = async () => {
    try {
      const response = await authAxios.get(`${apiBaseUrl}/api/leaves/my-balances`);
      setLeaveBalances(response.data);
    } catch (error) {
      console.error("Error fetching leave balances:", error.response?.data?.message || error.message);
      setLeaveBalances([]);
    }
  };

  // Initial fetch for all dashboard data
  // This useEffect runs on component mount and when user/accessToken change
  React.useEffect(() => {
    const initialFetch = async () => {
      if (!user?.id || !accessToken) {
        setLoading(false);
        return;
      }
      setLoading(true);
      console.log(`[EFFECT DEBUG] useEffect: Initial data fetch triggered.`);
      try {
        // Fetch all data concurrently
        await Promise.all([fetchAttendanceToday(), fetchAllNotificationsAndCount(), fetchLeaveBalances()]);
      } catch (error) {
        console.error(`[EFFECT ERROR] Initial dashboard data fetch failed:`, error);
      } finally {
        setLoading(false);
      }
    };
    initialFetch();
  }, [user, accessToken, apiBaseUrl]); // Removed selectedMonth, selectedYear, activeTab from here

  // Separate useEffect for monthly data (analytics and history)
  // This runs when selectedMonth or selectedYear changes, or when activeTab becomes 'dashboard'
  React.useEffect(() => {
    if (activeTab === 'dashboard' && user?.id && accessToken) {
      console.log(`[EFFECT DEBUG] useEffect: Monthly data fetch triggered for month: ${selectedMonth}, year: ${selectedYear}`);
      fetchMonthlyAnalytics();
      fetchAttendanceHistory();
    }
  }, [selectedMonth, selectedYear, activeTab, user, accessToken, apiBaseUrl]);

  // Derived state for check-in/out buttons based on attendanceToday
  // CORRECTED: Parse check_in/out without format string for correct UTC ISO parsing
  const hasCheckedInToday = attendanceToday && typeof attendanceToday.check_in === 'string' && moment(attendanceToday.check_in).isValid(); // Removed 'HH:mm:ss' format hint

  const canCheckOut = hasCheckedInToday && (!attendanceToday.check_out || typeof attendanceToday.check_out === 'string' && !moment(attendanceToday.check_out).isValid()); // Removed 'HH:mm:ss' format hint

  // Handle check-in
  const handleCheckIn = async () => {
    if (!user?.id) {
      showMessage('User not authenticated.', 'error');
      return;
    }
    try {
      // Get user's current location
      navigator.geolocation.getCurrentPosition(async position => {
        const {
          latitude,
          longitude
        } = position.coords;
        console.log(`[ACTION DEBUG] handleCheckIn: Attempting check-in with lat: ${latitude}, long: ${longitude}`);
        // Assuming authAxios is available globally or passed down
        await authAxios.post(`${apiBaseUrl}/api/attendance/check-in`, {
          latitude,
          longitude
        });
        showMessage('Checked in successfully!', 'success');

        // Re-fetch to confirm and get actual calculated values
        await fetchAttendanceToday();
        await fetchAttendanceHistory(); // Refresh history
        await fetchMonthlyAnalytics(); // Refresh analytics
        console.log(`[ACTION DEBUG] handleCheckIn: Check-in successful, data re-fetched.`);
      }, error => {
        console.error(`[ACTION ERROR] Geolocation error during check-in:`, error);
        showMessage('Geolocation failed. Please enable location services.', 'error');
      });
    } catch (error) {
      console.error(`[ACTION ERROR] Check-in error:`, error.response?.data?.message || error.message);
      showMessage(error.response?.data?.message || 'Check-in failed.', 'error');
      await fetchAttendanceToday(); // Re-fetch to revert if optimistic update was wrong or for error state
    }
  };

  // Handle check-out
  const handleCheckOut = async () => {
    if (!user?.id) {
      showMessage('User not authenticated.', 'error');
      return;
    }
    try {
      // Get user's current location
      navigator.geolocation.getCurrentPosition(async position => {
        const {
          latitude,
          longitude
        } = position.coords;
        console.log(`[ACTION DEBUG] handleCheckOut: Attempting check-out with lat: ${latitude}, long: ${longitude}`);
        await authAxios.post(`${apiBaseUrl}/api/attendance/check-out`, {
          latitude,
          longitude
        });
        showMessage('Checked out successfully!', 'success');

        // Re-fetch to confirm and get actual calculated values
        await fetchAttendanceToday();
        await fetchAttendanceHistory(); // Refresh history
        await fetchMonthlyAnalytics(); // Refresh analytics
        console.log(`[ACTION DEBUG] handleCheckOut: Check-out successful, data re-fetched.`);
      }, error => {
        console.error(`[ACTION ERROR] Geolocation error during check-out:`, error);
        showMessage('Geolocation failed. Please enable location services.', 'error');
      });
    } catch (error) {
      console.error(`[ACTION ERROR] Check-out error:`, error.response?.data?.message || error.message);
      showMessage(error.response?.data?.message || 'Check-out failed.', 'error');
      await fetchAttendanceToday(); // Re-fetch to revert if optimistic update was wrong or for error state
    }
  };

  // Handle leave application submission
  const handleLeaveApplication = async leaveData => {
    try {
      await authAxios.post(`${apiBaseUrl}/api/leaves/apply`, leaveData);
      showMessage('Leave application submitted successfully!', 'success');
      // Re-fetch my leaves and balances after application
      setActiveTab('my-leaves'); // Switch to my leaves tab
      await fetchAttendanceToday(); // Check if today's attendance status changes due to leave
      await fetchAllNotificationsAndCount(); // New notification might be generated
      await fetchLeaveBalances(); // Refresh leave balances after applying
      await fetchMonthlyAnalytics(); // Leave application affects analytics
    } catch (error) {
      console.error("Error applying for leave:", error.response?.data?.message || error.message);
      showMessage(`Failed to submit leave application: ${error.response?.data?.message || error.message}`, 'error');
    }
  };

  // Handle leave cancellation request
  const handleLeaveCancellationRequest = async applicationId => {
    // IMPORTANT: Use a custom modal or component for confirmation, not window.confirm
    // For now, keeping window.confirm as per previous code, but note the instruction.
    if (!window.confirm('Are you sure you want to request cancellation for this leave?')) {
      return;
    }
    try {
      await authAxios.put(`${apiBaseUrl}/api/leaves/${applicationId}/request-cancellation`);
      showMessage('Leave cancellation request submitted!', 'success');
      // MyLeaves component will re-fetch on its own
      await fetchAttendanceToday(); // Check if today's attendance status changes
      await fetchAllNotificationsAndCount(); // New notification might be generated
      await fetchLeaveBalances(); // Refresh leave balances after cancellation request
      await fetchMonthlyAnalytics(); // Leave cancellation affects analytics
    } catch (error) {
      console.error("Error requesting cancellation:", error.response?.data?.message || error.message);
      showMessage(`Failed to request cancellation: ${error.response?.data?.message || error.message}`, 'error');
    }
  };

  // Handle attendance correction request
  const handleCorrectionRequest = async correctionData => {
    try {
      await authAxios.post(`${apiBaseUrl}/api/attendance/correction-request`, correctionData);
      showMessage('Attendance correction request submitted!', 'success');
      // Optionally, refresh attendance history or switch tab
      await fetchAttendanceHistory();
      await fetchAttendanceToday(); // Check if today's attendance status changes
      await fetchAllNotificationsAndCount(); // New notification might be generated
      await fetchMonthlyAnalytics(); // Correction affects analytics
      setActiveTab('dashboard'); // Go back to dashboard to see updated attendance
    } catch (error) {
      console.error("Error submitting correction:", error.response?.data?.message || error.message);
      showMessage(`Failed to submit correction: ${error.response?.data?.message || error.message}`, 'error');
    }
  };

  // Generate month and year options for dropdowns
  const monthOptions = moment.months().map((monthName, index) => ({
    value: index + 1,
    // Moment months are 0-indexed, but backend expects 1-indexed
    label: monthName
  }));
  const currentYear = moment().year();
  const yearOptions = Array.from({
    length: 5
  }, (_, i) => currentYear - 2 + i); // Current year +/- 2

  // Function to get status color classes
  const getStatusClasses = status => {
    switch (status) {
      case 'PRESENT':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'ON LEAVE':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'HALF DAY LEAVE':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
      case 'HOLIDAY':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'WEEKLY OFF':
        return 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
      case 'ABSENT':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'LATE':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'LOP':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'PRESENT BY CORRECTION':
        return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200';
      case 'LEAVE CANCELLATION PENDING':
        return 'bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  // Render loading state while data is being fetched
  if (loading) {
    return /*#__PURE__*/React.createElement("div", {
      className: `flex flex-1 items-center justify-center min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center space-x-2"
    }, /*#__PURE__*/React.createElement("div", {
      className: "w-4 h-4 rounded-full animate-pulse bg-blue-600"
    }), /*#__PURE__*/React.createElement("div", {
      className: "w-4 h-4 rounded-full animate-pulse bg-blue-600"
    }), /*#__PURE__*/React.createElement("div", {
      className: "w-4 h-4 rounded-full animate-pulse bg-blue-600"
    }), /*#__PURE__*/React.createElement("p", null, "Loading employee dashboard data...")));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: `flex flex-1 ${darkMode ? 'bg-gradient-to-br from-gray-900 to-gray-950 text-white' : 'bg-gradient-to-br from-blue-50 to-indigo-100 text-gray-900'}`
  }, /*#__PURE__*/React.createElement("aside", {
    className: `w-64 p-6 border-r ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-lg transition-colors duration-300`
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-8"
  }, /*#__PURE__*/React.createElement("h1", {
    className: `text-2xl font-bold ${darkMode ? 'text-purple-400' : 'text-indigo-600'}`
  }, "Employee HRMS"), /*#__PURE__*/React.createElement("button", {
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
  })))), /*#__PURE__*/React.createElement("div", {
    className: `mb-8 p-4 rounded-lg shadow-inner ${darkMode ? 'bg-gray-700' : 'bg-indigo-50'}`
  }, /*#__PURE__*/React.createElement("p", {
    className: `text-lg font-bold ${darkMode ? 'text-blue-300' : 'text-indigo-700'}`
  }, user?.name || 'Employee'), /*#__PURE__*/React.createElement("p", {
    className: `text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`
  }, user?.email), /*#__PURE__*/React.createElement("p", {
    className: `text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`
  }, "ID: ", user?.employee_id || user?.id)), /*#__PURE__*/React.createElement("nav", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setActiveTab('dashboard'),
    className: `w-full text-left py-2 px-4 rounded-md font-medium transition-colors duration-200 ${activeTab === 'dashboard' ? darkMode ? 'bg-purple-600 text-white shadow-md' : 'bg-indigo-600 text-white shadow-md' : darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-200'}`
  }, "Dashboard"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setActiveTab('apply-leave'),
    className: `w-full text-left py-2 px-4 rounded-md font-medium transition-colors duration-200 ${activeTab === 'apply-leave' ? darkMode ? 'bg-purple-600 text-white shadow-md' : 'bg-indigo-600 text-white shadow-md' : darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-200'}`
  }, "Apply for Leave"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setActiveTab('my-leaves'),
    className: `w-full text-left py-2 px-4 rounded-md font-medium transition-colors duration-200 ${activeTab === 'my-leaves' ? darkMode ? 'bg-purple-600 text-white shadow-md' : 'bg-indigo-600 text-white shadow-md' : darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-200'}`
  }, "My Leave Applications"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setActiveTab('leave-balances'),
    className: `w-full text-left py-2 px-4 rounded-md font-medium transition-colors duration-200 ${activeTab === 'leave-balances' ? darkMode ? 'bg-purple-600 text-white shadow-md' : 'bg-indigo-600 text-white shadow-md' : darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-200'}`
  }, "Leave Balances"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setActiveTab('correction'),
    className: `w-full text-left py-2 px-4 rounded-md font-medium transition-colors duration-200 ${activeTab === 'correction' ? darkMode ? 'bg-purple-600 text-white shadow-md' : 'bg-indigo-600 text-white shadow-md' : darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-200'}`
  }, "Attendance Correction"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setActiveTab('notifications'),
    className: `w-full text-left py-2 px-4 rounded-md font-medium transition-colors duration-200 ${activeTab === 'notifications' ? darkMode ? 'bg-purple-600 text-white shadow-md' : 'bg-indigo-600 text-white shadow-md' : darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-200'}`
  }, "Notifications", unreadNotificationsCount > 0 && /*#__PURE__*/React.createElement("span", {
    className: "ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full"
  }, unreadNotificationsCount)), /*#__PURE__*/React.createElement("button", {
    onClick: () => setActiveTab('profile'),
    className: `w-full text-left py-2 px-4 rounded-md font-medium transition-colors duration-200 ${activeTab === 'profile' ? darkMode ? 'bg-purple-600 text-white shadow-md' : 'bg-indigo-600 text-white shadow-md' : darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-200'}`
  }, "Profile Settings")), /*#__PURE__*/React.createElement("div", {
    className: "mt-8 pt-8 border-t border-gray-200 dark:border-gray-700"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: handleLogout,
    className: "mt-6 w-full py-2 px-4 rounded-md bg-red-600 text-white font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-800 transition-colors duration-200"
  }, "Logout"))), /*#__PURE__*/React.createElement("main", {
    className: "flex-1 p-8 overflow-auto"
  }, /*#__PURE__*/React.createElement("h1", {
    className: `text-4xl font-extrabold mb-8 ${darkMode ? 'text-white' : 'text-gray-900'}`
  }, "Welcome, ", /*#__PURE__*/React.createElement("span", {
    className: `${darkMode ? 'text-purple-400' : 'text-indigo-600'}`
  }, user?.name || 'Employee', "!")), activeTab === 'dashboard' && /*#__PURE__*/React.createElement("section", {
    className: "space-y-8"
  }, unreadNotificationsCount > 0 && /*#__PURE__*/React.createElement("div", {
    className: "bg-orange-100 dark:bg-orange-900 p-4 rounded-lg shadow-md flex items-center justify-between transition-colors duration-300"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center"
  }, /*#__PURE__*/React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    className: "h-6 w-6 text-orange-600 dark:text-orange-300 mr-3",
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M15 17H8l-1.403 1.403A.999.999 0 014 18V5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2h-1.597l-1.403 1.403z"
  })), /*#__PURE__*/React.createElement("p", {
    className: "text-orange-800 dark:text-orange-200 font-semibold"
  }, "You have ", unreadNotificationsCount, " unread notification", unreadNotificationsCount > 1 ? 's' : '', "!")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setActiveTab('notifications'),
    className: "px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors duration-200 shadow-md"
  }, "View Notifications")), /*#__PURE__*/React.createElement("div", {
    className: `p-6 rounded-lg shadow-md transition-colors duration-300 ${darkMode ? 'bg-gray-800' : 'bg-white'}`
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-semibold mb-4"
  }, "Today's Attendance (", moment().format('YYYY-MM-DD'), ")"), loadingAttendanceToday ? /*#__PURE__*/React.createElement("p", {
    className: "text-gray-500 dark:text-gray-400"
  }, "Loading today's attendance...") : /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: `p-3 rounded-full ${getStatusClasses(attendanceToday?.status || 'ABSENT')}`
  }, /*#__PURE__*/React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    className: "h-6 w-6",
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor"
  }, attendanceToday?.status === 'PRESENT' || attendanceToday?.status === 'PRESENT BY CORRECTION' ? /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
  }) : /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    className: "text-lg font-bold"
  }, attendanceToday?.status || 'UNKNOWN'), /*#__PURE__*/React.createElement("p", {
    className: `text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`
  }, "Check-in: ", attendanceToday?.check_in ? moment(attendanceToday.check_in).format('hh:mm A') : 'N/A', " | Check-out: ", attendanceToday?.check_out ? moment(attendanceToday.check_out).format('hh:mm A') : 'N/A'), attendanceToday?.late_time > 0 && /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-red-500 dark:text-red-400"
  }, "Late by: ", attendanceToday.late_time, " mins"), attendanceToday?.working_hours > 0 && /*#__PURE__*/React.createElement("p", {
    className: `text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`
  }, "Working Hours: ", attendanceToday.working_hours, " hrs"))), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col space-y-2 justify-center"
  }, !hasCheckedInToday && /*#__PURE__*/React.createElement("button", {
    onClick: handleCheckIn
    // Disable if status is NOT_APPLICABLE (e.g., holiday, weekly off, on leave)
    ,
    disabled: ['ON LEAVE', 'HALF DAY LEAVE', 'HOLIDAY', 'WEEKLY OFF'].includes(attendanceToday?.status),
    className: `px-6 py-3 rounded-md shadow-md transition-colors duration-200 flex items-center justify-center
                                                    ${['ON LEAVE', 'HALF DAY LEAVE', 'HOLIDAY', 'WEEKLY OFF'].includes(attendanceToday?.status) ? 'bg-gray-400 cursor-not-allowed' : darkMode ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`
  }, /*#__PURE__*/React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    className: "h-5 w-5 mr-2",
    viewBox: "0 0 20 20",
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z",
    clipRule: "evenodd"
  })), "Check In"), hasCheckedInToday && canCheckOut && /*#__PURE__*/React.createElement("button", {
    onClick: handleCheckOut,
    className: "px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200 shadow-md flex items-center justify-center"
  }, /*#__PURE__*/React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    className: "h-5 w-5 mr-2",
    viewBox: "0 0 20 20",
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z",
    clipRule: "evenodd"
  })), "Check Out")))), /*#__PURE__*/React.createElement("div", {
    className: `p-6 rounded-lg shadow-md transition-colors duration-300 ${darkMode ? 'bg-gray-800' : 'bg-white'}`
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-semibold mb-4"
  }, "Monthly Analytics Summary (", moment().month(selectedMonth - 1).format('MMMM'), " ", selectedYear, ")"), /*#__PURE__*/React.createElement("div", {
    className: "flex space-x-4 mb-6"
  }, /*#__PURE__*/React.createElement("select", {
    className: `px-4 py-2 rounded-md border ${darkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'} focus:ring-blue-500 focus:border-blue-500`,
    value: selectedMonth,
    onChange: e => setSelectedMonth(parseInt(e.target.value))
  }, monthOptions.map(option => /*#__PURE__*/React.createElement("option", {
    key: option.value,
    value: option.value
  }, option.label))), /*#__PURE__*/React.createElement("select", {
    className: `px-4 py-2 rounded-md border ${darkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'} focus:outline-none focus:ring-blue-500 focus:border-blue-500`,
    value: selectedYear,
    onChange: e => setSelectedYear(parseInt(e.target.value))
  }, yearOptions.map(year => /*#__PURE__*/React.createElement("option", {
    key: year,
    value: year
  }, year)))), loadingAnalyticsData ? /*#__PURE__*/React.createElement("p", {
    className: `text-gray-500 ${darkMode ? 'dark:text-gray-400' : ''}`
  }, "Loading monthly analytics...") : analyticsData ? /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-green-100 dark:bg-green-900 p-4 rounded-lg shadow-sm text-green-800 dark:text-green-200"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-sm font-medium"
  }, "Present Days"), /*#__PURE__*/React.createElement("p", {
    className: "text-2xl font-bold"
  }, analyticsData.presentDays || 0)), /*#__PURE__*/React.createElement("div", {
    className: "bg-orange-100 dark:bg-orange-900 p-4 rounded-lg shadow-sm text-orange-800 dark:text-orange-200"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-sm font-medium"
  }, "Late Days"), /*#__PURE__*/React.createElement("p", {
    className: "text-2xl font-bold"
  }, analyticsData.lateDays || 0)), /*#__PURE__*/React.createElement("div", {
    className: "bg-red-100 dark:bg-red-900 p-4 rounded-lg shadow-sm text-red-800 dark:text-red-200"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-sm font-medium"
  }, "Absent Days"), /*#__PURE__*/React.createElement("p", {
    className: "text-2xl font-bold"
  }, analyticsData.absentDays || 0)), /*#__PURE__*/React.createElement("div", {
    className: "bg-purple-100 dark:bg-purple-900 p-4 rounded-lg shadow-sm text-purple-800 dark:text-purple-200"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-sm font-medium"
  }, "Leave Days"), /*#__PURE__*/React.createElement("p", {
    className: "text-2xl font-bold"
  }, analyticsData.leaveDays || 0)), /*#__PURE__*/React.createElement("div", {
    className: "bg-blue-100 dark:bg-blue-900 p-4 rounded-lg shadow-sm text-blue-800 dark:text-blue-200"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-sm font-medium"
  }, "Holidays"), /*#__PURE__*/React.createElement("p", {
    className: "text-2xl font-bold"
  }, analyticsData.holidays || 0)), /*#__PURE__*/React.createElement("div", {
    className: "bg-indigo-100 dark:bg-indigo-900 p-4 rounded-lg shadow-sm text-indigo-800 dark:text-indigo-200"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-sm font-medium"
  }, "Weekly Offs"), /*#__PURE__*/React.createElement("p", {
    className: "text-2xl font-bold"
  }, analyticsData.weeklyOffs || 0)), /*#__PURE__*/React.createElement("div", {
    className: "bg-pink-100 dark:bg-pink-900 p-4 rounded-lg shadow-sm text-pink-800 dark:text-pink-200"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-sm font-medium"
  }, "LOP Days"), /*#__PURE__*/React.createElement("p", {
    className: "text-2xl font-bold"
  }, analyticsData.lopDays || 0)), /*#__PURE__*/React.createElement("div", {
    className: "bg-yellow-100 dark:bg-yellow-900 p-4 rounded-lg shadow-sm text-yellow-800 dark:text-yellow-200"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-sm font-medium"
  }, "Total Working Hours"), /*#__PURE__*/React.createElement("p", {
    className: "text-2xl font-bold"
  }, analyticsData.totalWorkingHours ? `${analyticsData.totalWorkingHours.toFixed(2)} hrs` : '0 hrs'))) : /*#__PURE__*/React.createElement("p", {
    className: `text-gray-500 ${darkMode ? 'dark:text-gray-400' : ''}`
  }, "No analytics data available for this period.")), /*#__PURE__*/React.createElement("div", {
    className: `p-6 rounded-lg shadow-md transition-colors duration-300 ${darkMode ? 'bg-gray-800' : 'bg-white'}`
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-semibold mb-4"
  }, "Monthly Attendance History"), /*#__PURE__*/React.createElement("div", {
    className: "flex space-x-4 mb-6"
  }, /*#__PURE__*/React.createElement("select", {
    className: `px-4 py-2 rounded-md border ${darkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'} focus:ring-blue-500 focus:border-blue-500`,
    value: selectedMonth,
    onChange: e => setSelectedMonth(parseInt(e.target.value))
  }, monthOptions.map(option => /*#__PURE__*/React.createElement("option", {
    key: option.value,
    value: option.value
  }, option.label))), /*#__PURE__*/React.createElement("select", {
    className: `px-4 py-2 rounded-md border ${darkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'} focus:outline-none focus:ring-blue-500 focus:border-blue-500`,
    value: selectedYear,
    onChange: e => setSelectedYear(parseInt(e.target.value))
  }, yearOptions.map(year => /*#__PURE__*/React.createElement("option", {
    key: year,
    value: year
  }, year)))), loadingAttendanceHistory ? /*#__PURE__*/React.createElement("p", {
    className: `text-gray-500 ${darkMode ? 'dark:text-gray-400' : ''}`
  }, "Loading attendance history...") : /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto rounded-lg shadow-md"
  }, /*#__PURE__*/React.createElement("table", {
    className: `min-w-full divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}`
  }, /*#__PURE__*/React.createElement("thead", {
    className: `${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: `px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`
  }, "Date"), /*#__PURE__*/React.createElement("th", {
    className: `px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`
  }, "Day"), /*#__PURE__*/React.createElement("th", {
    className: `px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`
  }, "Status"), /*#__PURE__*/React.createElement("th", {
    className: `px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`
  }, "Check-in"), /*#__PURE__*/React.createElement("th", {
    className: `px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`
  }, "Check-out"), /*#__PURE__*/React.createElement("th", {
    className: `px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`
  }, "Working Hours"), /*#__PURE__*/React.createElement("th", {
    className: `px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`
  }, "Late (mins)"))), /*#__PURE__*/React.createElement("tbody", {
    className: `${darkMode ? 'bg-gray-800 divide-gray-700' : 'bg-white divide-gray-200'} divide-y`
  }, attendanceRecords.length > 0 ? attendanceRecords.sort((a, b) => moment(a.date).diff(moment(b.date))).map(record => /*#__PURE__*/React.createElement("tr", {
    key: record.date,
    className: `${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} transition-colors duration-150`
  }, /*#__PURE__*/React.createElement("td", {
    className: `px-6 py-4 whitespace-nowrap text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`
  }, moment(record.date).format('YYYY-MM-DD')), /*#__PURE__*/React.createElement("td", {
    className: `px-6 py-4 whitespace-nowrap text-sm ${darkMode ? 'text-gray-300' : 'text-gray-500'}`
  }, record.day), /*#__PURE__*/React.createElement("td", {
    className: `px-6 py-4 whitespace-nowrap text-sm font-semibold rounded-md ${getStatusClasses(record.status)}`
  }, record.status), /*#__PURE__*/React.createElement("td", {
    className: `px-6 py-4 whitespace-nowrap text-sm ${darkMode ? 'text-gray-300' : 'text-gray-500'}`
  }, record.check_in ? moment(record.check_in).format('hh:mm A') : 'N/A'), /*#__PURE__*/React.createElement("td", {
    className: `px-6 py-4 whitespace-nowrap text-sm ${darkMode ? 'text-gray-300' : 'text-gray-500'}`
  }, record.check_out ? moment(record.check_out).format('hh:mm A') : 'N/A'), /*#__PURE__*/React.createElement("td", {
    className: `px-6 py-4 whitespace-nowrap text-sm ${darkMode ? 'text-gray-300' : 'text-gray-500'}`
  }, record.working_hours ? `${record.working_hours} hrs` : '0 hrs'), /*#__PURE__*/React.createElement("td", {
    className: `px-6 py-4 whitespace-nowrap text-sm ${darkMode ? 'text-gray-300' : 'text-gray-500'}`
  }, record.late_time ? `${record.late_time} mins` : '0 mins'))) : /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "7",
    className: `px-6 py-4 text-center text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`
  }, "No attendance records found for this month."))))))), activeTab === 'apply-leave' && /*#__PURE__*/React.createElement("section", {
    className: `p-6 rounded-lg shadow-md transition-colors duration-300 ${darkMode ? 'bg-gray-800' : 'bg-white'}`
  }, /*#__PURE__*/React.createElement("h2", {
    className: "text-3xl font-bold mb-8"
  }, "Apply for Leave"), /*#__PURE__*/React.createElement(LeaveApplicationForm, {
    showMessage: showMessage,
    apiBaseUrl: apiBaseUrl,
    accessToken: accessToken,
    onSubmit: handleLeaveApplication
  }), /*#__PURE__*/React.createElement(LeaveBalances, {
    showMessage: showMessage,
    apiBaseUrl: apiBaseUrl,
    accessToken: accessToken,
    leaveBalances: leaveBalances // Pass leave balances to this component
  })), activeTab === 'my-leaves' && /*#__PURE__*/React.createElement("section", {
    className: `p-6 rounded-lg shadow-md transition-colors duration-300 ${darkMode ? 'bg-gray-800' : 'bg-white'}`
  }, /*#__PURE__*/React.createElement("h2", {
    className: "text-3xl font-bold mb-8"
  }, "My Leave Applications"), /*#__PURE__*/React.createElement(MyLeaves, {
    showMessage: showMessage,
    apiBaseUrl: apiBaseUrl,
    accessToken: accessToken,
    onCancelRequest: handleLeaveCancellationRequest,
    leaveBalances: leaveBalances // Pass leave balances to MyLeaves
  })), activeTab === 'leave-balances' && /*#__PURE__*/React.createElement("section", {
    className: `p-6 rounded-lg shadow-md transition-colors duration-300 ${darkMode ? 'bg-gray-800' : 'bg-white'}`
  }, /*#__PURE__*/React.createElement("h2", {
    className: "text-3xl font-bold mb-8"
  }, "My Leave Balances"), /*#__PURE__*/React.createElement(LeaveBalances, {
    showMessage: showMessage,
    apiBaseUrl: apiBaseUrl,
    accessToken: accessToken,
    leaveBalances: leaveBalances // Pass leave balances to this component
  })), activeTab === 'correction' && /*#__PURE__*/React.createElement("section", {
    className: `p-6 rounded-lg shadow-md transition-colors duration-300 ${darkMode ? 'bg-gray-800' : 'bg-white'}`
  }, /*#__PURE__*/React.createElement("h2", {
    className: "text-3xl font-bold mb-8"
  }, "Request Attendance Correction"), /*#__PURE__*/React.createElement(AttendanceCorrectionForm, {
    showMessage: showMessage,
    apiBaseUrl: apiBaseUrl,
    accessToken: accessToken,
    onSubmit: handleCorrectionRequest
  })), activeTab === 'notifications' && /*#__PURE__*/React.createElement("section", {
    className: `p-6 rounded-lg shadow-md transition-colors duration-300 ${darkMode ? 'bg-gray-800' : 'bg-white'}`
  }, /*#__PURE__*/React.createElement("h2", {
    className: "text-3xl font-bold mb-8"
  }, "Notifications"), /*#__PURE__*/React.createElement(Notifications, {
    showMessage: showMessage,
    apiBaseUrl: apiBaseUrl,
    accessToken: accessToken,
    notifications: allNotifications // ADD THIS: Pass the full list of notifications
    ,
    onNotificationMarkedRead: fetchAllNotificationsAndCount // ADD THIS: Pass the callback function
  })), activeTab === 'profile' && /*#__PURE__*/React.createElement("section", {
    className: `p-6 rounded-lg shadow-md transition-colors duration-300 ${darkMode ? 'bg-gray-800' : 'bg-white'}`
  }, /*#__PURE__*/React.createElement("h2", {
    className: "text-3xl font-bold mb-8"
  }, "Profile Settings"), /*#__PURE__*/React.createElement(ProfileSettings, {
    user: user,
    showMessage: showMessage,
    apiBaseUrl: apiBaseUrl,
    accessToken: accessToken
  }))));
};

// Make the component globally accessible
window.EmployeeDashboard = EmployeeDashboard;