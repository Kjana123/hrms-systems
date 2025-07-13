// WeeklyOffManagement.js
// This component will be used within AdminDashboard.js
// REMOVE all local import/export statements when using type="text/babel" in index.html

const WeeklyOffManagement = ({ showMessage, apiBaseUrl, accessToken }) => {
    const [weeklyOffs, setWeeklyOffs] = React.useState([]);
    const [allEmployees, setAllEmployees] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedEmployeeId, setSelectedEmployeeId] = React.useState('');
    const [selectedDays, setSelectedDays] = React.useState([]); // CHANGED: Now an array for multiple selections
    const [startDate, setStartDate] = React.useState(''); // New: Start Date for weekly off
    const [endDate, setEndDate] = React.useState('');     // New: End Date for weekly off

    // Axios instance with token for authenticated requests
    const authAxios = axios.create({
        baseURL: apiBaseUrl,
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    // Helper to map day name to day number (0 for Sunday, 1 for Monday, ..., 6 for Saturday)
    const dayNameToNumber = {
        'Sunday': 0,
        'Monday': 1,
        'Tuesday': 2,
        'Wednesday': 3,
        'Thursday': 4,
        'Friday': 5,
        'Saturday': 6
    };

    // Helper to map day number to day name
    const dayNumberToName = {
        0: 'Sunday',
        1: 'Monday',
        2: 'Tuesday',
        3: 'Wednesday',
        4: 'Thursday',
        5: 'Friday',
        6: 'Saturday'
    };

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

    // NEW: Handle checkbox changes for multiple day selection
    const handleDayChange = (e) => {
        const dayValue = parseInt(e.target.value);
        if (e.target.checked) {
            setSelectedDays(prev => [...prev, dayValue].sort((a, b) => a - b)); // Add and sort
        } else {
            setSelectedDays(prev => prev.filter(day => day !== dayValue)); // Remove
        }
    };

    const handleAddWeeklyOff = async (e) => {
        e.preventDefault();
        if (!selectedEmployeeId || selectedDays.length === 0 || !startDate) { // Check if selectedDays array is not empty
            showMessage('Please select an employee, at least one day, and a start date for the weekly off.', 'error');
            return;
        }

        try {
            await authAxios.post(`${apiBaseUrl}/api/admin/weekly-offs`, {
                user_id: selectedEmployeeId,
                weekly_off_days: selectedDays, // CHANGED: Send the array of selected days
                effective_date: startDate,     // Use startDate as effective_date
                end_date: endDate || null      // Send endDate if present, otherwise null
            });
            showMessage('Weekly off added successfully!', 'success');
            setSelectedEmployeeId('');
            setSelectedDays([]); // Clear selected days after successful add
            setStartDate(''); // Clear dates after successful add
            setEndDate('');   // Clear dates after successful add
            fetchWeeklyOffsAndEmployees(); // Re-fetch to update the list
        } catch (error) {
            console.error("Error adding weekly off:", error.response?.data?.message || error.message);
            showMessage(`Failed to add weekly off: ${error.response?.data?.message || error.message}`, 'error');
        }
    };

    const handleDeleteWeeklyOff = async (weeklyOffId) => {
        // IMPORTANT: Replace window.confirm with a custom modal for better UX and consistency
        // For now, keeping window.confirm as per previous code, but recommend replacing.
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Day(s) of Week</label>
                    <div className="mt-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2"> {/* Grid for checkboxes */}
                        {daysOfWeek.map((dayName, index) => (
                            <label key={index} className="inline-flex items-center">
                                <input
                                    type="checkbox"
                                    value={index} // Day number (0-6)
                                    checked={selectedDays.includes(index)}
                                    onChange={handleDayChange}
                                    className="form-checkbox h-5 w-5 text-blue-600 rounded"
                                />
                                <span className="ml-2 text-gray-700 dark:text-gray-300">{dayName}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <div>
                    <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Effective Date</label>
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
                    <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">End Date (Optional)</label>
                    <input
                        type="date"
                        id="endDate"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
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
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Weekly Off Days</th> {/* Updated header */}
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Effective Date</th> {/* Updated header */}
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
                                    {/* Display weekly_off_days as comma-separated names */}
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                        {off.weekly_off_days && off.weekly_off_days.length > 0
                                            ? off.weekly_off_days.map(dayNum => dayNumberToName[dayNum]).join(', ')
                                            : 'N/A'}
                                    </td>
                                    {/* Display effective_date */}
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{off.effective_date ? moment(off.effective_date).format('YYYY-MM-DD') : 'N/A'}</td>
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

// Make the component globally accessible
window.WeeklyOffManagement = WeeklyOffManagement;
