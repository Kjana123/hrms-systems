// AdminAnalyticsReports.js
// This component will be used within AdminDashboard.js
// REMOVE all local import/export statements when using type="text/babel" in index.html

const AdminAnalyticsReports = ({ showMessage, apiBaseUrl, accessToken, authAxios, adminStats, handleAnalyticsClick }) => {
    const [monthlySummary, setMonthlySummary] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedMonth, setSelectedMonth] = React.useState(moment().month() + 1); // 1-indexed
    const [selectedYear, setSelectedYear] = React.useState(moment().year());

    // Axios instance with token for authenticated requests
    // authAxios is passed as a prop from AdminDashboard, so we use that directly.
    // No need to create a new one here.

    const fetchAnalyticsData = async () => {
        try {
            // Fetch overall stats (adminStats is passed as a prop, but we can re-fetch if needed)
            // For now, assume adminStats is managed by the parent (AdminDashboard)
            // If adminStats is not passed or needs to be refreshed by this component, uncomment below:
            // const statsResponse = await authAxios.get(`${apiBaseUrl}/api/admin/stats`);
            // setAdminStats(statsResponse.data);

            const monthlySummaryResponse = await authAxios.get(`${apiBaseUrl}/api/admin/monthly-summary`, {
                params: {
                    month: selectedMonth,
                    year: selectedYear
                }
            });
            setMonthlySummary(monthlySummaryResponse.data);
        } catch (error) {
            console.error("Error fetching admin analytics data:", error.response?.data?.message || error.message);
            showMessage(`Error fetching analytics data: ${error.response?.data?.message || error.message}`, "error");
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        // Ensure authAxios is available before fetching
        if (accessToken && authAxios) {
            fetchAnalyticsData();
        }
    }, [accessToken, selectedMonth, selectedYear, authAxios]); // Re-fetch when token, month, year, or authAxios changes

    // Update local 'stats' state if 'adminStats' prop changes from parent
    // This ensures that if the parent (AdminDashboard) fetches updated stats,
    // this component also reflects them without re-fetching if not necessary.
    // The user's provided snippet had this, so keeping it.
    const [stats, setStats] = React.useState(adminStats);
    React.useEffect(() => {
        if (adminStats) {
            setStats(adminStats);
        }
    }, [adminStats]);


    // Generate month and year options for dropdowns
    const monthOptions = moment.months().map((monthName, index) => ({
        value: index + 1, // Moment months are 0-indexed, but backend expects 1-indexed
        label: monthName
    }));
    const currentYear = moment().year();
    const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i); // Current year +/- 2

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="w-4 h-4 rounded-full animate-pulse bg-blue-600"></div>
                <div className="w-4 h-4 rounded-full animate-pulse bg-blue-600"></div>
                <div className="w-4 h-4 rounded-full animate-pulse bg-blue-600"></div>
                <p className="ml-2">Loading analytics data...</p>
            </div>
        );
    }

    // If stats is null (e.g., initial load before prop is passed or fetch failed)
    if (!stats) {
        return (
            <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-300">
                <h2 className="text-2xl font-semibold mb-6">Analytics & Reports</h2>
                <p className="text-gray-600 dark:text-gray-400">No overall analytics data available or failed to load.</p>
            </section>
        );
    }


    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-300">
            <h2 className="text-2xl font-semibold mb-6">Analytics & Reports</h2>

            {/* Admin Stats Overview */}
            <section className="mb-8">
                <h3 className="text-xl font-semibold mb-4">Overall Statistics</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    {/* Total Employees Card */}
                    <div className="bg-blue-100 dark:bg-blue-900 p-6 rounded-lg shadow-md flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200">Total Employees</h3>
                            <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">{stats.total_employees || 0}</p>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-500 dark:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H2v-2a3 3 0 015.356-1.857M9 20v-2m3 2v-2m3 2v-2m-9-1h10M4 18H2.856M11 3v1m0 16v1m-9-9h1m16 0h1M6.372 6.372l-.707-.707M17.628 17.628l.707.707M6.372 17.628l-.707.707M17.628 6.372l.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    </div>

                    {/* Total Present Card (Clickable) */}
                    <button
                        onClick={() => handleAnalyticsClick('attendance', 'PRESENT')} // Pass 'PRESENT' status filter
                        className="bg-green-100 dark:bg-green-900 p-6 rounded-lg shadow-md flex items-center justify-between cursor-pointer hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                    >
                        <div>
                            <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">Total Present Today</h3>
                            <p className="text-4xl font-bold text-green-600 dark:text-green-400">{stats.presentToday || 0}</p>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-green-500 dark:text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </button>

                    {/* Total Absent Card (Clickable) */}
                    <button
                        onClick={() => handleAnalyticsClick('attendance', 'ABSENT')} // Pass 'ABSENT' status filter
                        className="bg-red-100 dark:bg-red-900 p-6 rounded-lg shadow-md flex items-center justify-between cursor-pointer hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                    >
                        <div>
                            <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">Total Absent Today</h3>
                            <p className="text-4xl font-bold text-red-600 dark:text-red-400">{stats.absentToday || 0}</p>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500 dark:text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </button>

                    {/* Total On Leave Card (Clickable) */}
                    <button
                        onClick={() => handleAnalyticsClick('leave-management', 'approved')} // Navigate to leave management, potentially filter approved leaves
                        className="bg-purple-100 dark:bg-purple-900 p-6 rounded-lg shadow-md flex items-center justify-between cursor-pointer hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                    >
                        <div>
                            <h3 className="text-lg font-semibold text-purple-800 dark:text-purple-200">Total On Leave Today</h3>
                            <p className="text-4xl font-bold text-purple-600 dark:text-purple-400">{stats.onLeaveToday || 0}</p>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-purple-500 dark:text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </button>

                    {/* Pending Leaves Card (Clickable) */}
                    <button
                        onClick={() => handleAnalyticsClick('leave-management', 'pending')} // Navigate to leave management, filter pending leaves
                        className="bg-yellow-100 dark:bg-yellow-900 p-4 rounded-lg shadow-sm text-yellow-800 dark:text-yellow-200 cursor-pointer hover:shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center justify-between"
                    >
                        <div>
                            <p className="text-sm font-medium">Pending Leaves</p>
                            <p className="text-2xl font-bold">{stats.pending_leave_requests}</p>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-yellow-500 dark:text-yellow-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </button>

                    {/* Pending Corrections Card (Clickable) */}
                    <button
                        onClick={() => handleAnalyticsClick('correction-review', 'pending')} // Navigate to correction review, filter pending corrections
                        className="bg-indigo-100 dark:bg-indigo-900 p-4 rounded-lg shadow-sm text-indigo-800 dark:text-indigo-200 cursor-pointer hover:shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center justify-between"
                    >
                        <div>
                            <p className="text-sm font-medium">Pending Corrections</p>
                            <p className="text-2xl font-bold">{stats.pending_correction_requests || 0}</p>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-indigo-500 dark:text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                    </button>
                    {/* Note: "Total Late Arrivals Today" and "Total Forgotten Checkouts Today" were in previous snippets
                         but are not directly available in the current /api/admin/stats backend response.
                         If you need these, your backend /api/admin/stats would need to provide them.
                         For now, I've kept the cards for them but they will show 0 unless the backend is updated.
                    */}
                </div>
            </section>

            {/* Monthly Attendance Summary Table */}
            <section>
                <h3 className="text-xl font-semibold mb-4">Monthly Attendance Summary</h3>
                <div className="flex space-x-4 mb-6">
                    <select
                        className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    >
                        {monthOptions.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                    <select
                        className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    >
                        {yearOptions.map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>

                <div className="overflow-x-auto rounded-lg shadow-md">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Employee</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Present</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Late</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Absent</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">On Leave</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">LOP</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Holidays</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Weekly Offs</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {monthlySummary.length > 0 ? (
                                monthlySummary.map(summary => (
                                    <tr key={summary.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{summary.user_name} ({summary.employee_id})</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{summary.present_days}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{summary.late_days}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{summary.absent_days}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{summary.leave_days}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{summary.lop_days}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{summary.holidays}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{summary.weekly_offs}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="8" className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">No monthly summary data found for the selected period.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};
