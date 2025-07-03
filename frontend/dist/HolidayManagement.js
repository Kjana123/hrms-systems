// HolidayManagement.js
// This component will be used within AdminDashboard.js
// REMOVE all local import/export statements when using type="text/babel" in index.html

const HolidayManagement = ({
  showMessage,
  apiBaseUrl,
  accessToken
}) => {
  const [holidays, setHolidays] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [newHolidayDate, setNewHolidayDate] = React.useState('');
  const [newHolidayName, setNewHolidayName] = React.useState('');

  // Axios instance with token for authenticated requests
  const authAxios = axios.create({
    baseURL: apiBaseUrl,
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  const fetchHolidays = async () => {
    try {
      const response = await authAxios.get(`${apiBaseUrl}/api/admin/holidays`);
      setHolidays(response.data);
    } catch (error) {
      console.error("Error fetching holidays:", error.response?.data?.message || error.message);
      showMessage(`Error fetching holidays: ${error.response?.data?.message || error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };
  React.useEffect(() => {
    if (accessToken) {
      fetchHolidays();
    }
  }, [accessToken]); // Re-fetch when accessToken changes

  const handleAddHoliday = async e => {
    e.preventDefault();
    if (!newHolidayDate || !newHolidayName) {
      showMessage('Please provide both date and name for the holiday.', 'error');
      return;
    }
    try {
      await authAxios.post(`${apiBaseUrl}/api/admin/holidays`, {
        date: newHolidayDate,
        name: newHolidayName
      });
      showMessage('Holiday added successfully!', 'success');
      setNewHolidayDate('');
      setNewHolidayName('');
      fetchHolidays(); // Re-fetch to update the list
    } catch (error) {
      console.error("Error adding holiday:", error.response?.data?.message || error.message);
      showMessage(`Failed to add holiday: ${error.response?.data?.message || error.message}`, 'error');
    }
  };
  const handleDeleteHoliday = async holidayId => {
    if (window.confirm('Are you sure you want to delete this holiday?')) {
      try {
        await authAxios.delete(`${apiBaseUrl}/api/admin/holidays/${holidayId}`);
        showMessage('Holiday deleted successfully!', 'success');
        fetchHolidays(); // Re-fetch to update the list
      } catch (error) {
        console.error("Error deleting holiday:", error.response?.data?.message || error.message);
        showMessage(`Failed to delete holiday: ${error.response?.data?.message || error.message}`, "error");
      }
    }
  };
  if (loading) {
    return /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-center p-8"
    }, /*#__PURE__*/React.createElement("div", {
      className: "w-4 h-4 rounded-full animate-pulse bg-blue-600"
    }), /*#__PURE__*/React.createElement("div", {
      className: "w-4 h-4 rounded-full animate-pulse bg-blue-600"
    }), /*#__PURE__*/React.createElement("div", {
      className: "w-4 h-4 rounded-full animate-pulse bg-blue-600"
    }), /*#__PURE__*/React.createElement("p", {
      className: "ml-2"
    }, "Loading holidays..."));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors duration-300"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "text-2xl font-semibold mb-6"
  }, "Manage Holidays"), /*#__PURE__*/React.createElement("form", {
    onSubmit: handleAddHoliday,
    className: "space-y-4 mb-8 p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-medium mb-4"
  }, "Add New Holiday"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "newHolidayDate",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Date"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    id: "newHolidayDate",
    className: "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm",
    value: newHolidayDate,
    onChange: e => setNewHolidayDate(e.target.value),
    required: true
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "newHolidayName",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Holiday Name"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    id: "newHolidayName",
    className: "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm",
    placeholder: "e.g., Christmas Day",
    value: newHolidayName,
    onChange: e => setNewHolidayName(e.target.value),
    required: true
  })), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 shadow-md"
  }, "Add Holiday")), /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-semibold mb-4"
  }, "Existing Holidays"), /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto rounded-lg shadow-md"
  }, /*#__PURE__*/React.createElement("table", {
    className: "min-w-full divide-y divide-gray-200 dark:divide-gray-700"
  }, /*#__PURE__*/React.createElement("thead", {
    className: "bg-gray-50 dark:bg-gray-700"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Date"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Holiday Name"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Actions"))), /*#__PURE__*/React.createElement("tbody", {
    className: "bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700"
  }, holidays.length > 0 ? holidays.map(holiday => /*#__PURE__*/React.createElement("tr", {
    key: holiday.id,
    className: "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
  }, /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white"
  }, holiday.date), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
  }, holiday.name), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm font-medium"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => handleDeleteHoliday(holiday.id),
    className: "text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
  }, "Delete")))) : /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "3",
    className: "px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400"
  }, "No holidays added yet."))))));
};