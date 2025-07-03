// MyLeaves.js
// REMOVE all local import/export statements when using type="text/babel" in index.html

const MyLeaves = ({
  showMessage,
  apiBaseUrl,
  accessToken,
  onCancelRequest,
  leaveBalances
}) => {
  // Added leaveBalances prop
  const [myLeaves, setMyLeaves] = React.useState([]);
  const [loadingLeaves, setLoadingLeaves] = React.useState(true);
  const [leaveTypes, setLeaveTypes] = React.useState([]); // To map leave_type_id to name and is_paid

  // Axios instance with token for authenticated requests
  const authAxios = axios.create({
    baseURL: apiBaseUrl,
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  const fetchMyLeaves = async () => {
    try {
      const response = await authAxios.get(`${apiBaseUrl}/api/leaves/my`);
      setMyLeaves(response.data);
    } catch (error) {
      console.error("Error fetching my leaves:", error.response?.data?.message || error.message);
      showMessage(`Error fetching your leaves: ${error.response?.data?.message || error.message}`, "error");
    } finally {
      setLoadingLeaves(false);
    }
  };
  const fetchLeaveTypes = async () => {
    try {
      const response = await authAxios.get(`${apiBaseUrl}/api/leaves/types`); // Assuming a public endpoint for leave types
      setLeaveTypes(response.data);
    } catch (error) {
      console.error("Error fetching leave types:", error.response?.data?.message || error.message);
      // Don't show message for this background fetch if it fails, as it's auxiliary
    }
  };
  React.useEffect(() => {
    if (accessToken) {
      fetchMyLeaves();
      fetchLeaveTypes(); // Fetch leave types when component mounts
    }
  }, [accessToken]); // Re-fetch when accessToken changes

  // Function to refresh leaves after an action (e.g., cancellation request)
  const refreshLeaves = () => {
    setLoadingLeaves(true); // Show loading state while re-fetching
    fetchMyLeaves();
  };

  // Helper to find leave type details
  const getLeaveTypeDetails = leaveTypeId => {
    return leaveTypes.find(type => type.id === parseInt(leaveTypeId)) || {};
  };

  // Helper to get current balance for a leave type
  const getCurrentBalance = leaveTypeName => {
    const balanceRecord = leaveBalances.find(balance => balance.leave_type === leaveTypeName);
    return balanceRecord ? balanceRecord.current_balance : 'N/A';
  };
  if (loadingLeaves) {
    return /*#__PURE__*/React.createElement("p", {
      className: "text-gray-500 dark:text-gray-400"
    }, "Loading your leave applications...");
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "mt-8 p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "text-lg font-medium mb-4"
  }, "My Leave Applications"), /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto rounded-lg shadow-md"
  }, /*#__PURE__*/React.createElement("table", {
    className: "min-w-full divide-y divide-gray-200 dark:divide-gray-700"
  }, /*#__PURE__*/React.createElement("thead", {
    className: "bg-gray-50 dark:bg-gray-700"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Leave Type"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "From Date"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "To Date"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Duration (Days)"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Reason"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Status"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Balance Impact"), " ", /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Admin Comment"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Actions"))), /*#__PURE__*/React.createElement("tbody", {
    className: "bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700"
  }, myLeaves.length > 0 ? myLeaves.map(leave => {
    const typeDetails = getLeaveTypeDetails(leave.leave_type_id);
    const balanceImpact = leave.status === 'approved' && typeDetails.is_paid ? `-${leave.duration} days (Paid Leave)` : leave.status === 'approved' && !typeDetails.is_paid ? `${leave.duration} days (LOP)` : 'N/A';
    return /*#__PURE__*/React.createElement("tr", {
      key: leave.id,
      className: "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
    }, /*#__PURE__*/React.createElement("td", {
      className: "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white"
    }, leave.leave_type_name), /*#__PURE__*/React.createElement("td", {
      className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
    }, moment(leave.from_date).format('YYYY-MM-DD')), /*#__PURE__*/React.createElement("td", {
      className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
    }, moment(leave.to_date).format('YYYY-MM-DD')), /*#__PURE__*/React.createElement("td", {
      className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
    }, leave.duration, " ", leave.is_half_day ? '(Half Day)' : ''), /*#__PURE__*/React.createElement("td", {
      className: "px-6 py-4 text-sm text-gray-500 dark:text-gray-300 max-w-xs overflow-hidden text-ellipsis"
    }, leave.reason), /*#__PURE__*/React.createElement("td", {
      className: "px-6 py-4 whitespace-nowrap text-sm font-semibold capitalize"
    }, /*#__PURE__*/React.createElement("span", {
      className: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${leave.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : leave.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : leave.status === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : leave.status === 'cancelled' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' : leave.status === 'cancellation_pending' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`
    }, leave.leave_type_name, " ", leave.status.replace(/_/g, ' ').toUpperCase())), /*#__PURE__*/React.createElement("td", {
      className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
    }, balanceImpact), /*#__PURE__*/React.createElement("td", {
      className: "px-6 py-4 text-sm text-gray-500 dark:text-gray-300 max-w-xs overflow-hidden text-ellipsis"
    }, leave.admin_comment || 'N/A'), /*#__PURE__*/React.createElement("td", {
      className: "px-6 py-4 whitespace-nowrap text-sm font-medium"
    }, leave.status === 'approved' && /*#__PURE__*/React.createElement("button", {
      onClick: async () => {
        await onCancelRequest(leave.id);
        refreshLeaves(); // Refresh list after attempting cancellation
      },
      className: "text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 mr-2"
    }, "Request Cancellation"), leave.status === 'cancellation_pending' && /*#__PURE__*/React.createElement("span", {
      className: "text-yellow-600 dark:text-yellow-400"
    }, "Pending Cancellation")));
  }) : /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "9",
    className: "px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400"
  }, "No leave applications found."))))));
};

// Make the component globally accessible
window.MyLeaves = MyLeaves;