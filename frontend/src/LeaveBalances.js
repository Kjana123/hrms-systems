// LeaveBalances.js
// REMOVE all local import/export statements when using type="text/babel" in index.html

const LeaveBalances = ({ showMessage, apiBaseUrl, accessToken }) => {
    const [leaveBalances, setLeaveBalances] = React.useState([]);
    const [loadingBalances, setLoadingBalances] = React.useState(true);

    // Axios instance with token for authenticated requests
    const authAxios = axios.create({
        baseURL: apiBaseUrl,
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    const fetchLeaveBalances = async () => {
        try {
            const response = await authAxios.get(`${apiBaseUrl}/api/leaves/my-balances`);
            setLeaveBalances(response.data);
        } catch (error) {
            console.error("Error fetching leave balances:", error.response?.data?.message || error.message);
            showMessage(`Error fetching leave balances: ${error.response?.data?.message || error.message}`, "error");
        } finally {
            setLoadingBalances(false);
        }
    };

    React.useEffect(() => {
        if (accessToken) {
            fetchLeaveBalances();
        }
    }, [accessToken]); // Re-fetch when accessToken changes

    if (loadingBalances) {
        return <p className="text-gray-500 dark:text-gray-400">Loading your leave balances...</p>;
    }

    return (
        <div className="mt-8 p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700">
            <h4 className="text-lg font-medium mb-4">Your Current Leave Balances</h4>
            <div className="overflow-x-auto rounded-lg shadow-md">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Leave Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Description</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Total Allocated</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Current Balance</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Paid Leave</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {leaveBalances.length > 0 ? (
                            leaveBalances.map(balance => (
                                <tr key={`${balance.user_id}-${balance.leave_type}`} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{balance.leave_type}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300 max-w-xs overflow-hidden text-ellipsis">{balance.description || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{balance.total_days_allocated}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{balance.current_balance}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{balance.is_paid ? 'Yes' : 'No'}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">No leave balances found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

