// AdminAnalyticsReports.js
// This component will be used within AdminDashboard.js
// REMOVE all local import/export statements when using type="text/babel" in index.html

const AdminAnalyticsReports = ({
  showMessage,
  apiBaseUrl,
  accessToken,
  authAxios,
  adminStats,
  handleAnalyticsClick,
  darkMode
}) => {
  const [monthlySummary, setMonthlySummary] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedMonth, setSelectedMonth] = React.useState(moment().month() + 1); // 1-indexed
  const [selectedYear, setSelectedYear] = React.useState(moment().year());

  // Update local 'stats' state if 'adminStats' prop changes from parent
  // This ensures that if the parent (AdminDashboard) fetches updated stats,
  // this component also reflects them without re-fetching if not necessary.
  const [stats, setStats] = React.useState(adminStats);
  React.useEffect(() => {
    if (adminStats) {
      setStats(adminStats);
    }
  }, [adminStats]);

  // Helper function to format duration for display (e.g., 8.5 hours becomes 8h 30m)
  const formatDuration = hours => {
    if (typeof hours === 'string') {
      hours = parseFloat(hours);
    }
    if (isNaN(hours) || hours === null || hours === undefined) return 'N/A';
    const totalMinutes = Math.round(hours * 60);
    const displayHours = Math.floor(totalMinutes / 60);
    const displayMinutes = totalMinutes % 60;
    return `${displayHours}h ${displayMinutes}m`;
  };
  const fetchAnalyticsData = async () => {
    try {
      // Fetch overall stats if not provided by parent or if it needs to be refreshed by this component
      // If adminStats is already passed from parent and is up-to-date, this might not be strictly necessary
      // but is good for robustness if this component needs to be self-sufficient.
      // For now, relying on `adminStats` prop for overall stats.
      // If you want this component to fetch its own overall stats, uncomment the line below:
      // const statsResponse = await authAxios.get(`${apiBaseUrl}/api/admin/stats`);
      // setStats(statsResponse.data); // Update the local stats state

      const monthlySummaryResponse = await authAxios.get(`${apiBaseUrl}/api/admin/monthly-summary`, {
        params: {
          month: selectedMonth,
          year: selectedYear
        }
      });
      setMonthlySummary(monthlySummaryResponse.data);
    } catch (error) {
      console.error("Error fetching admin analytics data:", error.response?.data?.message || error.message);
      showMessage(`Error fetching analytics data: ${error.response?.data?.message || error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };
  React.useEffect(() => {
    // Ensure authAxios is available before fetching
    if (accessToken && authAxios) {
      fetchAnalyticsData();
    }
  }, [accessToken, selectedMonth, selectedYear, authAxios]); // Re-fetch when token, month, year, or authAxios changes

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

  if (loading) {
    return /*#__PURE__*/React.createElement("div", {
      className: `flex items-center justify-center p-8 ${darkMode ? 'text-white' : 'text-gray-900'}`
    }, /*#__PURE__*/React.createElement("div", {
      className: "w-4 h-4 rounded-full animate-pulse bg-blue-600 mr-1"
    }), /*#__PURE__*/React.createElement("div", {
      className: "w-4 h-4 rounded-full animate-pulse bg-blue-600 mr-1"
    }), /*#__PURE__*/React.createElement("div", {
      className: "w-4 h-4 rounded-full animate-pulse bg-blue-600"
    }), /*#__PURE__*/React.createElement("p", {
      className: "ml-2"
    }, "Loading analytics data..."));
  }

  // If stats is null (e.g., initial load before prop is passed or fetch failed)
  if (!stats) {
    return /*#__PURE__*/React.createElement("section", {
      className: `p-6 rounded-lg shadow-md transition-colors duration-300 ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`
    }, /*#__PURE__*/React.createElement("h2", {
      className: "text-2xl font-semibold mb-6"
    }, "Analytics & Reports"), /*#__PURE__*/React.createElement("p", {
      className: "text-gray-600 dark:text-gray-400"
    }, "No overall analytics data available or failed to load."));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: `p-6 rounded-lg shadow-md transition-colors duration-300 ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`
  }, /*#__PURE__*/React.createElement("h2", {
    className: "text-2xl font-semibold mb-6"
  }, "Analytics & Reports"), /*#__PURE__*/React.createElement("section", {
    className: "mb-8"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-semibold mb-4"
  }, "Overall Statistics"), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8"
  }, /*#__PURE__*/React.createElement("div", {
    className: `p-6 rounded-lg shadow-md flex items-center justify-between ${darkMode ? 'bg-blue-900' : 'bg-blue-100'}`
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-semibold text-blue-800 dark:text-blue-200"
  }, "Total Employees"), /*#__PURE__*/React.createElement("p", {
    className: "text-4xl font-bold text-blue-600 dark:text-blue-400"
  }, stats.total_employees || 0)), /*#__PURE__*/React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    className: "h-12 w-12 text-blue-500 dark:text-blue-300",
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H2v-2a3 3 0 015.356-1.857M9 20v-2m3 2v-2m3 2v-2m-9-1h10M4 18H2.856M11 3v1m0 16v1m-9-9h1m16 0h1M6.372 6.372l-.707-.707M17.628 17.628l.707.707M6.372 17.628l-.707.707M17.628 6.372l.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
  }))), /*#__PURE__*/React.createElement("div", {
    className: `p-6 rounded-lg shadow-md flex items-center justify-between ${darkMode ? 'bg-green-900' : 'bg-green-100'}`
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-semibold text-green-800 dark:text-green-200"
  }, "Total Working Hours (This Month)"), /*#__PURE__*/React.createElement("p", {
    className: "text-4xl font-bold text-green-600 dark:text-green-400"
  }, formatDuration(stats.grand_total_working_hours))), /*#__PURE__*/React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    className: "h-12 w-12 text-green-500 dark:text-green-300",
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: () => handleAnalyticsClick('attendance', 'PRESENT') // Pass 'PRESENT' status filter
    ,
    className: `p-6 rounded-lg shadow-md flex items-center justify-between cursor-pointer hover:shadow-lg transform hover:scale-105 transition-all duration-200 ${darkMode ? 'bg-blue-900' : 'bg-blue-100'}`
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-semibold text-blue-800 dark:text-blue-200"
  }, "Total Present Today"), /*#__PURE__*/React.createElement("p", {
    className: "text-4xl font-bold text-blue-600 dark:text-blue-400"
  }, stats.presentToday || 0)), /*#__PURE__*/React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    className: "h-12 w-12 text-blue-500 dark:text-blue-300",
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: () => handleAnalyticsClick('attendance', 'ABSENT') // Pass 'ABSENT' status filter
    ,
    className: `p-6 rounded-lg shadow-md flex items-center justify-between cursor-pointer hover:shadow-lg transform hover:scale-105 transition-all duration-200 ${darkMode ? 'bg-red-900' : 'bg-red-100'}`
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-semibold text-red-800 dark:text-red-200"
  }, "Total Absent Today"), /*#__PURE__*/React.createElement("p", {
    className: "text-4xl font-bold text-red-600 dark:text-red-400"
  }, stats.absentToday || 0)), /*#__PURE__*/React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    className: "h-12 w-12 text-red-500 dark:text-red-300",
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: () => handleAnalyticsClick('leave-management', 'approved') // Navigate to leave management, potentially filter approved leaves
    ,
    className: `p-6 rounded-lg shadow-md flex items-center justify-between cursor-pointer hover:shadow-lg transform hover:scale-105 transition-all duration-200 ${darkMode ? 'bg-purple-900' : 'bg-purple-100'}`
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-semibold text-purple-800 dark:text-purple-200"
  }, "Total On Leave Today"), /*#__PURE__*/React.createElement("p", {
    className: "text-4xl font-bold text-purple-600 dark:text-purple-400"
  }, stats.onLeaveToday || 0)), /*#__PURE__*/React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    className: "h-12 w-12 text-purple-500 dark:text-purple-300",
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: () => handleAnalyticsClick('leave-management', 'pending') // Navigate to leave management, filter pending leaves
    ,
    className: `p-6 rounded-lg shadow-md flex items-center justify-between cursor-pointer hover:shadow-lg transform hover:scale-105 transition-all duration-200 ${darkMode ? 'bg-yellow-900' : 'bg-yellow-100'}`
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-semibold text-yellow-800 dark:text-yellow-200"
  }, "Pending Leaves"), /*#__PURE__*/React.createElement("p", {
    className: "text-4xl font-bold text-yellow-600 dark:text-yellow-400"
  }, stats.pending_leave_requests || 0)), /*#__PURE__*/React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    className: "h-12 w-12 text-yellow-500 dark:text-yellow-300",
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: () => handleAnalyticsClick('correction-review', 'pending') // Navigate to correction review, filter pending corrections
    ,
    className: `p-6 rounded-lg shadow-md flex items-center justify-between cursor-pointer hover:shadow-lg transform hover:scale-105 transition-all duration-200 ${darkMode ? 'bg-indigo-900' : 'bg-indigo-100'}`
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-semibold text-indigo-800 dark:text-indigo-200"
  }, "Pending Corrections"), /*#__PURE__*/React.createElement("p", {
    className: "text-4xl font-bold text-indigo-600 dark:text-indigo-400"
  }, stats.pending_correction_requests || 0)), /*#__PURE__*/React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    className: "h-12 w-12 text-indigo-500 dark:text-indigo-300",
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
  }))))), /*#__PURE__*/React.createElement("section", null, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-semibold mb-4"
  }, "Monthly Attendance Summary"), /*#__PURE__*/React.createElement("div", {
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
  }, year)))), /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto rounded-lg shadow-md"
  }, /*#__PURE__*/React.createElement("table", {
    className: "min-w-full divide-y divide-gray-200 dark:divide-gray-700"
  }, /*#__PURE__*/React.createElement("thead", {
    className: "bg-gray-50 dark:bg-gray-700"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Employee"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Present"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Late"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Absent"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "On Leave"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "LOP"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Holidays"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Weekly Offs"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Total Working Hours"), " ")), /*#__PURE__*/React.createElement("tbody", {
    className: "bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700"
  }, monthlySummary.length > 0 ? monthlySummary.map(summary => /*#__PURE__*/React.createElement("tr", {
    key: summary.user_id,
    className: "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
  }, /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white"
  }, summary.user_name, " (", summary.employee_id, ")"), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
  }, summary.present_days), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
  }, summary.late_days), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
  }, summary.absent_days), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
  }, summary.leave_days), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
  }, summary.lop_days), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
  }, summary.holidays), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
  }, summary.weekly_offs), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
  }, formatDuration(summary.total_working_hours), " "))) : /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "9",
    className: "px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400"
  }, "No monthly summary data found for the selected period.")))))));
};

// Make the component globally accessible
window.AdminAnalyticsReports = AdminAnalyticsReports;