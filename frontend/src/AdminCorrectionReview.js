// AdminCorrectionReview.js
// This component will be used within AdminDashboard.js
// REMOVE all local import/export statements when using type="text/babel" in index.html

const AdminCorrectionReview = ({ showMessage, apiBaseUrl, accessToken }) => {
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
                params: { status: 'pending' } // Assuming backend filters by status
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
                status: status, // 'approved' or 'rejected'
                admin_comment: adminComment, // Optional comment
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
        return (
            <div className="flex items-center justify-center p-8">
                <div className="w-4 h-4 rounded-full animate-pulse bg-blue-600"></div>
                <div className="w-4 h-4 rounded-full animate-pulse bg-blue-600"></div>
                <div className="w-4 h-4 rounded-full animate-pulse bg-blue-600"></div>
                <p className="ml-2">Loading correction requests...</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-300">
            <h2 className="text-2xl font-semibold mb-6">Attendance Correction Review</h2>

            <div className="overflow-x-auto rounded-lg shadow-md">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Employee</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Requested Check-in</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Requested Check-out</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Reason</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Admin Comment</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {correctionRequests.length > 0 ? (
                            correctionRequests.map(request => (
                                <tr key={request.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{request.user_name} ({request.employee_id})</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{request.date}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{request.expected_check_in || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{request.expected_check_out || 'N/A'}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300 max-w-xs overflow-hidden text-ellipsis">{request.reason}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 capitalize">{request.status}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">
                                        <input
                                            type="text"
                                            placeholder="Add comment..."
                                            className="w-full px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs"
                                            value={adminComment}
                                            onChange={(e) => setAdminComment(e.target.value)}
                                        />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        {request.status === 'pending' && (
                                            <>
                                                <button
                                                    onClick={() => handleReviewCorrection(request.id, 'approved', request)} 
                                                    className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 mr-2"
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => handleReviewCorrection(request.id, 'rejected', request)}
                                                    className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                                >
                                                    Reject
                                                </button>
                                            </>
                                        )}
                                        {(request.status === 'approved' || request.status === 'rejected') && (
                                            <span className="text-gray-500 dark:text-gray-400">Reviewed</span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="8" className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">No pending correction requests.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// Make the component globally accessible

