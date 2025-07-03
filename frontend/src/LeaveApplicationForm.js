// LeaveApplicationForm.js
// REMOVE all local import/export statements when using type="text/babel" in index.html

const LeaveApplicationForm = ({ showMessage, apiBaseUrl, accessToken, onSubmit }) => {
    const [leaveTypes, setLeaveTypes] = React.useState([]);
    const [selectedLeaveTypeId, setSelectedLeaveTypeId] = React.useState('');
    const [fromDate, setFromDate] = React.useState('');
    const [toDate, setToDate] = React.useState('');
    const [reason, setReason] = React.useState('');
    const [isHalfDay, setIsHalfDay] = React.useState(false);
    const [loadingLeaveTypes, setLoadingLeaveTypes] = React.useState(true);

    // Axios instance with token for authenticated requests
    const authAxios = axios.create({
        baseURL: apiBaseUrl,
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    React.useEffect(() => {
        const fetchLeaveTypes = async () => {
            try {
                // Corrected: Use the public endpoint for fetching leave types for employees
                const response = await authAxios.get(`${apiBaseUrl}/api/leaves/types`);
                setLeaveTypes(response.data);
                if (response.data.length > 0) {
                    setSelectedLeaveTypeId(response.data[0].id); // Select first type by default
                }
            } catch (error) {
                console.error("Error fetching leave types:", error.response?.data?.message || error.message);
                showMessage(`Error fetching leave types: ${error.response?.data?.message || error.message}`, "error");
            } finally {
                setLoadingLeaveTypes(false);
            }
        };

        if (accessToken) {
            fetchLeaveTypes();
        }
    }, [accessToken]); // Re-fetch if accessToken changes

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedLeaveTypeId || !fromDate || !toDate || !reason) {
            showMessage('Please fill in all required leave application fields.', 'error');
            return;
        }

        const leaveData = {
            leave_type_id: selectedLeaveTypeId,
            from_date: fromDate,
            to_date: toDate,
            reason,
            is_half_day: isHalfDay
        };

        // Call the onSubmit prop which is provided by EmployeeDashboard.js
        await onSubmit(leaveData);

        // Clear form fields after submission
        setSelectedLeaveTypeId(leaveTypes.length > 0 ? leaveTypes[0].id : '');
        setFromDate('');
        setToDate('');
        setReason('');
        setIsHalfDay(false);
    };

    if (loadingLeaveTypes) {
        return <p className="text-gray-500 dark:text-gray-400">Loading leave types...</p>;
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4 mb-8 p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700">
            <h4 className="text-lg font-medium mb-4">Apply for New Leave</h4>
            <div>
                <label htmlFor="leaveType" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Leave Type</label>
                <select
                    id="leaveType"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={selectedLeaveTypeId}
                    onChange={(e) => setSelectedLeaveTypeId(e.target.value)}
                    required
                >
                    {leaveTypes.length === 0 && <option value="">No leave types available</option>}
                    {leaveTypes.map(type => (
                        <option key={type.id} value={type.id}>{type.name}</option>
                    ))}
                </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="fromDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">From Date</label>
                    <input
                        type="date"
                        id="fromDate"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label htmlFor="toDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">To Date</label>
                    <input
                        type="date"
                        id="toDate"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        required
                    />
                </div>
            </div>
            <div>
                <label htmlFor="reason" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Reason</label>
                <textarea
                    id="reason"
                    rows="3"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                ></textarea>
            </div>
            <div className="flex items-center">
                <input
                    id="isHalfDay"
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
                    checked={isHalfDay}
                    onChange={(e) => setIsHalfDay(e.target.checked)}
                />
                <label htmlFor="isHalfDay" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">Apply for Half Day</label>
            </div>
            <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 shadow-md"
            >
                Submit Leave Application
            </button>
        </form>
    );
};

