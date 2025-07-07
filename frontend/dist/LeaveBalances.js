// LeaveBalances.js
// This component displays an employee's leave balances.
// It will now manage its own state for leave balances by fetching them directly.
// REMOVE all local import/export statements when using type="text/babel" in index.html

const LeaveBalances = ({
  showMessage,
  apiBaseUrl,
  accessToken
}) => {
  // Removed leaveBalances from props
  const [leaveBalances, setLeaveBalances] = React.useState([]); // Local state for leave balances
  const [loadingBalances, setLoadingBalances] = React.useState(true);

  // Axios instance with token for authenticated requests
  const authAxios = axios.create({
    baseURL: apiBaseUrl,
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  // Function to fetch leave balances
  const fetchLeaveBalances = async () => {
    setLoadingBalances(true);
    try {
      const response = await authAxios.get(`${apiBaseUrl}/api/leaves/my-balances`);
      setLeaveBalances(response.data); // Update local state with fetched data
    } catch (error) {
      console.error("Error fetching leave balances:", error.response?.data?.message || error.message);
      showMessage(`Error fetching leave balances: ${error.response?.data?.message || error.message}`, "error");
    } finally {
      setLoadingBalances(false);
    }
  };
  React.useEffect(() => {
    // Fetch leave balances when the component mounts or accessToken changes
    if (accessToken) {
      fetchLeaveBalances();
    }
  }, [accessToken]); // Depend on accessToken to re-fetch if it changes

  if (loadingBalances) {
    return /*#__PURE__*/React.createElement("p", {
      className: "text-gray-500 dark:text-gray-400"
    }, "Loading your leave balances...");
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "mt-8 p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "text-lg font-medium mb-4"
  }, "Your Current Leave Balances"), /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto rounded-lg shadow-md"
  }, /*#__PURE__*/React.createElement("table", {
    className: "min-w-full divide-y divide-gray-200 dark:divide-gray-700"
  }, /*#__PURE__*/React.createElement("thead", {
    className: "bg-gray-50 dark:bg-gray-700"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Leave Type"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Description"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Total Allocated"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Current Balance"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Paid Leave"))), /*#__PURE__*/React.createElement("tbody", {
    className: "bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700"
  }, leaveBalances.length > 0 ? leaveBalances.map(balance => /*#__PURE__*/React.createElement("tr", {
    key: `${balance.user_id}-${balance.leave_type}`,
    className: "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
  }, /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white"
  }, balance.leave_type), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 text-sm text-gray-500 dark:text-gray-300 max-w-xs overflow-hidden text-ellipsis"
  }, balance.description || 'N/A'), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
  }, balance.total_days_allocated), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
  }, balance.current_balance), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
  }, balance.is_paid ? 'Yes' : 'No'))) : /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "5",
    className: "px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400"
  }, "No leave balances found."))))));
};

// Make the component globally accessible
window.LeaveBalances = LeaveBalances;