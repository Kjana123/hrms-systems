// AdminNotifications.js
// This component will be used within AdminDashboard.js
// REMOVE all local import/export statements when using type="text/babel" in index.html

const AdminNotifications = ({ showMessage, apiBaseUrl, accessToken }) => {
    const [notificationMessage, setNotificationMessage] = React.useState('');
    const [notificationType, setNotificationType] = React.useState('global'); // 'global' or 'specific'
    const [selectedEmployeeId, setSelectedEmployeeId] = React.useState('');
    const [allEmployees, setAllEmployees] = React.useState([]);
    const [loadingEmployees, setLoadingEmployees] = React.useState(true);

    // Axios instance with token for authenticated requests
    const authAxios = axios.create({
        baseURL: apiBaseUrl,
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    React.useEffect(() => {
        const fetchEmployees = async () => {
            try {
                const response = await authAxios.get(`${apiBaseUrl}/api/admin/users`);
                setAllEmployees(response.data);
            } catch (error) {
                console.error("Error fetching employees for notifications:", error.response?.data?.message || error.message);
                showMessage(`Error fetching employees: ${error.response?.data?.message || error.message}`, "error");
            } finally {
                setLoadingEmployees(false);
            }
        };

        if (accessToken) {
            fetchEmployees();
        }
    }, [accessToken]); // Re-fetch when accessToken changes

    const handleSendNotification = async (e) => {
        e.preventDefault();
        if (!notificationMessage) {
            showMessage('Notification message cannot be empty.', 'error');
            return;
        }

        let endpoint = '';
        let payload = { message: notificationMessage };

        if (notificationType === 'global') {
            endpoint = `${apiBaseUrl}/api/admin/notifications/global`;
        } else { // 'specific'
            if (!selectedEmployeeId) {
                showMessage('Please select an employee for specific notification.', 'error');
                return;
            }
            endpoint = `${apiBaseUrl}/api/admin/notifications/send`;
            payload.user_id = selectedEmployeeId;
        }

        try {
            await authAxios.post(endpoint, payload);
            showMessage('Notification sent successfully!', 'success');
            setNotificationMessage('');
            setSelectedEmployeeId('');
        } catch (error) {
            console.error("Error sending notification:", error.response?.data?.message || error.message);
            showMessage(`Failed to send notification: ${error.response?.data?.message || error.message}`, 'error');
        }
    };

    if (loadingEmployees) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="w-4 h-4 rounded-full animate-pulse bg-blue-600"></div>
                <div className="w-4 h-4 rounded-full animate-pulse bg-blue-600"></div>
                <div className="w-4 h-4 rounded-full animate-pulse bg-blue-600"></div>
                <p className="ml-2">Loading employee data for notifications...</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-300">
            <h2 className="text-2xl font-semibold mb-6">Send Notifications</h2>

            <form onSubmit={handleSendNotification} className="space-y-6">
                <div>
                    <label htmlFor="notificationType" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notification Type</label>
                    <select
                        id="notificationType"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={notificationType}
                        onChange={(e) => setNotificationType(e.target.value)}
                    >
                        <option value="global">Global (to all employees)</option>
                        <option value="specific">Specific (to a selected employee)</option>
                    </select>
                </div>

                {notificationType === 'specific' && (
                    <div>
                        <label htmlFor="employeeSelect" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Select Employee</label>
                        <select
                            id="employeeSelect"
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            value={selectedEmployeeId}
                            onChange={(e) => setSelectedEmployeeId(e.target.value)}
                            required
                        >
                            <option value="">Select Employee</option>
                            {allEmployees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_id})</option>
                            ))}
                        </select>
                    </div>
                )}

                <div>
                    <label htmlFor="notificationMessage" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Message</label>
                    <textarea
                        id="notificationMessage"
                        rows="4"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="Type your notification message here..."
                        value={notificationMessage}
                        onChange={(e) => setNotificationMessage(e.target.value)}
                        required
                    ></textarea>
                </div>

                <button
                    type="submit"
                    className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 shadow-md"
                >
                    Send Notification
                </button>
            </form>
        </div>
    );
};

