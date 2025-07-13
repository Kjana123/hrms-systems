// EmployeePayslips.js
// This component is designed to be used within the EmployeeDashboard.jsx environment,
// assuming React, ReactDOM, moment, axios, and saveAs are globally available.

const EmployeePayslips = ({ showMessage, apiBaseUrl, accessToken }) => {
    const [payslips, setPayslips] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    // Helper function to safely format currency values
    // Ensures the value is a number before calling toFixed, provides 0.00 if invalid
    const formatCurrency = (value) => {
        const num = parseFloat(value);
        return isNaN(num) ? '0.00' : num.toFixed(2);
    };

    // Create an Axios instance with the access token for authenticated requests
    const authAxios = React.useMemo(() => {
        return axios.create({
            baseURL: apiBaseUrl, // Set the base URL here
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
    }, [apiBaseUrl, accessToken]);

    // Function to fetch employee payslips
    const fetchPayslips = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Corrected endpoint to match backend: /api/employee/payslips/my
            const endpoint = '/api/employee/payslips/my';
            console.log(`Fetching payslips from: ${apiBaseUrl}${endpoint}`); // Log the full URL
            const response = await authAxios.get(endpoint); // Corrected: use relative path
            setPayslips(response.data);
            console.log("Fetched employee payslips:", response.data);
        } catch (err) {
            console.error("Error fetching payslips:", err.response?.data?.message || err.message);
            setError(err.response?.data?.message || "Failed to fetch payslips.");
            showMessage(err.response?.data?.message || "Failed to fetch payslips.", "error");
        } finally {
            setLoading(false);
        }
    }, [apiBaseUrl, authAxios, showMessage]); // Dependencies for useCallback

    // Effect hook to fetch payslips when the component mounts or dependencies change
    React.useEffect(() => {
        if (accessToken) {
            fetchPayslips();
        }
    }, [accessToken, fetchPayslips]); // Re-fetch if accessToken changes

    // Handle PDF download
    const handleDownload = async (payslipId) => { // Made async to await the axios call
        try {
            // CORRECTED: Use the employee-specific download endpoint
            const downloadUrl = `/api/employee/payslips/${payslipId}/download`; 
            console.log(`Attempting to download from: ${apiBaseUrl}${downloadUrl}`); // Log the full URL
            showMessage("Downloading payslip...", "info");

            // Use authAxios to ensure the Authorization header is sent
            const response = await authAxios.get(downloadUrl, {
                responseType: 'blob' // Important for downloading files
            });

            // Extract filename from Content-Disposition header, or create a default
            const contentDisposition = response.headers['content-disposition'];
            let filename = `payslip_${payslipId}.pdf`;
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1];
                }
            }
            
            // Use saveAs (from FileSaver.js, assumed to be globally available) to trigger download
            saveAs(response.data, filename);

            showMessage("Payslip downloaded successfully!", "success");
        } catch (error) {
            console.error("Error downloading payslip:", error.response?.data?.message || error.message);
            showMessage(`Failed to download payslip: ${error.response?.data?.message || error.message}`, "error");
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-8">
                <p className="text-lg text-gray-600 dark:text-gray-300">Loading payslips...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-8 text-red-600 dark:text-red-400">
                <p>Error: {error}</p>
                <button
                    onClick={fetchPayslips}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
            {payslips.length === 0 ? (
                <p className="text-center py-8 text-gray-500 dark:text-gray-400">No payslips available yet.</p>
            ) : (
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Month/Year</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Gross Earnings</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Net Pay</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Generated On</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                        {payslips.map((payslip) => (
                            <tr key={payslip.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                    {moment().month(payslip.payslip_month - 1).format('MMMM')} {payslip.payslip_year}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                    ₹{formatCurrency(payslip.gross_earnings)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                    ₹{formatCurrency(payslip.net_pay)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                    {payslip.created_at ? moment(payslip.created_at).format('YYYY-MM-DD HH:mm') : 'N/A'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    {payslip.file_path ? (
                                        <button
                                            onClick={() => handleDownload(payslip.id)}
                                            className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200 px-3 py-1 rounded-md border border-indigo-500 hover:border-indigo-700 transition-colors duration-200"
                                        >
                                            Download PDF
                                        </button>
                                    ) : (
                                        <span className="text-gray-400 dark:text-gray-500">No PDF</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

// Make the component globally accessible for the Babel environment
window.EmployeePayslips = EmployeePayslips;
