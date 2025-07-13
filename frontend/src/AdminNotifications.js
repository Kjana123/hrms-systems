// AdminNotifications.js
// This component will be used within AdminDashboard.js
// REMOVE all local import/export statements when using type="text/babel" in index.html

const AdminNotifications = ({
    showMessage,
    apiBaseUrl,
    accessToken,
    darkMode // Added darkMode prop for consistent styling
}) => {
    const [notificationMessage, setNotificationMessage] = React.useState('');
    const [notificationType, setNotificationType] = React.useState('global'); // 'global' or 'specific'
    const [selectedEmployeeId, setSelectedEmployeeId] = React.useState('');
    const [allEmployees, setAllEmployees] = React.useState([]);
    const [loadingEmployees, setLoadingEmployees] = React.useState(true);
    const [sendingNotification, setSendingNotification] = React.useState(false); // New state for send button loading

    // Axios instance with token for authenticated requests
    const authAxios = axios.create({
        baseURL: apiBaseUrl,
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    // Fetch employees on component mount or when accessToken changes
    React.useEffect(() => {
        const fetchEmployees = async () => {
            setLoadingEmployees(true); // Set loading true before fetch
            try {
                // Ensure the API endpoint for fetching users is correct for your backend
                const response = await authAxios.get(`${apiBaseUrl}/api/admin/users`);
                setAllEmployees(response.data);
            } catch (error) {
                console.error("Error fetching employees for notifications:", error.response?.data?.message || error.message);
                showMessage(`Error fetching employees: ${error.response?.data?.message || error.message}`, "error");
                setAllEmployees([]); // Clear employees on error
            } finally {
                setLoadingEmployees(false); // Set loading false after fetch
            }
        };

        if (accessToken) {
            fetchEmployees();
        }
    }, [accessToken, apiBaseUrl]); // Added apiBaseUrl to dependency array

    const handleSendNotification = async e => {
    e.preventDefault();

    if (!notificationMessage.trim()) {
        showMessage('Notification message cannot be empty.', 'error');
        return;
    }

    let endpoint = '';
    let payload = {
        message: notificationMessage
    };

    if (notificationType === 'global') {
        // CORRECTED: Removed '/api' prefix from the global notification endpoint
        endpoint = `${apiBaseUrl}/admin/notifications/global`;
    } else { // 'specific'
        if (!selectedEmployeeId) {
            showMessage('Please select an employee for specific notification.', 'error');
            return;
        }
        endpoint = `${apiBaseUrl}/api/admin/notifications/send`;
        payload.userId = selectedEmployeeId; // Changed from user_id to userId to match backend
    }

    setSendingNotification(true);
    try {
        await authAxios.post(endpoint, payload);
        showMessage('Notification sent successfully!', 'success');
        setNotificationMessage('');
        setSelectedEmployeeId('');
        setNotificationType('global');
    } catch (error) {
        console.error("Error sending notification:", error.response?.data?.message || error.message);
        showMessage(`Failed to send notification: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
        setSendingNotification(false);
    }
};

    // Loading state UI
    if (loadingEmployees) {
        return (
            <div className={`flex items-center justify-center p-8 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                <div className="flex space-x-2">
                    <div className="w-4 h-4 rounded-full animate-pulse bg-blue-600"></div>
                    <div className="w-4 h-4 rounded-full animate-pulse bg-blue-600 animation-delay-200"></div>
                    <div className="w-4 h-4 rounded-full animate-pulse bg-blue-600 animation-delay-400"></div>
                </div>
                <p className="ml-4">Loading employee data for notifications...</p>
            </div>
        );
    }

    return (
        <div className={`p-6 rounded-xl shadow-lg ${darkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'}`}>
            <h2 className="text-2xl font-bold mb-6 text-blue-600 dark:text-blue-300">Send Notifications</h2>

            <form onSubmit={handleSendNotification} className="space-y-6">
                {/* Notification Type Selection */}
                <div>
                    <label htmlFor="notificationType" className="block text-sm font-medium mb-1">Notification Type</label>
                    <select
                        id="notificationType"
                        className={`w-full px-4 py-2 rounded-lg border ${darkMode ? 'bg-gray-800 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'} focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200`}
                        value={notificationType}
                        onChange={e => setNotificationType(e.target.value)}
                    >
                        <option value="global">Global (to all employees)</option>
                        <option value="specific">Specific (to a selected employee)</option>
                    </select>
                </div>

                {/* Employee Selection (conditionally rendered for specific notifications) */}
                {notificationType === 'specific' && (
                    <div>
                        <label htmlFor="employeeSelect" className="block text-sm font-medium mb-1">Select Employee</label>
                        <select
                            id="employeeSelect"
                            className={`w-full px-4 py-2 rounded-lg border ${darkMode ? 'bg-gray-800 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'} focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200`}
                            value={selectedEmployeeId}
                            onChange={e => setSelectedEmployeeId(e.target.value)}
                            required // HTML5 required attribute
                        >
                            <option value="">-- Select an Employee --</option> {/* Empty value for default option */}
                            {allEmployees.map(emp => (
                                <option key={emp.id} value={emp.id}>
                                    {emp.name} ({emp.employee_id || emp.id})
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Notification Message Textarea */}
                <div>
                    <label htmlFor="notificationMessage" className="block text-sm font-medium mb-1">Message</label>
                    <textarea
                        id="notificationMessage"
                        rows="4"
                        className={`w-full px-4 py-2 rounded-lg border ${darkMode ? 'bg-gray-800 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'} focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200`}
                        placeholder="Type your notification message here..."
                        value={notificationMessage}
                        onChange={e => setNotificationMessage(e.target.value)}
                        required // HTML5 required attribute
                    ></textarea>
                </div>

                {/* Send Button */}
                <button
                    type="submit"
                    disabled={sendingNotification || !notificationMessage.trim() || (notificationType === 'specific' && !selectedEmployeeId)}
                    className={`w-full py-3 px-6 rounded-xl font-semibold transition-all duration-300 shadow-md transform hover:scale-105
                        ${(sendingNotification || !notificationMessage.trim() || (notificationType === 'specific' && !selectedEmployeeId))
                            ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                            : 'bg-gradient-to-r from-blue-600 to-blue-800 text-white hover:from-blue-700 hover:to-blue-900'
                        }`}
                >
                    {sendingNotification ? 'Sending...' : 'Send Notification'}
                </button>
            </form>
        </div>
    );
};

// Make the component globally accessible
window.AdminNotifications = AdminNotifications;
