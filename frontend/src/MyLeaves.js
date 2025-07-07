// MyLeaves.js
// This component will display an employee's leave applications.
// REMOVE all local import/export statements when using type="text/babel" in index.html

const MyLeaves = ({ showMessage, apiBaseUrl, accessToken, onCancelRequest, leaveBalances }) => {
    const [leaveApplications, setLeaveApplications] = React.useState([]);
    const [loadingApplications, setLoadingApplications] = React.useState(true);

    const authAxios = React.useMemo(() => axios.create({
        baseURL: apiBaseUrl,
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    }), [apiBaseUrl, accessToken]);

    // Helper function to calculate duration (copied from AdminLeaveManagement)
    const calculateLeaveDuration = (fromDate, toDate, isHalfDay) => {
        const start = moment(fromDate);
        const end = moment(toDate);
        let duration = end.diff(start, 'days') + 1; // Inclusive of start and end dates

        if (isHalfDay && start.isSame(end, 'day')) {
            duration = 0.5; // If it's a half-day leave on a single day
        }
        return duration;
    };

    // Function to fetch employee's leave applications
    const fetchLeaveApplications = async () => {
        setLoadingApplications(true);
        try {
            const response = await authAxios.get(`${apiBaseUrl}/api/leaves/my`);
            // Format dates and calculate duration for display
            const formattedApplications = response.data.map(app => ({
                ...app,
                from_date: moment(app.from_date).format('YYYY-MM-DD'),
                to_date: moment(app.to_date).format('YYYY-MM-DD'),
                duration: calculateLeaveDuration(app.from_date, app.to_date, app.is_half_day)
            }));
            setLeaveApplications(formattedApplications);
        } catch (error) {
            console.error("Error fetching leave applications:", error.response?.data?.message || error.message);
            showMessage(`Error fetching leave applications: ${error.response?.data?.message || error.message}`, "error");
        } finally {
            setLoadingApplications(false);
        }
    };

    // Effect to fetch leave applications on component mount or token change
    React.useEffect(() => {
        if (accessToken) {
            fetchLeaveApplications();
        }
    }, [accessToken]);

    // Function to determine and display the balance impact
    const getLeaveImpactDisplay = (application) => {
        const { status, duration, leave_type_name, is_paid } = application;
        let impactText = '';

        if (status === 'approved') {
            const currentBalanceRecord = leaveBalances.find(b => b.leave_type === leave_type_name);
            const currentBalance = currentBalanceRecord ? parseFloat(currentBalanceRecord.current_balance) : 0;

            if (is_paid) {
                // For paid leaves, check if the current balance can cover it
                if (currentBalance >= duration) {
                    impactText = `-${duration} days (Paid Leave)`;
                } else if (currentBalance > 0 && currentBalance < duration) {
                    const paidPortion = currentBalance;
                    const lopPortion = duration - paidPortion;
                    impactText = `-${paidPortion} days (Paid), -${lopPortion} days (LOP)`;
                } else { // currentBalance is 0 or negative
                    impactText = `-${duration} days (LOP)`; // Entire leave is LOP
                }
            } else {
                // For unpaid leave types, it's always LOP
                impactText = `-${duration} days (Unpaid Leave/LOP)`;
            }
        } else if (status === 'pending') {
            impactText = `-${duration} days (Pending)`;
        } else if (status === 'rejected') {
            impactText = `No impact (Rejected)`;
        } else if (status === 'cancelled') {
            impactText = `+${duration} days (Refunded)`; // Indicate refund for cancelled approved leaves
        } else if (status === 'cancellation_pending') {
            impactText = `-${duration} days (Cancellation Pending)`;
        } else {
            impactText = 'N/A';
        }
        return impactText;
    };


    if (loadingApplications) {
        return <p className="text-gray-500 dark:text-gray-400">Loading your leave applications...</p>;
    }

    return (
        <section className="mt-8 p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700">
            <h4 className="text-lg font-medium mb-4">My Leave Applications</h4>
            {leaveApplications.length > 0 ? (
                <div className="overflow-x-auto rounded-lg shadow-md">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Leave Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">From Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">To Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Duration (Days)</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Reason</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Balance Impact</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Admin Comment</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {leaveApplications.map(app => (
                                <tr key={app.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{app.leave_type_name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{app.from_date}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{app.to_date}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{app.duration} {app.is_half_day ? '(Half Day)' : ''}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300 max-w-xs overflow-hidden text-ellipsis">{app.reason}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 capitalize">{app.status.replace(/_/g, ' ')}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                        {getLeaveImpactDisplay(app)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300 max-w-xs overflow-hidden text-ellipsis">{app.admin_comment || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        {(app.status === 'pending' || app.status === 'approved') && (
                                            <button
                                                onClick={() => onCancelRequest(app.id)}
                                                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors duration-200"
                                            >
                                                Request Cancellation
                                            </button>
                                        )}
                                        {app.status === 'cancellation_pending' && (
                                            <span className="text-yellow-600 dark:text-yellow-400">Cancellation Pending</span>
                                        )}
                                        {(app.status === 'rejected' || app.status === 'cancelled' || app.status === 'overridden_by_correction') && (
                                            <span className="text-gray-500 dark:text-gray-400">No action needed</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="text-gray-500 dark:text-gray-400">No leave applications found.</p>
            )}
        </section>
    );
};

// Make the component globally accessible
window.MyLeaves = MyLeaves;
