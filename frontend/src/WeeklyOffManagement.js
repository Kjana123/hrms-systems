// WeeklyOffManagement.js
// This component will be used within AdminDashboard.js
// REMOVE all local import/export statements when using type="text/babel" in index.html

const WeeklyOffManagement = ({ showMessage, apiBaseUrl, accessToken }) => {
    const [weeklyOffs, setWeeklyOffs] = React.useState([]);
    const [allEmployees, setAllEmployees] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedEmployeeId, setSelectedEmployeeId] = React.useState('');
    const [selectedDay, setSelectedDay] = React.useState(''); // 'Monday', 'Tuesday', etc.
    const [startDate, setStartDate] = React.useState(''); // New: Start Date for weekly off
    const [endDate, setEndDate] = React.useState('');     // New: End Date for weekly off

    // Axios instance with token for authenticated requests
    const authAxios = axios.create({
        baseURL: apiBaseUrl,
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    const fetchWeeklyOffsAndEmployees = async () => {
        try {
            const [weeklyOffsResponse, employeesResponse] = await Promise.all([
                authAxios.get(`${apiBaseUrl}/api/admin/weekly-offs`),
                authAxios.get(`${apiBaseUrl}/api/admin/users`)
            ]);
            setWeeklyOffs(weeklyOffsResponse.data);
            setAllEmployees(employeesResponse.data);
        } catch (error) {
            console.error("Error fetching weekly offs or employees:", error.response?.data?.message || error.message);
            showMessage(`Error fetching data: ${error.response?.data?.message || error.message}`, "error");
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        if (accessToken) {
            fetchWeeklyOffsAndEmployees();
        }
    }, [accessToken]); // Re-fetch when accessToken changes

    const handleAddWeeklyOff = async (e) => {
        e.preventDefault();
        if (!selectedEmployeeId || !selectedDay || !startDate || !endDate) {
            showMessage('Please select an employee, a day, and a start/end date for the weekly off.', 'error');
            return;
        }
        try {
            await authAxios.post(`${apiBaseUrl}/api/admin/weekly-offs`, {
                user_id: selectedEmployeeId,
                day_of_week: selectedDay,
                start_date: startDate, // Send new start_date
                end_date: endDate      // Send new end_date
            });
            showMessage('Weekly off added successfully!', 'success');
            setSelectedEmployeeId('');
            setSelectedDay('');
            setStartDate(''); // Clear dates after successful add
            setEndDate('');   // Clear dates after successful add
            fetchWeeklyOffsAndEmployees(); // Re-fetch to update the list
        } catch (error) {
            console.error("Error adding weekly off:", error.response?.data?.message || error.message);
            showMessage(`Failed to add weekly off: ${error.response?.data?.message || error.message}`, 'error');
        }
    };

    const handleDeleteWeeklyOff = async (weeklyOffId) => {
        if (window.confirm('Are you sure you want to delete this weekly off assignment?')) {
            try {
                await authAxios.delete(`${apiBaseUrl}/api/admin/weekly-offs/${weeklyOffId}`);
                showMessage('Weekly off deleted successfully!', 'success');
                fetchWeeklyOffsAndEmployees(); // Re-fetch to update the list
            } catch (error) {
                console.error("Error deleting weekly off:", error.response?.data?.message || error.message);
                showMessage(`Failed to delete weekly off: ${error.response?.data?.message || error.message}`, "error");
            }
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="w-4 h-4 rounded-full animate-pulse bg-blue-600"></div>
                <div className="w-4 h-4 rounded-full animate-pulse bg-blue-600"></div>
                <div className="w-4 h-4 rounded-full animate-pulse bg-blue-600"></div>
                <p className="ml-2">Loading weekly off data...</p>
            </div>
        );
    }

    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-300">
            <h2 className="text-2xl font-semibold mb-6">Manage Weekly Offs</h2>

            {/* Add New Weekly Off Form */}
            <form onSubmit={handleAddWeeklyOff} className="space-y-4 mb-8 p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700">
                <h3 className="text-lg font-medium mb-4">Assign Weekly Off</h3>
                <div>
                    <label htmlFor="employeeSelect" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Employee</label>
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
                <div>
                    <label htmlFor="daySelect" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Day of Week</label>
                    <select
                        id="daySelect"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={selectedDay}
                        onChange={(e) => setSelectedDay(e.target.value)}
                        required
                    >
                        <option value="">Select Day</option>
                        {daysOfWeek.map(day => (
                            <option key={day} value={day}>{day}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Start Date</label>
                    <input
                        type="date"
                        id="startDate"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">End Date</label>
                    <input
                        type="date"
                        id="endDate"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        required
                    />
                </div>
                <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 shadow-md"
                >
                    Assign Weekly Off
                </button>
            </form>

            {/* Existing Weekly Offs List */}
            <h3 className="text-xl font-semibold mb-4">Assigned Weekly Offs</h3>
            <div className="overflow-x-auto rounded-lg shadow-md">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Employee</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Day of Week</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Start Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">End Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {weeklyOffs.length > 0 ? (
                            weeklyOffs.map(off => (
                                <tr key={off.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                        {allEmployees.find(emp => emp.id === off.user_id)?.name || 'Unknown Employee'}
                                        ({allEmployees.find(emp => emp.id === off.user_id)?.employee_id || 'N/A'})
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{off.day_of_week}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{off.start_date ? moment(off.start_date).format('YYYY-MM-DD') : 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{off.end_date ? moment(off.end_date).format('YYYY-MM-DD') : 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <button
                                            onClick={() => handleDeleteWeeklyOff(off.id)}
                                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">No weekly offs assigned yet.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
