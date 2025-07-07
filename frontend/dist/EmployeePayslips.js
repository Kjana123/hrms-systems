// EmployeePayslips.js
// REMOVE all local import/export statements when using type="text/babel" in index.html

const EmployeePayslips = ({
  showMessage,
  apiBaseUrl,
  accessToken
}) => {
  const [payslips, setPayslips] = React.useState([]);
  const [loadingPayslips, setLoadingPayslips] = React.useState(true);
  const authAxios = React.useMemo(() => axios.create({
    baseURL: apiBaseUrl,
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  }), [apiBaseUrl, accessToken]);
  const fetchPayslips = async () => {
    setLoadingPayslips(true);
    try {
      const response = await authAxios.get(`${apiBaseUrl}/api/employee/payslips/my`);
      setPayslips(response.data);
    } catch (error) {
      console.error("Error fetching payslips:", error.response?.data?.message || error.message);
      showMessage(`Error fetching payslips: ${error.response?.data?.message || error.message}`, "error");
    } finally {
      setLoadingPayslips(false);
    }
  };
  const handleDownloadPayslip = async (payslipId, month, year) => {
    try {
      const response = await authAxios.get(`${apiBaseUrl}/api/employee/payslips/${payslipId}/download`, {
        responseType: 'blob' // Important for file downloads
      });
      // Use FileSaver.js to save the blob
      const filename = `payslip_${moment().month(month - 1).format('MMM')}_${year}.pdf`; // Dynamic filename
      saveAs(response.data, filename);
      showMessage('Payslip downloaded successfully!', 'success');
    } catch (error) {
      console.error("Error downloading payslip:", error.response?.data?.message || error.message);
      showMessage(`Failed to download payslip: ${error.response?.data?.message || error.message}`, "error");
    }
  };
  React.useEffect(() => {
    if (accessToken) {
      fetchPayslips();
    }
  }, [accessToken]);
  if (loadingPayslips) {
    return /*#__PURE__*/React.createElement("p", {
      className: "text-gray-500 dark:text-gray-400"
    }, "Loading your payslips...");
  }
  return /*#__PURE__*/React.createElement("section", {
    className: "mt-8 p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "text-lg font-medium mb-4"
  }, "My Payslips"), payslips.length > 0 ? /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto rounded-lg shadow-md"
  }, /*#__PURE__*/React.createElement("table", {
    className: "min-w-full divide-y divide-gray-200 dark:divide-gray-700"
  }, /*#__PURE__*/React.createElement("thead", {
    className: "bg-gray-50 dark:bg-gray-700"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Month/Year"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Gross Earnings"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Net Pay"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Actions"))), /*#__PURE__*/React.createElement("tbody", {
    className: "bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700"
  }, payslips.map(payslip => /*#__PURE__*/React.createElement("tr", {
    key: payslip.id,
    className: "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
  }, /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white"
  }, moment().month(payslip.payslip_month - 1).format('MMMM'), " ", payslip.payslip_year), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
  }, "\u20B9", payslip.gross_earnings), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
  }, "\u20B9", payslip.net_pay), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm font-medium"
  }, payslip.file_path ? /*#__PURE__*/React.createElement("button", {
    onClick: () => handleDownloadPayslip(payslip.id, payslip.payslip_month, payslip.payslip_year),
    className: "text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-200"
  }, "Download PDF") : /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500 dark:text-gray-400"
  }, "Not Available"))))))) : /*#__PURE__*/React.createElement("p", {
    className: "text-gray-500 dark:text-gray-400"
  }, "No payslips found."));
};

// Make the component globally accessible
window.EmployeePayslips = EmployeePayslips;