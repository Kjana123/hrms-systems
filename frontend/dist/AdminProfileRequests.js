// AdminProfileRequests.jsx - Designed for Babel script environment (no import/export)

// Assume React, ReactDOM, moment, and axios are globally available via <script> tags.

const AdminProfileRequests = ({
  showMessage,
  apiBaseUrl,
  accessToken,
  darkMode
}) => {
  const [requests, setRequests] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [selectedRequestId, setSelectedRequestId] = React.useState(null); // For modal context
  const [showRejectModal, setShowRejectModal] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState('');
  const [showViewDetailsModal, setShowViewDetailsModal] = React.useState(false); // New state for viewing full request details
  const [viewingRequestDetails, setViewingRequestDetails] = React.useState(null); // State to hold request data for detail view

  // Axios instance with token for authenticated requests
  const authAxios = axios.create({
    baseURL: apiBaseUrl,
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  // Function to fetch profile update requests
  const fetchProfileRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("[AdminProfileRequests] Fetching profile update requests...");
      // Fetch all requests, the backend can filter by status if a 'status' query param is sent
      const response = await authAxios.get('/api/admin/profile-update-requests');
      setRequests(response.data);
      console.log("[AdminProfileRequests] Fetched requests:", response.data);
    } catch (err) {
      console.error("[AdminProfileRequests] Error fetching profile requests:", err.response?.data?.message || err.message);
      setError(err.response?.data?.message || "Failed to fetch profile update requests.");
      showMessage(err.response?.data?.message || "Failed to fetch profile update requests.", 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle approving a request
  const handleApprove = async requestId => {
    // IMPORTANT: In a production app, replace window.confirm with a custom modal for better UX.
    if (!window.confirm('Are you sure you want to approve this profile update request? This will update the employee\'s profile directly.')) {
      return;
    }
    try {
      console.log(`[AdminProfileRequests] Approving request ID: ${requestId}`);
      // The backend /approve endpoint currently doesn't expect an admin_comment in the body,
      // but if you add it to your backend, you can pass it here:
      // await authAxios.post(`/api/admin/profile-update-requests/${requestId}/approve`, { admin_comment: 'Approved by admin' });
      await authAxios.post(`/api/admin/profile-update-requests/${requestId}/approve`);
      showMessage('Profile update request approved successfully!', 'success');
      fetchProfileRequests(); // Re-fetch to update the list
    } catch (err) {
      console.error(`[AdminProfileRequests] Error approving request ${requestId}:`, err.response?.data?.message || err.message);
      showMessage(err.response?.data?.message || 'Failed to approve request.', 'error');
    }
  };

  // Handle rejecting a request (opens modal)
  const handleRejectClick = requestId => {
    setSelectedRequestId(requestId);
    setShowRejectModal(true);
  };

  // Handle confirming rejection from modal
  const handleRejectConfirm = async () => {
    if (!selectedRequestId) return;
    try {
      console.log(`[AdminProfileRequests] Rejecting request ID: ${selectedRequestId} with reason: ${rejectReason}`);
      await authAxios.post(`/api/admin/profile-update-requests/${selectedRequestId}/reject`, {
        admin_comment: rejectReason
      });
      showMessage('Profile update request rejected successfully!', 'success');
      setShowRejectModal(false);
      setRejectReason('');
      setSelectedRequestId(null);
      fetchProfileRequests(); // Re-fetch to update the list
    } catch (err) {
      console.error(`[AdminProfileRequests] Error rejecting request ${selectedRequestId}:`, err.response?.data?.message || err.message);
      showMessage(err.response?.data?.message || 'Failed to reject request.', 'error');
    }
  };

  // Function to open the detailed view modal
  const handleViewDetailsClick = request => {
    setViewingRequestDetails(request);
    setShowViewDetailsModal(true);
  };
  React.useEffect(() => {
    fetchProfileRequests();
  }, [apiBaseUrl, accessToken]); // Re-fetch when API base URL or token changes

  if (loading) {
    return /*#__PURE__*/React.createElement("div", {
      className: `flex items-center justify-center py-8 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`
    }, /*#__PURE__*/React.createElement("div", {
      className: "w-5 h-5 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mr-3"
    }), "Loading profile update requests...");
  }
  if (error) {
    return /*#__PURE__*/React.createElement("div", {
      className: `text-center py-8 ${darkMode ? 'text-red-400' : 'text-red-600'}`
    }, /*#__PURE__*/React.createElement("p", null, "Error: ", error), /*#__PURE__*/React.createElement("button", {
      onClick: fetchProfileRequests,
      className: `mt-4 px-4 py-2 rounded-md ${darkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`
    }, "Retry"));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: `p-6 rounded-lg shadow-md ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`
  }, /*#__PURE__*/React.createElement("h2", {
    className: "text-2xl font-bold mb-6"
  }, "Profile Update Requests"), requests.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: `text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`
  }, "No profile update requests found.") : /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto rounded-lg shadow-md"
  }, /*#__PURE__*/React.createElement("table", {
    className: `min-w-full divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}`
  }, /*#__PURE__*/React.createElement("thead", {
    className: `${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: `px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`
  }, "Request ID"), /*#__PURE__*/React.createElement("th", {
    className: `px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`
  }, "Employee Name (ID)"), /*#__PURE__*/React.createElement("th", {
    className: `px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`
  }, "Status"), /*#__PURE__*/React.createElement("th", {
    className: `px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`
  }, "Requested At"), /*#__PURE__*/React.createElement("th", {
    className: `px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`
  }, "Reviewed By"), /*#__PURE__*/React.createElement("th", {
    className: `px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`
  }, "Actions"))), /*#__PURE__*/React.createElement("tbody", {
    className: `${darkMode ? 'bg-gray-800 divide-gray-700' : 'bg-white divide-gray-200'} divide-y`
  }, requests.map(request => /*#__PURE__*/React.createElement("tr", {
    key: request.id,
    className: `${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} transition-colors duration-150`
  }, /*#__PURE__*/React.createElement("td", {
    className: `px-6 py-4 whitespace-nowrap text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`
  }, request.id), /*#__PURE__*/React.createElement("td", {
    className: `px-6 py-4 whitespace-nowrap text-sm ${darkMode ? 'text-gray-300' : 'text-gray-500'}`
  }, request.user_name, " (", request.employee_id, ")"), /*#__PURE__*/React.createElement("td", {
    className: `px-6 py-4 whitespace-nowrap text-sm font-semibold ${request.status === 'pending' ? 'text-yellow-600 dark:text-yellow-400' : request.status === 'approved' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`
  }, request.status.toUpperCase()), /*#__PURE__*/React.createElement("td", {
    className: `px-6 py-4 whitespace-nowrap text-sm ${darkMode ? 'text-gray-300' : 'text-gray-500'}`
  }, moment(request.requested_at).format('YYYY-MM-DD hh:mm A')), /*#__PURE__*/React.createElement("td", {
    className: `px-6 py-4 whitespace-nowrap text-sm ${darkMode ? 'text-gray-300' : 'text-gray-500'}`
  }, request.reviewed_by_admin_name || 'N/A', request.reviewed_at && ` (${moment(request.reviewed_at).format('YYYY-MM-DD hh:mm A')})`), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm font-medium"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => handleViewDetailsClick(request),
    className: "text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-4"
  }, "View Details"), request.status === 'pending' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    onClick: () => handleApprove(request.id),
    className: "px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors duration-200 shadow-sm mr-2"
  }, "Approve"), /*#__PURE__*/React.createElement("button", {
    onClick: () => handleRejectClick(request.id),
    className: "px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200 shadow-sm"
  }, "Reject")), (request.status === 'approved' || request.status === 'rejected') && /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500 dark:text-gray-400"
  }, "Reviewed"))))))), showRejectModal && /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50"
  }, /*#__PURE__*/React.createElement("div", {
    className: `p-6 rounded-lg shadow-xl w-full max-w-md ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-bold mb-4"
  }, "Reject Profile Update Request"), /*#__PURE__*/React.createElement("p", {
    className: "mb-4"
  }, "Are you sure you want to reject this request? Please provide a reason (optional)."), /*#__PURE__*/React.createElement("textarea", {
    className: `w-full p-2 border rounded-md mb-4 ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`,
    rows: "3",
    placeholder: "Reason for rejection (optional)",
    value: rejectReason,
    onChange: e => setRejectReason(e.target.value)
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end space-x-4"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowRejectModal(false),
    className: `px-4 py-2 rounded-md ${darkMode ? 'bg-gray-600 hover:bg-gray-700 text-white' : 'bg-gray-300 hover:bg-gray-400 text-gray-800'}`
  }, "Cancel"), /*#__PURE__*/React.createElement("button", {
    onClick: handleRejectConfirm,
    className: "px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
  }, "Confirm Reject")))), showViewDetailsModal && viewingRequestDetails && /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50"
  }, /*#__PURE__*/React.createElement("div", {
    className: `p-6 rounded-lg shadow-xl w-full max-w-lg ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-bold mb-4"
  }, "Profile Update Request Details (ID: ", viewingRequestDetails.id, ")"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-3 text-sm"
  }, /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "Employee:"), " ", viewingRequestDetails.user_name, " (", viewingRequestDetails.employee_id, ")"), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "Requested At:"), " ", moment(viewingRequestDetails.requested_at).format('YYYY-MM-DD hh:mm A')), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "Status:"), " ", /*#__PURE__*/React.createElement("span", {
    className: `font-semibold ${viewingRequestDetails.status === 'pending' ? 'text-yellow-600 dark:text-yellow-400' : viewingRequestDetails.status === 'approved' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`
  }, viewingRequestDetails.status.toUpperCase())), viewingRequestDetails.reason && /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "Employee Reason:"), " ", /*#__PURE__*/React.createElement("span", {
    className: "italic"
  }, viewingRequestDetails.reason)), viewingRequestDetails.admin_comment && /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "Admin Comment:"), " ", /*#__PURE__*/React.createElement("span", {
    className: "italic"
  }, viewingRequestDetails.admin_comment)), viewingRequestDetails.reviewed_by_admin_name && /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "Reviewed By:"), " ", viewingRequestDetails.reviewed_by_admin_name, " on ", moment(viewingRequestDetails.reviewed_at).format('YYYY-MM-DD hh:mm A')), /*#__PURE__*/React.createElement("h4", {
    className: "font-semibold mt-4 mb-2"
  }, "Requested Changes:"), /*#__PURE__*/React.createElement("pre", {
    className: "whitespace-pre-wrap text-xs rounded-md p-2 bg-gray-100 dark:bg-gray-700 overflow-auto max-h-48"
  }, JSON.stringify(viewingRequestDetails.requested_data, null, 2))), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end space-x-4 mt-6"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowViewDetailsModal(false),
    className: `px-4 py-2 rounded-md ${darkMode ? 'bg-gray-600 hover:bg-gray-700 text-white' : 'bg-gray-300 hover:bg-gray-400 text-gray-800'}`
  }, "Close")))));
};

// Make the component globally accessible
window.AdminProfileRequests = AdminProfileRequests;