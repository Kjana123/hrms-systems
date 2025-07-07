// AdminPayrollManagement.js
// REMOVE all local import/export statements when using type="text/babel" in index.html

function AdminPayrollManagement({
  showMessage,
  apiBaseUrl,
  accessToken,
  authAxios,
  employees,
  darkMode
}) {
  const [activeSubTab, setActiveSubTab] = React.useState('settings'); // 'settings', 'salary-structures', 'payslip-upload', 'payroll-run'

  // State for Payroll Settings
  const [payrollSettings, setPayrollSettings] = React.useState([]);
  const [newSettingName, setNewSettingName] = React.useState('');
  const [newSettingValue, setNewSettingValue] = React.useState('');
  const [newSettingDescription, setNewSettingDescription] = React.useState('');

  // State for Salary Structures
  const [selectedEmployeeForSalary, setSelectedEmployeeForSalary] = React.useState('');
  const [employeeSalaryStructures, setEmployeeSalaryStructures] = React.useState([]);
  const [newBasicSalary, setNewBasicSalary] = React.useState('');
  const [newHRA, setNewHRA] = React.useState('');
  const [newConveyanceAllowance, setNewConveyanceAllowance] = React.useState('');
  const [newMedicalAllowance, setNewMedicalAllowance] = React.useState('');
  const [newSpecialAllowance, setNewSpecialAllowance] = React.useState('');
  const [newLTA, setNewLTA] = React.useState('');
  const [newEffectiveDate, setNewEffectiveDate] = React.useState(moment().format('YYYY-MM-DD'));
  const [newOtherEarnings, setNewOtherEarnings] = React.useState(''); // JSON string for other earnings
  // --- START: New States for Salary Structure Editing ---
  const [isEditingSalaryStructure, setIsEditingSalaryStructure] = React.useState(false);
  const [editingSalaryStructureId, setEditingSalaryStructureId] = React.useState(null); // Stores the ID of the structure being edited
  // --- END: New States for Salary Structure Editing ---

  // State for Payslip Upload
  const [selectedEmployeeForPayslip, setSelectedEmployeeForPayslip] = React.useState('');
  const [payslipMonth, setPayslipMonth] = React.useState(moment().month() + 1);
  const [payslipYear, setPayslipYear] = React.useState(moment().year());
  const [payslipFile, setPayslipFile] = React.useState(null);
  const [uploadingPayslip, setUploadingPayslip] = React.useState(false);

  // State for Payroll Run
  const [payrollRunMonth, setPayrollRunMonth] = React.useState(moment().month() + 1);
  const [payrollRunYear, setPayrollRunYear] = React.useState(moment().year());
  const [runningPayroll, setRunningPayroll] = React.useState(false);

  // States for Attendance Summary in Salary Structures Tab
  const [selectedAttendanceMonth, setSelectedAttendanceMonth] = React.useState(moment().month() + 1);
  const [selectedAttendanceYear, setSelectedAttendanceYear] = React.useState(moment().year());
  const [employeeAttendanceSummary, setEmployeeAttendanceSummary] = React.useState(null);
  const [loadingAttendanceSummary, setLoadingAttendanceSummary] = React.useState(false);

  // New States for Payslip Preview
  const [previewCalculatedPayslip, setPreviewCalculatedPayslip] = React.useState(null);
  const [loadingPayslipPreview, setLoadingPayslipPreview] = React.useState(false);

  // Fetch Payroll Settings
  const fetchPayrollSettings = async () => {
    try {
      const response = await authAxios.get(`${apiBaseUrl}/api/admin/payroll/settings`);
      setPayrollSettings(response.data);
    } catch (error) {
      console.error("Error fetching payroll settings:", error.response?.data?.message || error.message);
      showMessage(`Error fetching payroll settings: ${error.response?.data?.message || error.message}`, "error");
    }
  };

  // Save Payroll Setting
  const handleSaveSetting = async () => {
    if (!newSettingName || !newSettingValue) {
      showMessage('Setting Name and Value are required.', 'error');
      return;
    }
    try {
      await authAxios.post(`${apiBaseUrl}/api/admin/payroll/settings`, {
        setting_name: newSettingName,
        setting_value: newSettingValue,
        description: newSettingDescription
      });
      showMessage('Payroll setting saved successfully!', 'success');
      setNewSettingName('');
      setNewSettingValue('');
      setNewSettingDescription('');
      fetchPayrollSettings(); // Re-fetch to update list
    } catch (error) {
      console.error("Error saving setting:", error.response?.data?.message || error.message);
      showMessage(`Failed to save setting: ${error.response?.data?.message || error.message}`, "error");
    }
  };

  // Function to Delete Payroll Setting
  const handleDeleteSetting = async settingId => {
    if (!window.confirm('Are you sure you want to delete this payroll setting?')) {
      return;
    }
    try {
      await authAxios.delete(`${apiBaseUrl}/api/admin/payroll/settings/${settingId}`);
      showMessage('Payroll setting deleted successfully!', 'success');
      fetchPayrollSettings(); // Re-fetch to update list
    } catch (error) {
      console.error("Error deleting setting:", error.response?.data?.message || error.message);
      showMessage(`Failed to delete setting: ${error.response?.data?.message || error.message}`, "error");
    }
  };

  // Fetch Employee Salary Structures
  const fetchEmployeeSalaryStructures = async userId => {
    if (!userId) {
      setEmployeeSalaryStructures([]);
      return;
    }
    try {
      const response = await authAxios.get(`${apiBaseUrl}/api/admin/salary-structures/${userId}`);
      setEmployeeSalaryStructures(response.data);
    } catch (error) {
      console.error("Error fetching employee salary structures:", error.response?.data?.message || error.message);
      showMessage(`Error fetching salary structures: ${error.response?.data?.message || error.message}`, "error");
    }
  };

  // Save/Update Employee Salary Structure
  const handleSaveSalaryStructure = async () => {
    if (!selectedEmployeeForSalary || !newBasicSalary || !newHRA || !newEffectiveDate) {
      showMessage('Employee, Basic Salary, HRA, and Effective Date are required.', 'error');
      return;
    }
    const grossSalary = parseFloat(newBasicSalary) + parseFloat(newHRA) + parseFloat(newConveyanceAllowance || 0) + parseFloat(newMedicalAllowance || 0) + parseFloat(newSpecialAllowance || 0) + parseFloat(newLTA || 0);
    let otherEarningsJson = {};
    try {
      if (newOtherEarnings) {
        otherEarningsJson = JSON.parse(newOtherEarnings);
      }
    } catch (e) {
      showMessage('Other Earnings must be valid JSON.', 'error');
      return;
    }
    try {
      // The backend endpoint handles both insert and update via ON CONFLICT
      await authAxios.post(`${apiBaseUrl}/api/admin/salary-structures`, {
        userId: selectedEmployeeForSalary,
        effectiveDate: newEffectiveDate,
        basicSalary: parseFloat(newBasicSalary),
        hra: parseFloat(newHRA),
        conveyanceAllowance: parseFloat(newConveyanceAllowance || 0),
        medicalAllowance: parseFloat(newMedicalAllowance || 0),
        specialAllowance: parseFloat(newSpecialAllowance || 0),
        lta: parseFloat(newLTA || 0),
        otherEarnings: otherEarningsJson,
        grossSalary: grossSalary
      });
      showMessage(`Salary structure ${isEditingSalaryStructure ? 'updated' : 'saved'} successfully!`, 'success');
      // Reset form fields and editing state
      resetSalaryStructureForm();
      fetchEmployeeSalaryStructures(selectedEmployeeForSalary); // Re-fetch for selected employee
    } catch (error) {
      console.error("Error saving/updating salary structure:", error.response?.data?.message || error.message);
      showMessage(`Failed to ${isEditingSalaryStructure ? 'update' : 'save'} salary structure: ${error.response?.data?.message || error.message}`, "error");
    }
  };

  // --- START: New Functions for Salary Structure Editing UI ---
  const handleEditSalaryStructure = structure => {
    setIsEditingSalaryStructure(true);
    setEditingSalaryStructureId(structure.id);
    setSelectedEmployeeForSalary(structure.user_id);
    setNewEffectiveDate(structure.effective_date);
    setNewBasicSalary(structure.basic_salary);
    setNewHRA(structure.hra);
    setNewConveyanceAllowance(structure.conveyance_allowance);
    setNewMedicalAllowance(structure.medical_allowance);
    setNewSpecialAllowance(structure.special_allowance);
    setNewLTA(structure.lta);
    setNewOtherEarnings(JSON.stringify(structure.other_earnings || {}, null, 2)); // Pretty print JSON
  };
  const handleCancelEditSalaryStructure = () => {
    resetSalaryStructureForm();
  };
  const resetSalaryStructureForm = () => {
    setIsEditingSalaryStructure(false);
    setEditingSalaryStructureId(null);
    // setSelectedEmployeeForSalary(''); // Keep selected employee for convenience
    setNewBasicSalary('');
    setNewHRA('');
    setNewConveyanceAllowance('');
    setNewMedicalAllowance('');
    setNewSpecialAllowance('');
    setNewLTA('');
    setNewOtherEarnings('');
    setNewEffectiveDate(moment().format('YYYY-MM-DD'));
  };
  // --- END: New Functions for Salary Structure Editing UI ---

  // Handle Payslip File Selection
  const handlePayslipFileChange = e => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
        showMessage('Only PDF files are allowed for payslips.', 'error');
        setPayslipFile(null);
        return;
      }
      setPayslipFile(file);
    }
  };

  // Upload Payslip
  const handlePayslipUpload = async () => {
    if (!selectedEmployeeForPayslip || !payslipFile) {
      showMessage('Please select an employee and a payslip file.', 'error');
      return;
    }
    setUploadingPayslip(true);
    const formData = new FormData();
    formData.append('userId', selectedEmployeeForPayslip);
    formData.append('month', payslipMonth);
    formData.append('year', payslipYear);
    formData.append('payslipFile', payslipFile); // 'payslipFile' must match Multer field name

    try {
      await authAxios.post(`${apiBaseUrl}/api/admin/payslips/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      showMessage('Payslip uploaded successfully!', 'success');
      setPayslipFile(null); // Clear file input
    } catch (error) {
      console.error("Error uploading payslip:", error.response?.data?.message || error.message);
      showMessage(`Failed to upload payslip: ${error.response?.data?.message || error.message}`, "error");
    } finally {
      setUploadingPayslip(false);
    }
  };

  // Run Payroll
  const handleRunPayroll = async () => {
    if (!window.confirm(`Are you sure you want to run payroll for ${moment().month(payrollRunMonth - 1).format('MMMM')} ${payrollRunYear}? This will calculate payslips for all active employees.`)) {
      return;
    }
    setRunningPayroll(true);
    try {
      const response = await authAxios.post(`${apiBaseUrl}/api/admin/payroll/run`, {
        month: payrollRunMonth,
        year: payrollRunYear
      });
      showMessage(response.data.message, 'success');
    } catch (error) {
      console.error("Error running payroll:", error.response?.data?.message || error.message);
      showMessage(`Failed to run payroll: ${error.response?.data?.message || error.message}`, "error");
    } finally {
      setRunningPayroll(false);
    }
  };

  // Function to Fetch Employee Attendance Summary
  const fetchEmployeeAttendanceSummary = async (userId, month, year) => {
    if (!userId || !month || !year) {
      setEmployeeAttendanceSummary(null);
      return;
    }
    setLoadingAttendanceSummary(true);
    try {
      const response = await authAxios.get(`${apiBaseUrl}/api/admin/attendance/summary/${userId}/${year}/${month}`);
      setEmployeeAttendanceSummary(response.data);
    } catch (error) {
      console.error("Error fetching employee attendance summary:", error.response?.data?.message || error.message);
      showMessage(`Error fetching attendance summary: ${error.response?.data?.message || error.message}`, "error");
      setEmployeeAttendanceSummary(null);
    } finally {
      setLoadingAttendanceSummary(false);
    }
  };

  // New Function to Fetch Payslip Preview
  const handlePreviewPayslipCalculation = async () => {
    if (!selectedEmployeeForSalary || !selectedAttendanceMonth || !selectedAttendanceYear) {
      showMessage('Please select an employee, month, and year to preview payslip.', 'error');
      return;
    }
    setLoadingPayslipPreview(true);
    setPreviewCalculatedPayslip(null); // Clear previous preview
    try {
      const response = await authAxios.get(`${apiBaseUrl}/api/admin/payroll/preview/${selectedEmployeeForSalary}/${selectedAttendanceYear}/${selectedAttendanceMonth}`);
      setPreviewCalculatedPayslip(response.data);
      showMessage('Payslip preview generated successfully!', 'success');
    } catch (error) {
      console.error("Error fetching payslip preview:", error.response?.data?.message || error.message);
      showMessage(`Failed to generate payslip preview: ${error.response?.data?.message || error.message}`, "error");
      setPreviewCalculatedPayslip(null);
    } finally {
      setLoadingPayslipPreview(false);
    }
  };

  // Effect to fetch initial data when component mounts or sub-tab changes
  React.useEffect(() => {
    if (accessToken) {
      if (activeSubTab === 'settings') {
        fetchPayrollSettings();
      } else if (activeSubTab === 'salary-structures' && selectedEmployeeForSalary) {
        fetchEmployeeSalaryStructures(selectedEmployeeForSalary);
        fetchEmployeeAttendanceSummary(selectedEmployeeForSalary, selectedAttendanceMonth, selectedAttendanceYear);
        setPreviewCalculatedPayslip(null); // Clear payslip preview when employee changes
      }
      // Clear payslip preview when switching tabs
      if (activeSubTab !== 'salary-structures') {
        setPreviewCalculatedPayslip(null);
      }
    }
  }, [accessToken, activeSubTab, selectedEmployeeForSalary, selectedAttendanceMonth, selectedAttendanceYear]);

  // Calculate gross salary dynamically for display
  const calculatedGrossSalary = React.useMemo(() => {
    const basic = parseFloat(newBasicSalary || 0);
    const hra = parseFloat(newHRA || 0);
    const conv = parseFloat(newConveyanceAllowance || 0);
    const med = parseFloat(newMedicalAllowance || 0);
    const spec = parseFloat(newSpecialAllowance || 0);
    const lta = parseFloat(newLTA || 0);
    let other = 0;
    try {
      if (newOtherEarnings) {
        const parsedOther = JSON.parse(newOtherEarnings);
        for (const key in parsedOther) {
          other += parseFloat(parsedOther[key] || 0);
        }
      }
    } catch (e) {
      // Ignore parsing errors for live calculation, show error on save
    }
    return (basic + hra + conv + med + spec + lta + other).toFixed(2);
  }, [newBasicSalary, newHRA, newConveyanceAllowance, newMedicalAllowance, newSpecialAllowance, newLTA, newOtherEarnings]);
  return /*#__PURE__*/React.createElement("section", {
    className: `p-6 rounded-lg shadow-md transition-colors duration-300 ${darkMode ? 'bg-gray-800' : 'bg-white'}`
  }, /*#__PURE__*/React.createElement("h2", {
    className: "text-3xl font-bold mb-8"
  }, "Payroll Management"), /*#__PURE__*/React.createElement("div", {
    className: "flex border-b border-gray-200 dark:border-gray-700 mb-6"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setActiveSubTab('settings'),
    className: `py-2 px-4 -mb-px border-b-2 ${activeSubTab === 'settings' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`
  }, "Settings"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setActiveSubTab('salary-structures'),
    className: `py-2 px-4 -mb-px border-b-2 ${activeSubTab === 'salary-structures' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`
  }, "Salary Structures"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setActiveSubTab('payroll-run'),
    className: `py-2 px-4 -mb-px border-b-2 ${activeSubTab === 'payroll-run' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`
  }, "Run Payroll"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setActiveSubTab('payslip-upload'),
    className: `py-2 px-4 -mb-px border-b-2 ${activeSubTab === 'payslip-upload' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`
  }, "Payslip Upload")), activeSubTab === 'settings' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-semibold mb-4"
  }, "Company Payroll Settings"), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "settingName",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Setting Name"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    id: "settingName",
    value: newSettingName,
    onChange: e => setNewSettingName(e.target.value),
    className: "mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white",
    placeholder: "e.g., EPF_EMPLOYEE_RATE"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "settingValue",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Setting Value"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    id: "settingValue",
    value: newSettingValue,
    onChange: e => setNewSettingValue(e.target.value),
    className: "mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white",
    placeholder: "e.g., 0.12 or 15000 or JSON string"
  })), /*#__PURE__*/React.createElement("div", {
    className: "md:col-span-2"
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "settingDescription",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Description (Optional)"), /*#__PURE__*/React.createElement("textarea", {
    id: "settingDescription",
    value: newSettingDescription,
    onChange: e => setNewSettingDescription(e.target.value),
    rows: "2",
    className: "mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white",
    placeholder: "Brief description of the setting"
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: handleSaveSetting,
    className: "px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
  }, "Save Setting"), /*#__PURE__*/React.createElement("h4", {
    className: "text-lg font-semibold mt-8 mb-4"
  }, "Current Settings"), payrollSettings.length > 0 ? /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto"
  }, /*#__PURE__*/React.createElement("table", {
    className: "min-w-full divide-y divide-gray-200 dark:divide-gray-700"
  }, /*#__PURE__*/React.createElement("thead", {
    className: "bg-gray-50 dark:bg-gray-700"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Name"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Value"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Description"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Actions"))), /*#__PURE__*/React.createElement("tbody", {
    className: "bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700"
  }, payrollSettings.map(setting => /*#__PURE__*/React.createElement("tr", {
    key: setting.id
  }, /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white"
  }, setting.setting_name), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
  }, setting.setting_value), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 text-sm text-gray-500 dark:text-gray-300"
  }, setting.description || 'N/A'), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => handleDeleteSetting(setting.id),
    className: "text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors duration-200"
  }, "Delete"))))))) : /*#__PURE__*/React.createElement("p", {
    className: "text-gray-500 dark:text-gray-400"
  }, "No payroll settings configured yet.")), activeSubTab === 'salary-structures' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-semibold mb-4"
  }, isEditingSalaryStructure ? 'Edit Employee Salary Structure' : 'Define New Employee Salary Structure'), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "employeeSelect",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Select Employee"), /*#__PURE__*/React.createElement("select", {
    id: "employeeSelect",
    value: selectedEmployeeForSalary,
    onChange: e => {
      setSelectedEmployeeForSalary(e.target.value);
      fetchEmployeeSalaryStructures(e.target.value);
      resetSalaryStructureForm();
    } // Reset form on employee change
    ,
    className: "mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white",
    disabled: isEditingSalaryStructure // Disable employee selection when editing
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "-- Select Employee --"), employees.map(emp => /*#__PURE__*/React.createElement("option", {
    key: emp.id,
    value: emp.id
  }, emp.name, " (", emp.employee_id, ")")))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "effectiveDate",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Effective Date"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    id: "effectiveDate",
    value: newEffectiveDate,
    onChange: e => setNewEffectiveDate(e.target.value),
    className: "mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white",
    disabled: isEditingSalaryStructure // Disable date when editing (effective date is part of unique key)
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "basicSalary",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Basic Salary"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    id: "basicSalary",
    value: newBasicSalary,
    onChange: e => setNewBasicSalary(e.target.value),
    className: "mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "hra",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "HRA"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    id: "hra",
    value: newHRA,
    onChange: e => setNewHRA(e.target.value),
    className: "mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "conveyanceAllowance",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Conveyance Allowance"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    id: "conveyanceAllowance",
    value: newConveyanceAllowance,
    onChange: e => setNewConveyanceAllowance(e.target.value),
    className: "mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "medicalAllowance",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Medical Allowance"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    id: "medicalAllowance",
    value: newMedicalAllowance,
    onChange: e => setNewMedicalAllowance(e.target.value),
    className: "mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "specialAllowance",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Special Allowance"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    id: "specialAllowance",
    value: newSpecialAllowance,
    onChange: e => setNewSpecialAllowance(e.target.value),
    className: "mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "lta",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "LTA"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    id: "lta",
    value: newLTA,
    onChange: e => setNewLTA(e.target.value),
    className: "mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
  })), /*#__PURE__*/React.createElement("div", {
    className: "md:col-span-2"
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "otherEarnings",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Other Earnings (JSON)"), /*#__PURE__*/React.createElement("textarea", {
    id: "otherEarnings",
    value: newOtherEarnings,
    onChange: e => setNewOtherEarnings(e.target.value),
    rows: "2",
    className: "mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white",
    placeholder: "{\"bonus\": 1000, \"incentive\": 500}"
  }), /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-gray-500 dark:text-gray-400 mt-1"
  }, "Gross Salary (Calculated): \u20B9", calculatedGrossSalary))), /*#__PURE__*/React.createElement("div", {
    className: "flex space-x-2 mt-4"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: handleSaveSalaryStructure,
    className: "px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
  }, isEditingSalaryStructure ? 'Update Salary Structure' : 'Save Salary Structure'), isEditingSalaryStructure && /*#__PURE__*/React.createElement("button", {
    onClick: handleCancelEditSalaryStructure,
    className: "px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
  }, "Cancel Edit")), /*#__PURE__*/React.createElement("h4", {
    className: "text-lg font-semibold mt-8 mb-4"
  }, "Attendance Summary for Payroll Calculation"), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-4 mb-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "attendanceMonth",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Month"), /*#__PURE__*/React.createElement("select", {
    id: "attendanceMonth",
    value: selectedAttendanceMonth,
    onChange: e => setSelectedAttendanceMonth(parseInt(e.target.value)),
    className: "mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
  }, moment.months().map((monthName, index) => /*#__PURE__*/React.createElement("option", {
    key: index + 1,
    value: index + 1
  }, monthName)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "attendanceYear",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Year"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    id: "attendanceYear",
    value: selectedAttendanceYear,
    onChange: e => setSelectedAttendanceYear(parseInt(e.target.value)),
    className: "mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white",
    min: "2000",
    max: "2100"
  }))), loadingAttendanceSummary ? /*#__PURE__*/React.createElement("p", {
    className: "text-gray-500 dark:text-gray-400"
  }, "Loading attendance summary...") : employeeAttendanceSummary && selectedEmployeeForSalary ? /*#__PURE__*/React.createElement("div", {
    className: `p-4 rounded-lg shadow-inner ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`
  }, /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("span", {
    className: "font-medium"
  }, "Total Calendar Days in Month:"), " ", employeeAttendanceSummary.totalCalendarDays), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("span", {
    className: "font-medium"
  }, "Total Working Days (excluding weekly offs):"), " ", employeeAttendanceSummary.totalWorkingDaysInMonth), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("span", {
    className: "font-medium"
  }, "Actual Weekly Off Days:"), " ", employeeAttendanceSummary.actualWeeklyOffDays), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("span", {
    className: "font-medium"
  }, "Present Days:"), " ", employeeAttendanceSummary.presentDays), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("span", {
    className: "font-medium"
  }, "Half Days:"), " ", employeeAttendanceSummary.halfDays), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("span", {
    className: "font-medium"
  }, "On Leave Days (Paid):"), " ", employeeAttendanceSummary.onLeaveDays), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("span", {
    className: "font-medium"
  }, "LOP Days (Unpaid Leave):"), " ", employeeAttendanceSummary.lopDays), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("span", {
    className: "font-medium"
  }, "Unaccounted Absent Working Days:"), " ", employeeAttendanceSummary.unaccountedAbsentWorkingDays), /*#__PURE__*/React.createElement("p", {
    className: "mt-2 text-blue-600 dark:text-blue-400 font-semibold"
  }, "Calculated Paid Days: ", employeeAttendanceSummary.paidDays), /*#__PURE__*/React.createElement("p", {
    className: "text-red-600 dark:text-red-400 font-semibold"
  }, "Calculated Unpaid Leaves: ", employeeAttendanceSummary.unpaidLeaves), /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-gray-500 dark:text-gray-400 mt-4"
  }, "*Note: This summary does not currently account for public holidays.")) : /*#__PURE__*/React.createElement("p", {
    className: "text-gray-500 dark:text-gray-400"
  }, "Select an employee and month/year to view attendance summary."), /*#__PURE__*/React.createElement("h4", {
    className: "text-lg font-semibold mt-8 mb-4"
  }, "Payslip Calculation Preview"), /*#__PURE__*/React.createElement("div", {
    className: "mb-4"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: handlePreviewPayslipCalculation,
    disabled: loadingPayslipPreview || !selectedEmployeeForSalary,
    className: `px-6 py-2 rounded-md transition-colors duration-200 ${loadingPayslipPreview || !selectedEmployeeForSalary ? 'bg-gray-400' : 'bg-purple-600 hover:bg-purple-700'} text-white`
  }, loadingPayslipPreview ? 'Calculating Preview...' : 'Calculate Payslip Preview')), previewCalculatedPayslip && /*#__PURE__*/React.createElement("div", {
    className: `p-4 rounded-lg shadow-inner ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`
  }, /*#__PURE__*/React.createElement("h5", {
    className: "text-lg font-semibold mb-2"
  }, "Preview for ", employees.find(emp => emp.id == selectedEmployeeForSalary)?.name, " - ", moment().month(selectedAttendanceMonth - 1).format('MMMM'), " ", selectedAttendanceYear), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h6", {
    className: "font-medium text-blue-600 dark:text-blue-400"
  }, "Earnings"), /*#__PURE__*/React.createElement("p", null, "Basic Salary: \u20B9", previewCalculatedPayslip.basic_salary), /*#__PURE__*/React.createElement("p", null, "HRA: \u20B9", previewCalculatedPayslip.hra), /*#__PURE__*/React.createElement("p", null, "Conveyance Allowance: \u20B9", previewCalculatedPayslip.conveyance_allowance), /*#__PURE__*/React.createElement("p", null, "Medical Allowance: \u20B9", previewCalculatedPayslip.medical_allowance), /*#__PURE__*/React.createElement("p", null, "Special Allowance: \u20B9", previewCalculatedPayslip.special_allowance), /*#__PURE__*/React.createElement("p", null, "LTA: \u20B9", previewCalculatedPayslip.lta), previewCalculatedPayslip.other_earnings && Object.keys(previewCalculatedPayslip.other_earnings).length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    className: "font-medium mt-2"
  }, "Other Earnings:"), Object.entries(previewCalculatedPayslip.other_earnings).map(([key, value]) => /*#__PURE__*/React.createElement("p", {
    key: key,
    className: "ml-2 text-sm"
  }, key, ": \u20B9", value))), /*#__PURE__*/React.createElement("p", {
    className: "mt-2 font-bold"
  }, "Gross Earnings: \u20B9", previewCalculatedPayslip.gross_earnings)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h6", {
    className: "font-medium text-red-600 dark:text-red-400"
  }, "Deductions"), /*#__PURE__*/React.createElement("p", null, "EPF (Employee): \u20B9", previewCalculatedPayslip.epf_employee), /*#__PURE__*/React.createElement("p", null, "ESI (Employee): \u20B9", previewCalculatedPayslip.esi_employee), /*#__PURE__*/React.createElement("p", null, "Professional Tax: \u20B9", previewCalculatedPayslip.professional_tax), /*#__PURE__*/React.createElement("p", null, "TDS: \u20B9", previewCalculatedPayslip.tds), /*#__PURE__*/React.createElement("p", null, "Loan Deduction: \u20B9", previewCalculatedPayslip.loan_deduction), previewCalculatedPayslip.other_deductions && Object.keys(previewCalculatedPayslip.other_deductions).length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    className: "font-medium mt-2"
  }, "Other Deductions:"), Object.entries(previewCalculatedPayslip.other_deductions).map(([key, value]) => /*#__PURE__*/React.createElement("p", {
    key: key,
    className: "ml-2 text-sm"
  }, key, ": \u20B9", value))), /*#__PURE__*/React.createElement("p", {
    className: "mt-2 font-bold"
  }, "Total Deductions: \u20B9", previewCalculatedPayslip.total_deductions))), /*#__PURE__*/React.createElement("div", {
    className: "mt-4 pt-4 border-t border-gray-300 dark:border-gray-600"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-2xl font-bold text-green-700 dark:text-green-300"
  }, "Net Pay: \u20B9", previewCalculatedPayslip.net_pay))), /*#__PURE__*/React.createElement("h4", {
    className: "text-lg font-semibold mt-8 mb-4"
  }, "Employee's Salary History"), selectedEmployeeForSalary && employeeSalaryStructures.length > 0 ? /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto"
  }, /*#__PURE__*/React.createElement("table", {
    className: "min-w-full divide-y divide-gray-200 dark:divide-gray-700"
  }, /*#__PURE__*/React.createElement("thead", {
    className: "bg-gray-50 dark:bg-gray-700"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Effective Date"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Basic"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "HRA"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Gross"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Other Earnings"), /*#__PURE__*/React.createElement("th", {
    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
  }, "Actions"), " ")), /*#__PURE__*/React.createElement("tbody", {
    className: "bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700"
  }, employeeSalaryStructures.map(structure => /*#__PURE__*/React.createElement("tr", {
    key: structure.id
  }, /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white"
  }, structure.effective_date), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
  }, "\u20B9", structure.basic_salary), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
  }, "\u20B9", structure.hra), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
  }, "\u20B9", structure.gross_salary), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 text-sm text-gray-500 dark:text-gray-300"
  }, JSON.stringify(structure.other_earnings)), /*#__PURE__*/React.createElement("td", {
    className: "px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => handleEditSalaryStructure(structure),
    className: "text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors duration-200"
  }, "Edit"))))))) : /*#__PURE__*/React.createElement("p", {
    className: "text-gray-500 dark:text-gray-400"
  }, "Select an employee to view their salary structures or no structures found.")), activeSubTab === 'payroll-run' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-semibold mb-4"
  }, "Run Monthly Payroll"), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "payrollMonth",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Month"), /*#__PURE__*/React.createElement("select", {
    id: "payrollMonth",
    value: payrollRunMonth,
    onChange: e => setPayrollRunMonth(parseInt(e.target.value)),
    className: "mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
  }, moment.months().map((monthName, index) => /*#__PURE__*/React.createElement("option", {
    key: index + 1,
    value: index + 1
  }, monthName)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "payrollYear",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Year"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    id: "payrollYear",
    value: payrollRunYear,
    onChange: e => setPayrollRunYear(parseInt(e.target.value)),
    className: "mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white",
    min: "2000",
    max: "2100"
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: handleRunPayroll,
    disabled: runningPayroll,
    className: `px-6 py-2 rounded-md transition-colors duration-200 ${runningPayroll ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'} text-white`
  }, runningPayroll ? 'Calculating...' : 'Run Payroll'), /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-gray-500 dark:text-gray-400 mt-2"
  }, "Running payroll will calculate payslips for all active employees for the selected month and year based on their salary structures, attendance, and company settings.")), activeSubTab === 'payslip-upload' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-semibold mb-4"
  }, "Upload Payslip PDF"), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "uploadEmployeeSelect",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Select Employee"), /*#__PURE__*/React.createElement("select", {
    id: "uploadEmployeeSelect",
    value: selectedEmployeeForPayslip,
    onChange: e => setSelectedEmployeeForPayslip(e.target.value),
    className: "mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "-- Select Employee --"), employees.map(emp => /*#__PURE__*/React.createElement("option", {
    key: emp.id,
    value: emp.id
  }, emp.name, " (", emp.employee_id, ")")))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "payslipUploadMonth",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Month"), /*#__PURE__*/React.createElement("select", {
    id: "payslipUploadMonth",
    value: payslipMonth,
    onChange: e => setPayslipMonth(parseInt(e.target.value)),
    className: "mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
  }, moment.months().map((monthName, index) => /*#__PURE__*/React.createElement("option", {
    key: index + 1,
    value: index + 1
  }, monthName)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "payslipUploadYear",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Year"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    id: "payslipUploadYear",
    value: payslipYear,
    onChange: e => setPayslipYear(parseInt(e.target.value)),
    className: "mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white",
    min: "2000",
    max: "2100"
  })), /*#__PURE__*/React.createElement("div", {
    className: "md:col-span-2"
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "payslipFile",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Payslip PDF File"), /*#__PURE__*/React.createElement("input", {
    type: "file",
    id: "payslipFile",
    accept: "application/pdf",
    onChange: handlePayslipFileChange,
    className: "mt-1 block w-full text-sm text-gray-900 dark:text-gray-300\r file:mr-4 file:py-2 file:px-4\r file:rounded-md file:border-0\r file:text-sm file:font-semibold\r file:bg-blue-50 file:text-blue-700\r hover:file:bg-blue-100"
  }), payslipFile && /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-gray-500 dark:text-gray-400 mt-1"
  }, "Selected: ", payslipFile.name))), /*#__PURE__*/React.createElement("button", {
    onClick: handlePayslipUpload,
    disabled: uploadingPayslip,
    className: `px-6 py-2 rounded-md transition-colors duration-200 ${uploadingPayslip ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} text-white`
  }, uploadingPayslip ? 'Uploading...' : 'Upload Payslip')));
}
;

// Make the component globally accessible
window.AdminPayrollManagement = AdminPayrollManagement;