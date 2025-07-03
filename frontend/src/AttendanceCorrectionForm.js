// AttendanceCorrectionForm.js
// REMOVE all local import/export statements when using type="text/babel" in index.html

const AttendanceCorrectionForm = ({ showMessage, apiBaseUrl, accessToken, onSubmit }) => {
    const [date, setDate] = React.useState('');
    const [expectedCheckIn, setExpectedCheckIn] = React.useState('');
    const [expectedCheckOut, setExpectedCheckOut] = React.useState('');
    const [reason, setReason] = React.useState('');

    // Axios instance with token for authenticated requests
    const authAxios = axios.create({
        baseURL: apiBaseUrl,
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!date || !expectedCheckIn || !reason) {
            showMessage('Please fill in date, expected check-in, and reason.', 'error');
            return;
        }

        const correctionData = {
            date,
            expected_check_in: expectedCheckIn,
            expected_check_out: expectedCheckOut || null, // Allow null if not provided
            reason
        };

        // Call the onSubmit prop which is provided by EmployeeDashboard.js
        await onSubmit(correctionData);

        // Clear form fields after submission
        setDate('');
        setExpectedCheckIn('');
        setExpectedCheckOut('');
        setReason('');
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="correctionDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
                <input
                    type="date"
                    id="correctionDate"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                />
            </div>
            <div>
                <label htmlFor="expectedCheckIn" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Expected Check-in Time</label>
                <input
                    type="time"
                    id="expectedCheckIn"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={expectedCheckIn}
                    onChange={(e) => setExpectedCheckIn(e.target.value)}
                    required
                />
            </div>
            <div>
                <label htmlFor="expectedCheckOut" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Expected Check-out Time (Optional)</label>
                <input
                    type="time"
                    id="expectedCheckOut"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={expectedCheckOut}
                    onChange={(e) => setExpectedCheckOut(e.target.value)}
                />
            </div>
            <div>
                <label htmlFor="reason" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Reason for Correction</label>
                <textarea
                    id="reason"
                    rows="3"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                ></textarea>
            </div>
            <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 shadow-md"
            >
                Submit Correction Request
            </button>
        </form>
    );
};


