// AdminCorrectionReview.js
// This component will be used within AdminDashboard.js
// REMOVE all local import/export statements when using type="text/babel" in index.html

const AdminCorrectionReview = ({
  showMessage,
  apiBaseUrl,
  accessToken
}) => {
  const [correctionRequests, setCorrectionRequests] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [adminComment, setAdminComment] = React.useState(''); // For admin's comment on review

  // Axios instance with token for authenticated requests
  const authAxios = axios.create({
    baseURL: apiBaseUrl,
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  const fetchCorrectionRequests = async () => {
    try {
      // Fetch only pending correction requests
      const response = await authAxios.get(`${apiBaseUrl}/api/admin/corrections`, {
        params: {
          status: 'pending'
        } // Assuming backend filters by status
      });
      setCorrectionRequests(response.data);
    } catch (error) {
      console.error("Error fetching correction requests:", error.response?.data?.message || error.message);
      showMessage(`Error fetching correction requests: ${error.response?.data?.message || error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };
  React.useEffect(() => {
    if (accessToken) {
      fetchCorrectionRequests();
    }
  }, [accessToken]); // Re-fetch when accessToken changes

  // MODIFIED: Added fullRequestData to pass all necessary details
  const handleReviewCorrection = async (requestId, status, fullRequestData) => {
    if (!window.confirm(`Are you sure you want to ${status} this correction request?`)) {
      return;
    }
    try {
      await authAxios.post(`${apiBaseUrl}/admin/attendance/correction-review`, {
        id: requestId,
        status: status,
        // 'approved' or 'rejected'
        admin_comment: adminComment,
        // Optional comment
        // Pass additional data needed by backend for processing correction
        date: fullRequestData.date,
        userId: fullRequestData.user_id,
        expected_check_in: fullRequestData.expected_check_in,
        expected_check_out: fullRequestData.expected_check_out
      });
      showMessage(`Correction request ${status} successfully!`, 'success');
      setAdminComment(''); // Clear comment after submission
      fetchCorrectionRequests(); // Re-fetch to update the list
    } catch (error) {
      console.error("Error reviewing correction request:", error.response?.data?.message || error.message);
      showMessage(`Failed to review correction request: ${error.response?.data?.message || error.message}`, 'error');
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
    }, "Loading correction requests..."));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-300"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "text-2xl font-semibold mb-6"
  }, "Attendance Correction Review"), /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto rounded-lg shadow-md"
  }, /*#__PURE__*/React.createElement("table", {
    className: "min-w-full divide-y divide-gray-200 dark:divide-gray-700"
  }, /*#__PURE__*/React.createElement("thead", {
    className: "bg-gray-50 dark:bg-gray-700"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Employee"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Date"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Requested Check-in"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Requested Check-out"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Reason"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Status"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Admin Comment"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Actions"))), /*#__PURE__*/React.createElement("tbody", {
    className: "bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700"
  }, correctionRequests.length > 0 ? correctionRequests.map(request => /*#__PURE__*/React.createElement("tr", {
    key: request.id,
    className: "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
  }, /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white"
  }, request.user_name, " (", request.employee_id, ")"), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
  }, request.date), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
  }, request.expected_check_in || 'N/A'), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
  }, request.expected_check_out || 'N/A'), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 text-sm text-gray-500 dark:text-gray-300 max-w-xs overflow-hidden text-ellipsis"
  }, request.reason), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 capitalize"
  }, request.status), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 text-sm text-gray-500 dark:text-gray-300"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "Add comment...",
    className: "w-full px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs",
    value: adminComment,
    onChange: e => setAdminComment(e.target.value)
  })), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm font-medium"
  }, request.status === 'pending' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    onClick: () => handleReviewCorrection(request.id, 'approved', request),
    className: "text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 mr-2"
  }, "Approve"), /*#__PURE__*/React.createElement("button", {
    onClick: () => handleReviewCorrection(request.id, 'rejected', request),
    className: "text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
  }, "Reject")), (request.status === 'approved' || request.status === 'rejected') && /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500 dark:text-gray-400"
  }, "Reviewed")))) : /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "8",
    className: "px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400"
  }, "No pending correction requests."))))));
};

// Make the component globally accessible