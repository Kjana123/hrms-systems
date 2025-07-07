// AdminLeaveManagement.js
// This component will be used within AdminDashboard.js
// REMOVE all local import/export statements when using type="text/babel" in index.html

const AdminLeaveManagement = ({
  showMessage,
  apiBaseUrl,
  accessToken,
  authAxios
}) => {
  // Added authAxios prop
  const [activeSubTab, setActiveSubTab] = React.useState('applications'); // 'applications', 'types', 'balances'
  const [leaveApplications, setLeaveApplications] = React.useState([]);
  const [leaveTypes, setLeaveTypes] = React.useState([]); // Stores dynamic leave types (e.g., Medical Leaves)
  const [leaveBalances, setLeaveBalances] = React.useState([]); // Stores dynamic leave balances per user per type
  const [loading, setLoading] = React.useState(true);

  // State for Leave Type form
  const [newLeaveTypeName, setNewLeaveTypeName] = React.useState('');
  const [newLeaveTypeDescription, setNewLeaveTypeDescription] = React.useState('');
  const [newLeaveTypeIsPaid, setNewLeaveTypeIsPaid] = React.useState(true);
  const [newLeaveTypeDefaultDays, setNewLeaveTypeDefaultDays] = React.useState('');

  // State for Leave Balance adjustment form
  const [selectedUserIdForBalance, setSelectedUserIdForBalance] = React.useState('');
  const [selectedLeaveTypeForBalance, setSelectedLeaveTypeForBalance] = React.useState(''); // This will be the leave type NAME (string)
  const [balanceAmount, setBalanceAmount] = React.useState('');
  const [balanceOperation, setBalanceOperation] = React.useState('set'); // 'add', 'subtract', 'set'
  const [allEmployees, setAllEmployees] = React.useState([]); // To populate user dropdown for balances

  // Helper function to calculate duration (copied from previous interaction)
  const calculateLeaveDuration = (fromDate, toDate, isHalfDay) => {
    const start = moment(fromDate);
    const end = moment(toDate);
    let duration = end.diff(start, 'days') + 1; // Inclusive of start and end dates

    if (isHalfDay && start.isSame(end, 'day')) {
      duration = 0.5; // If it's a half-day leave on a single day
    }
    return duration;
  };

  // Fetch data based on active sub-tab and dependencies
  React.useEffect(() => {
    const fetchData = async () => {
      if (!authAxios) {
        // Ensure authAxios is available before making calls
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        // Always fetch leave types and employees as they are used across tabs
        const [leaveTypesRes, employeesRes] = await Promise.all([authAxios.get(`${apiBaseUrl}/api/admin/leave-types`), authAxios.get(`${apiBaseUrl}/api/admin/users`)]);
        setLeaveTypes(leaveTypesRes.data);
        setAllEmployees(employeesRes.data);
        if (activeSubTab === 'applications') {
          const response = await authAxios.get(`${apiBaseUrl}/api/admin/leaves`);
          // Apply duration calculation and date formatting here
          const formattedApplications = response.data.map(app => ({
            ...app,
            from_date: moment(app.from_date).format('YYYY-MM-DD'),
            to_date: moment(app.to_date).format('YYYY-MM-DD'),
            duration: calculateLeaveDuration(app.from_date, app.to_date, app.is_half_day)
          }));
          setLeaveApplications(formattedApplications);
        } else if (activeSubTab === 'balances') {
          const balancesRes = await authAxios.get(`${apiBaseUrl}/api/admin/leave-balances`);
          setLeaveBalances(balancesRes.data);
        }
        // 'types' tab doesn't need a separate fetch here as leaveTypes are fetched above
      } catch (error) {
        console.error(`Error fetching data for ${activeSubTab} tab:`, error.response?.data?.message || error.message);
        showMessage(`Error fetching data for ${activeSubTab} tab: ${error.response?.data?.message || error.message}`, "error");
      } finally {
        setLoading(false);
      }
    };
    if (accessToken && authAxios) {
      // Ensure accessToken and authAxios are available
      fetchData();
    }
  }, [accessToken, activeSubTab, authAxios, apiBaseUrl, showMessage]); // Added apiBaseUrl and showMessage to dependencies

  // --- Leave Applications Management ---
  const handleLeaveStatusUpdate = async (applicationId, status, adminComment = '') => {
    // IMPORTANT: Use a custom modal for confirmation instead of window.confirm
    // For now, keeping window.confirm as per previous code structure, but note the instruction.
    const isConfirmed = window.confirm(`Are you sure you want to ${status} this leave application?`);
    if (!isConfirmed) {
      return;
    }
    try {
      await authAxios.put(`${apiBaseUrl}/api/admin/leaves/${applicationId}/status`, {
        status,
        admin_comment: adminComment
      });
      showMessage(`Leave application ${status} successfully!`, 'success');
      // Re-fetch applications
      const response = await authAxios.get(`${apiBaseUrl}/api/admin/leaves`);
      const formattedApplications = response.data.map(app => ({
        ...app,
        from_date: moment(app.from_date).format('YYYY-MM-DD'),
        to_date: moment(app.to_date).format('YYYY-MM-DD'),
        duration: calculateLeaveDuration(app.from_date, app.to_date, app.is_half_day)
      }));
      setLeaveApplications(formattedApplications);
    } catch (error) {
      console.error("Error updating leave status:", error.response?.data?.message || error.message);
      showMessage(`Failed to update leave status: ${error.response?.data?.message || error.message}`, 'error');
    }
  };

  // --- Leave Types Management ---
  const handleAddLeaveType = async e => {
    e.preventDefault();
    if (!newLeaveTypeName) {
      showMessage('Leave type name is required.', 'error');
      return;
    }
    try {
      await authAxios.post(`${apiBaseUrl}/api/admin/leave-types`, {
        name: newLeaveTypeName,
        description: newLeaveTypeDescription,
        is_paid: newLeaveTypeIsPaid,
        default_days_per_year: newLeaveTypeDefaultDays ? parseFloat(newLeaveTypeDefaultDays) : null
      });
      showMessage('Leave type added successfully!', 'success');
      setNewLeaveTypeName('');
      setNewLeaveTypeDescription('');
      setNewLeaveTypeIsPaid(true);
      setNewLeaveTypeDefaultDays('');
      // Re-fetch leave types
      const response = await authAxios.get(`${apiBaseUrl}/api/admin/leave-types`);
      setLeaveTypes(response.data);
    } catch (error) {
      console.error("Error adding leave type:", error.response?.data?.message || error.message);
      showMessage(`Failed to add leave type: ${error.response?.data?.message || error.message}`, 'error');
    }
  };
  const handleDeleteLeaveType = async typeId => {
    // IMPORTANT: Use a custom modal for confirmation instead of window.confirm
    // For now, keeping window.confirm as per previous code structure, but note the instruction.
    const isConfirmed = window.confirm('Are you sure you want to delete this leave type? This action cannot be undone and may affect existing leave applications/balances.');
    if (!isConfirmed) {
      return;
    }
    try {
      await authAxios.delete(`${apiBaseUrl}/api/admin/leave-types/${typeId}`);
      showMessage('Leave type deleted successfully!', 'success');
      // Re-fetch leave types
      const response = await authAxios.get(`${apiBaseUrl}/api/admin/leave-types`);
      setLeaveTypes(response.data);
      // Also re-fetch balances as deleting a type might affect them
      const balancesRes = await authAxios.get(`${apiBaseUrl}/api/admin/leave-balances`);
      setLeaveBalances(balancesRes.data);
    } catch (error) {
      console.error("Error deleting leave type:", error.response?.data?.message || error.message);
      showMessage(`Failed to delete leave type: ${error.response?.data?.message || error.message}`, 'error');
    }
  };

  // --- Leave Balances Management ---
  const handleAdjustLeaveBalance = async e => {
    e.preventDefault();
    if (!selectedUserIdForBalance || !selectedLeaveTypeForBalance || balanceAmount === '' || isNaN(parseFloat(balanceAmount))) {
      showMessage('Please select an employee, leave type, and enter a valid amount.', 'error');
      return;
    }
    const amountValue = parseFloat(balanceAmount);

    // --- START DEBUG LOGS ---
    console.log("--- Adjust Leave Balance Debug ---");
    console.log("Selected User ID:", selectedUserIdForBalance);
    console.log("Selected Leave Type:", selectedLeaveTypeForBalance);
    console.log("Amount Value (input):", amountValue);
    console.log("Operation:", balanceOperation);
    console.log("Current Leave Balances State (before find):", JSON.parse(JSON.stringify(leaveBalances))); // Deep copy to avoid mutation logs
    // --- END DEBUG LOGS ---

    // Find the current balance for the selected user and leave type
    // Ensure type consistency for comparison
    const currentBalanceRecord = leaveBalances.find(b => String(b.user_id) === String(selectedUserIdForBalance) && b.leave_type === selectedLeaveTypeForBalance);

    // --- START DEBUG LOGS ---
    console.log("Found currentBalanceRecord:", currentBalanceRecord);
    // --- END DEBUG LOGS ---

    // Initialize with existing values or 0 if no record exists
    let newBalance = currentBalanceRecord ? parseFloat(currentBalanceRecord.current_balance) : 0;
    let newTotalAllocated = currentBalanceRecord ? parseFloat(currentBalanceRecord.total_days_allocated) : 0;

    // --- START DEBUG LOGS ---
    console.log("Initial newBalance (from record or 0):", newBalance);
    console.log("Initial newTotalAllocated (from record or 0):", newTotalAllocated);
    // --- END DEBUG LOGS ---

    // --- IMPORTANT: Calculate newBalance and newTotalAllocated based on operation ---
    if (balanceOperation === 'add') {
      newBalance += amountValue;
      newTotalAllocated += amountValue; // Adding to total allocated days as well
    } else if (balanceOperation === 'subtract') {
      newBalance -= amountValue;
      // For subtraction, total_days_allocated should remain unchanged.
      // It represents the initial allocation, not the current balance.
      // newTotalAllocated will retain its value from the initialization above.
    } else if (balanceOperation === 'set') {
      newBalance = amountValue;
      newTotalAllocated = amountValue; // When setting, total allocated is also set to this amount
    }

    // --- START DEBUG LOGS ---
    console.log("Calculated newBalance (after operation):", newBalance);
    console.log("Calculated newTotalAllocated (after operation):", newTotalAllocated);
    // --- END DEBUG LOGS ---

    try {
      // Send the POST request to the backend with the calculated new balance
      // Ensure we send the *calculated* newBalance and newTotalAllocated, not the raw balanceAmount
      await authAxios.post(`${apiBaseUrl}/api/admin/leave-balances`, {
        user_id: selectedUserIdForBalance,
        leave_type: selectedLeaveTypeForBalance,
        // Send the leave type name string
        amount: newBalance,
        // THIS IS THE CRITICAL CHANGE: Send the CALCULATED newBalance
        total_days_allocated: newTotalAllocated,
        // THIS IS THE CRITICAL CHANGE: Send the CALCULATED newTotalAllocated
        operation: 'set_all' // Indicate to backend to set these specific values
      });
      showMessage('Leave balance adjusted successfully!', 'success');
      setSelectedUserIdForBalance('');
      setSelectedLeaveTypeForBalance('');
      setBalanceAmount('');
      setBalanceOperation('set'); // Reset to 'set' for next operation

      // Re-fetch leave balances and employees to update the lists
      const [balancesRes, employeesRes] = await Promise.all([authAxios.get(`${apiBaseUrl}/api/admin/leave-balances`), authAxios.get(`${apiBaseUrl}/api/admin/users`)]);
      setLeaveBalances(balancesRes.data);
      setAllEmployees(employeesRes.data);
    } catch (error) {
      console.error("Error adjusting leave balance:", error.response?.data?.message || error.message);
      showMessage(`Failed to adjust leave balance: ${error.response?.data?.message || error.message}`, 'error');
    }
  };
  const handleDeleteLeaveBalance = async (userId, leaveType) => {
    // Now accepts user_id and leave_type
    // IMPORTANT: Use a custom modal for confirmation instead of window.confirm
    // For now, keeping window.confirm as per previous code structure, but note the instruction.
    const isConfirmed = window.confirm(`Are you sure you want to delete the ${leaveType} balance for this employee?`);
    if (!isConfirmed) {
      return;
    }
    try {
      // Send DELETE request with user_id and leave_type in query parameters or body
      // Using query parameters is simpler for DELETE
      await authAxios.delete(`${apiBaseUrl}/api/admin/leave-balances`, {
        data: {
          userId,
          leaveType
        } // Use 'data' property for DELETE requests with body
      });
      showMessage('Leave balance record deleted successfully!', 'success');
      // Re-fetch leave balances
      const [balancesRes, employeesRes] = await Promise.all([authAxios.get(`${apiBaseUrl}/api/admin/leave-balances`), authAxios.get(`${apiBaseUrl}/api/admin/users`)]);
      setLeaveBalances(balancesRes.data);
      setAllEmployees(employeesRes.data);
    } catch (error) {
      console.error("Error deleting leave balance record:", error.response?.data?.message || error.message);
      showMessage(`Failed to delete leave balance record: ${error.response?.data?.message || error.message}`, 'error');
    }
  };
  if (loading) {
    return /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-center p-8"
    }, /*#__PURE__*/React.createElement("div", {
      className: "w-4 h-4 rounded-full animate-pulse bg-blue-600"
    }), /*#__PURE__*/React.createElement("div", {
      className: "w-4 h-4 rounded-full animate-pulse bg-blue-600"
    }), /*#__PURE__*/React.createElement("div", {
      className: "w-4 h-4 rounded-full animate-pulse bg-blue-600"
    }), /*#__PURE__*/React.createElement("p", {
      className: "ml-2"
    }, "Loading leave data..."));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-300"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "text-2xl font-semibold mb-6"
  }, "Leave Management"), /*#__PURE__*/React.createElement("div", {
    className: "flex border-b border-gray-200 dark:border-gray-700 mb-6"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setActiveSubTab('applications'),
    className: `py-2 px-4 -mb-px border-b-2 ${activeSubTab === 'applications' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'} focus:outline-none`
  }, "Applications"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setActiveSubTab('types'),
    className: `py-2 px-4 -mb-px border-b-2 ${activeSubTab === 'types' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'} focus:outline-none`
  }, "Leave Types"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setActiveSubTab('balances'),
    className: `py-2 px-4 -mb-px border-b-2 ${activeSubTab === 'balances' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'} focus:outline-none`
  }, "Balances")), activeSubTab === 'applications' && /*#__PURE__*/React.createElement("section", null, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-semibold mb-4"
  }, "Leave Applications Overview"), /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto rounded-lg shadow-md"
  }, /*#__PURE__*/React.createElement("table", {
    className: "min-w-full divide-y divide-gray-200 dark:divide-gray-700"
  }, /*#__PURE__*/React.createElement("thead", {
    className: "bg-gray-50 dark:bg-gray-700"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Employee"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Leave Type"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Dates"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Duration"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Reason"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Status"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Admin Comment"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Actions"))), /*#__PURE__*/React.createElement("tbody", {
    className: "bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700"
  }, leaveApplications.length > 0 ? leaveApplications.map(app => /*#__PURE__*/React.createElement("tr", {
    key: app.id,
    className: "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
  }, /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white"
  }, app.user_name, " (", app.employee_id, ")"), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
  }, app.leave_type_name), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
  }, app.from_date, " to ", app.to_date), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
  }, app.duration, " ", app.is_half_day ? '(Half Day)' : ''), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 text-sm text-gray-500 dark:text-gray-300 max-w-xs overflow-hidden text-ellipsis"
  }, app.reason), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 capitalize"
  }, app.status.replace(/_/g, ' ')), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 text-sm text-gray-500 dark:text-gray-300 max-w-xs overflow-hidden text-ellipsis"
  }, app.admin_comment || 'N/A'), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm font-medium"
  }, app.status === 'pending' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    onClick: () => handleLeaveStatusUpdate(app.id, 'approved'),
    className: "text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 mr-2"
  }, "Approve"), /*#__PURE__*/React.createElement("button", {
    onClick: () => handleLeaveStatusUpdate(app.id, 'rejected'),
    className: "text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
  }, "Reject")), app.status === 'cancellation_pending' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    onClick: () => handleLeaveStatusUpdate(app.id, 'cancelled', 'Cancellation approved'),
    className: "text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 mr-2"
  }, "Approve Cancellation"), /*#__PURE__*/React.createElement("button", {
    onClick: () => handleLeaveStatusUpdate(app.id, 'approved', 'Cancellation rejected, leave reinstated'),
    className: "text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
  }, "Reject Cancellation")), (app.status === 'approved' || app.status === 'rejected' || app.status === 'cancelled' || app.status === 'overridden_by_correction') && /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500 dark:text-gray-400"
  }, "No action needed")))) : /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "8",
    className: "px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400"
  }, "No leave applications found.")))))), activeSubTab === 'types' && /*#__PURE__*/React.createElement("section", null, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-semibold mb-4"
  }, "Manage Leave Types"), /*#__PURE__*/React.createElement("form", {
    onSubmit: handleAddLeaveType,
    className: "space-y-4 mb-8 p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "text-lg font-medium mb-4"
  }, "Add New Leave Type"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "newLeaveTypeName",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Name"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    id: "newLeaveTypeName",
    className: "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm",
    value: newLeaveTypeName,
    onChange: e => setNewLeaveTypeName(e.target.value),
    required: true
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "newLeaveTypeDescription",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Description"), /*#__PURE__*/React.createElement("textarea", {
    id: "newLeaveTypeDescription",
    rows: "2",
    className: "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm",
    value: newLeaveTypeDescription,
    onChange: e => setNewLeaveTypeDescription(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    id: "newLeaveTypeIsPaid",
    className: "h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600",
    checked: newLeaveTypeIsPaid,
    onChange: e => setNewLeaveTypeIsPaid(e.target.checked)
  }), /*#__PURE__*/React.createElement("label", {
    htmlFor: "newLeaveTypeIsPaid",
    className: "ml-2 block text-sm text-gray-900 dark:text-gray-300"
  }, "Is Paid Leave")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "newLeaveTypeDefaultDays",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Default Days Per Year (Optional)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    step: "0.5",
    id: "newLeaveTypeDefaultDays",
    className: "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm",
    value: newLeaveTypeDefaultDays,
    onChange: e => setNewLeaveTypeDefaultDays(e.target.value)
  })), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 shadow-md"
  }, "Add Leave Type")), /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-semibold mb-4"
  }, "Existing Leave Types"), /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto rounded-lg shadow-md"
  }, /*#__PURE__*/React.createElement("table", {
    className: "min-w-full divide-y divide-gray-200 dark:divide-gray-700"
  }, /*#__PURE__*/React.createElement("thead", {
    className: "bg-gray-50 dark:bg-gray-700"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Name"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Description"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Paid"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Default Days"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Actions"))), /*#__PURE__*/React.createElement("tbody", {
    className: "bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700"
  }, leaveTypes.length > 0 ? leaveTypes.map(type => /*#__PURE__*/React.createElement("tr", {
    key: type.id,
    className: "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
  }, /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white"
  }, type.name), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 text-sm text-gray-500 dark:text-gray-300 max-w-xs overflow-hidden text-ellipsis"
  }, type.description || 'N/A'), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
  }, type.is_paid ? 'Yes' : 'No'), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
  }, type.default_days_per_year || 'N/A'), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm font-medium"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => handleDeleteLeaveType(type.id),
    className: "text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
  }, "Delete")))) : /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "5",
    className: "px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400"
  }, "No leave types defined.")))))), activeSubTab === 'balances' && /*#__PURE__*/React.createElement("section", null, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-semibold mb-4"
  }, "Adjust Leave Balances"), /*#__PURE__*/React.createElement("form", {
    onSubmit: handleAdjustLeaveBalance,
    className: "space-y-4 mb-8 p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "text-lg font-medium mb-4"
  }, "Adjust Employee Leave Balance"), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "balanceEmployee",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Employee"), /*#__PURE__*/React.createElement("select", {
    id: "balanceEmployee",
    className: "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm",
    value: selectedUserIdForBalance,
    onChange: e => setSelectedUserIdForBalance(e.target.value),
    required: true
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Select Employee"), allEmployees.map(emp => /*#__PURE__*/React.createElement("option", {
    key: emp.id,
    value: emp.id
  }, emp.name, " (", emp.employee_id, ")")))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "balanceLeaveType",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Leave Type"), /*#__PURE__*/React.createElement("select", {
    // Changed to select
    id: "balanceLeaveType",
    className: "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm",
    value: selectedLeaveTypeForBalance,
    onChange: e => setSelectedLeaveTypeForBalance(e.target.value),
    required: true
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Select Leave Type"), leaveTypes.map(type => /*#__PURE__*/React.createElement("option", {
    key: type.id,
    value: type.name
  }, type.name)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "balanceAmount",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Amount"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    step: "0.5",
    id: "balanceAmount",
    className: "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm",
    value: balanceAmount,
    onChange: e => setBalanceAmount(e.target.value),
    required: true
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "balanceOperation",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Operation"), /*#__PURE__*/React.createElement("select", {
    id: "balanceOperation",
    className: "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm",
    value: balanceOperation,
    onChange: e => setBalanceOperation(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: "set"
  }, "Set as New Balance"), /*#__PURE__*/React.createElement("option", {
    value: "add"
  }, "Add to Current Balance"), /*#__PURE__*/React.createElement("option", {
    value: "subtract"
  }, "Subtract from Current Balance"), " "))), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 shadow-md"
  }, "Adjust Balance")), /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-semibold mb-4"
  }, "All Leave Balances"), /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto rounded-lg shadow-md"
  }, /*#__PURE__*/React.createElement("table", {
    className: "min-w-full divide-y divide-gray-200 dark:divide-gray-700"
  }, /*#__PURE__*/React.createElement("thead", {
    className: "bg-gray-50 dark:bg-gray-700"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Employee"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Leave Type"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Current Balance"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Total Allocated"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Actions"))), /*#__PURE__*/React.createElement("tbody", {
    className: "bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700"
  }, leaveBalances.length > 0 ? leaveBalances.map(balance =>
  /*#__PURE__*/
  // Use composite key for dynamic types
  React.createElement("tr", {
    key: `${balance.user_id}-${balance.leave_type}`,
    className: "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
  }, /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white"
  }, allEmployees.find(emp => emp.id === balance.user_id)?.name || 'Unknown', "(", allEmployees.find(emp => emp.id === balance.user_id)?.employee_id || 'N/A', ")"), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
  }, balance.leave_type), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
  }, balance.current_balance), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
  }, balance.total_days_allocated), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm font-medium"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => handleDeleteLeaveBalance(balance.user_id, balance.leave_type) // Pass both user_id and leave_type
    ,
    className: "text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
  }, "Delete")))) : /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "5",
    className: "px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400"
  }, "No leave balances found.")))))));
};

// Make the component globally accessible
window.AdminLeaveManagement = AdminLeaveManagement;