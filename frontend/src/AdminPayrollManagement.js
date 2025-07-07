// AdminPayrollManagement.js
// REMOVE all local import/export statements when using type="text/babel" in index.html

function AdminPayrollManagement({ showMessage, apiBaseUrl, accessToken, authAxios, employees, darkMode }) {
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
    const handleDeleteSetting = async (settingId) => {
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
    const fetchEmployeeSalaryStructures = async (userId) => {
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

        const grossSalary = parseFloat(newBasicSalary) + parseFloat(newHRA) +
                            parseFloat(newConveyanceAllowance || 0) + parseFloat(newMedicalAllowance || 0) +
                            parseFloat(newSpecialAllowance || 0) + parseFloat(newLTA || 0);

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
    const handleEditSalaryStructure = (structure) => {
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
    const handlePayslipFileChange = (e) => {
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


    return (
        <section className={`p-6 rounded-lg shadow-md transition-colors duration-300 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className="text-3xl font-bold mb-8">Payroll Management</h2>

            <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
                <button
                    onClick={() => setActiveSubTab('settings')}
                    className={`py-2 px-4 -mb-px border-b-2 ${activeSubTab === 'settings' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                    Settings
                </button>
                <button
                    onClick={() => setActiveSubTab('salary-structures')}
                    className={`py-2 px-4 -mb-px border-b-2 ${activeSubTab === 'salary-structures' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                    Salary Structures
                </button>
                 <button
                    onClick={() => setActiveSubTab('payroll-run')}
                    className={`py-2 px-4 -mb-px border-b-2 ${activeSubTab === 'payroll-run' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                    Run Payroll
                </button>
                <button
                    onClick={() => setActiveSubTab('payslip-upload')}
                    className={`py-2 px-4 -mb-px border-b-2 ${activeSubTab === 'payslip-upload' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                    Payslip Upload
                </button>
            </div>

            {/* Payroll Settings Tab Content */}
            {activeSubTab === 'settings' && (
                <div className="space-y-6">
                    <h3 className="text-xl font-semibold mb-4">Company Payroll Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="settingName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Setting Name</label>
                            <input type="text" id="settingName" value={newSettingName} onChange={(e) => setNewSettingName(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                placeholder="e.g., EPF_EMPLOYEE_RATE" />
                        </div>
                        <div>
                            <label htmlFor="settingValue" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Setting Value</label>
                            <input type="text" id="settingValue" value={newSettingValue} onChange={(e) => setNewSettingValue(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                placeholder="e.g., 0.12 or 15000 or JSON string" />
                        </div>
                        <div className="md:col-span-2">
                            <label htmlFor="settingDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description (Optional)</label>
                            <textarea id="settingDescription" value={newSettingDescription} onChange={(e) => setNewSettingDescription(e.target.value)} rows="2"
                                className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                placeholder="Brief description of the setting" />
                        </div>
                    </div>
                    <button onClick={handleSaveSetting} className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save Setting</button>

                    <h4 className="text-lg font-semibold mt-8 mb-4">Current Settings</h4>
                    {payrollSettings.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Value</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Description</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {payrollSettings.map(setting => (
                                        <tr key={setting.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{setting.setting_name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{setting.setting_value}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">{setting.description || 'N/A'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button
                                                    onClick={() => handleDeleteSetting(setting.id)}
                                                    className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors duration-200"
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-gray-500 dark:text-gray-400">No payroll settings configured yet.</p>
                    )}
                </div>
            )}

            {/* Salary Structures Tab Content */}
            {activeSubTab === 'salary-structures' && (
                <div className="space-y-6">
                    <h3 className="text-xl font-semibold mb-4">{isEditingSalaryStructure ? 'Edit Employee Salary Structure' : 'Define New Employee Salary Structure'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="employeeSelect" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Select Employee</label>
                            <select id="employeeSelect" value={selectedEmployeeForSalary} onChange={(e) => { setSelectedEmployeeForSalary(e.target.value); fetchEmployeeSalaryStructures(e.target.value); resetSalaryStructureForm(); }} // Reset form on employee change
                                className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                disabled={isEditingSalaryStructure} // Disable employee selection when editing
                                >
                                <option value="">-- Select Employee --</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_id})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="effectiveDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Effective Date</label>
                            <input type="date" id="effectiveDate" value={newEffectiveDate} onChange={(e) => setNewEffectiveDate(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                disabled={isEditingSalaryStructure} // Disable date when editing (effective date is part of unique key)
                                />
                        </div>
                        <div>
                            <label htmlFor="basicSalary" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Basic Salary</label>
                            <input type="number" id="basicSalary" value={newBasicSalary} onChange={(e) => setNewBasicSalary(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                        <div>
                            <label htmlFor="hra" className="block text-sm font-medium text-gray-700 dark:text-gray-300">HRA</label>
                            <input type="number" id="hra" value={newHRA} onChange={(e) => setNewHRA(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                        <div>
                            <label htmlFor="conveyanceAllowance" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Conveyance Allowance</label>
                            <input type="number" id="conveyanceAllowance" value={newConveyanceAllowance} onChange={(e) => setNewConveyanceAllowance(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                        <div>
                            <label htmlFor="medicalAllowance" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Medical Allowance</label>
                            <input type="number" id="medicalAllowance" value={newMedicalAllowance} onChange={(e) => setNewMedicalAllowance(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                        <div>
                            <label htmlFor="specialAllowance" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Special Allowance</label>
                            <input type="number" id="specialAllowance" value={newSpecialAllowance} onChange={(e) => setNewSpecialAllowance(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                        <div>
                            <label htmlFor="lta" className="block text-sm font-medium text-gray-700 dark:text-gray-300">LTA</label>
                            <input type="number" id="lta" value={newLTA} onChange={(e) => setNewLTA(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                        <div className="md:col-span-2">
                            <label htmlFor="otherEarnings" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Other Earnings (JSON)</label>
                            <textarea id="otherEarnings" value={newOtherEarnings} onChange={(e) => setNewOtherEarnings(e.target.value)} rows="2"
                                className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                placeholder='{"bonus": 1000, "incentive": 500}' />
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gross Salary (Calculated): ₹{calculatedGrossSalary}</p>
                        </div>
                    </div>
                    <div className="flex space-x-2 mt-4">
                        <button onClick={handleSaveSalaryStructure} className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                            {isEditingSalaryStructure ? 'Update Salary Structure' : 'Save Salary Structure'}
                        </button>
                        {isEditingSalaryStructure && (
                            <button onClick={handleCancelEditSalaryStructure} className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                                Cancel Edit
                            </button>
                        )}
                    </div>

                    {/* Employee Attendance Summary Section */}
                    <h4 className="text-lg font-semibold mt-8 mb-4">Attendance Summary for Payroll Calculation</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label htmlFor="attendanceMonth" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Month</label>
                            <select id="attendanceMonth" value={selectedAttendanceMonth} onChange={(e) => setSelectedAttendanceMonth(parseInt(e.target.value))}
                                className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                {moment.months().map((monthName, index) => (
                                    <option key={index + 1} value={index + 1}>{monthName}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="attendanceYear" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Year</label>
                            <input type="number" id="attendanceYear" value={selectedAttendanceYear} onChange={(e) => setSelectedAttendanceYear(parseInt(e.target.value))}
                                className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                min="2000" max="2100" />
                        </div>
                    </div>

                    {loadingAttendanceSummary ? (
                        <p className="text-gray-500 dark:text-gray-400">Loading attendance summary...</p>
                    ) : employeeAttendanceSummary && selectedEmployeeForSalary ? (
                        <div className={`p-4 rounded-lg shadow-inner ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                            <p><span className="font-medium">Total Calendar Days in Month:</span> {employeeAttendanceSummary.totalCalendarDays}</p>
                            <p><span className="font-medium">Total Working Days (excluding weekly offs):</span> {employeeAttendanceSummary.totalWorkingDaysInMonth}</p>
                            <p><span className="font-medium">Actual Weekly Off Days:</span> {employeeAttendanceSummary.actualWeeklyOffDays}</p>
                            <p><span className="font-medium">Present Days:</span> {employeeAttendanceSummary.presentDays}</p>
                            <p><span className="font-medium">Half Days:</span> {employeeAttendanceSummary.halfDays}</p>
                            <p><span className="font-medium">On Leave Days (Paid):</span> {employeeAttendanceSummary.onLeaveDays}</p>
                            <p><span className="font-medium">LOP Days (Unpaid Leave):</span> {employeeAttendanceSummary.lopDays}</p>
                            <p><span className="font-medium">Unaccounted Absent Working Days:</span> {employeeAttendanceSummary.unaccountedAbsentWorkingDays}</p>
                            <p className="mt-2 text-blue-600 dark:text-blue-400 font-semibold">
                                Calculated Paid Days: {employeeAttendanceSummary.paidDays}
                            </p>
                            <p className="text-red-600 dark:text-red-400 font-semibold">
                                Calculated Unpaid Leaves: {employeeAttendanceSummary.unpaidLeaves}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                                *Note: This summary does not currently account for public holidays.
                            </p>
                        </div>
                    ) : (
                        <p className="text-gray-500 dark:text-gray-400">Select an employee and month/year to view attendance summary.</p>
                    )}

                    {/* Payslip Calculation Preview Section */}
                    <h4 className="text-lg font-semibold mt-8 mb-4">Payslip Calculation Preview</h4>
                    <div className="mb-4">
                        <button
                            onClick={handlePreviewPayslipCalculation}
                            disabled={loadingPayslipPreview || !selectedEmployeeForSalary}
                            className={`px-6 py-2 rounded-md transition-colors duration-200 ${loadingPayslipPreview || !selectedEmployeeForSalary ? 'bg-gray-400' : 'bg-purple-600 hover:bg-purple-700'} text-white`}
                        >
                            {loadingPayslipPreview ? 'Calculating Preview...' : 'Calculate Payslip Preview'}
                        </button>
                    </div>

                    {previewCalculatedPayslip && (
                        <div className={`p-4 rounded-lg shadow-inner ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                            <h5 className="text-lg font-semibold mb-2">Preview for {employees.find(emp => emp.id == selectedEmployeeForSalary)?.name} - {moment().month(selectedAttendanceMonth - 1).format('MMMM')} {selectedAttendanceYear}</h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <h6 className="font-medium text-blue-600 dark:text-blue-400">Earnings</h6>
                                    <p>Basic Salary: ₹{previewCalculatedPayslip.basic_salary}</p>
                                    <p>HRA: ₹{previewCalculatedPayslip.hra}</p>
                                    <p>Conveyance Allowance: ₹{previewCalculatedPayslip.conveyance_allowance}</p>
                                    <p>Medical Allowance: ₹{previewCalculatedPayslip.medical_allowance}</p>
                                    <p>Special Allowance: ₹{previewCalculatedPayslip.special_allowance}</p>
                                    <p>LTA: ₹{previewCalculatedPayslip.lta}</p>
                                    {previewCalculatedPayslip.other_earnings && Object.keys(previewCalculatedPayslip.other_earnings).length > 0 && (
                                        <>
                                            <p className="font-medium mt-2">Other Earnings:</p>
                                            {Object.entries(previewCalculatedPayslip.other_earnings).map(([key, value]) => (
                                                <p key={key} className="ml-2 text-sm">{key}: ₹{value}</p>
                                            ))}
                                        </>
                                    )}
                                    <p className="mt-2 font-bold">Gross Earnings: ₹{previewCalculatedPayslip.gross_earnings}</p>
                                </div>
                                <div>
                                    <h6 className="font-medium text-red-600 dark:text-red-400">Deductions</h6>
                                    <p>EPF (Employee): ₹{previewCalculatedPayslip.epf_employee}</p>
                                    <p>ESI (Employee): ₹{previewCalculatedPayslip.esi_employee}</p>
                                    <p>Professional Tax: ₹{previewCalculatedPayslip.professional_tax}</p>
                                    <p>TDS: ₹{previewCalculatedPayslip.tds}</p>
                                    <p>Loan Deduction: ₹{previewCalculatedPayslip.loan_deduction}</p>
                                    {previewCalculatedPayslip.other_deductions && Object.keys(previewCalculatedPayslip.other_deductions).length > 0 && (
                                        <>
                                            <p className="font-medium mt-2">Other Deductions:</p>
                                            {Object.entries(previewCalculatedPayslip.other_deductions).map(([key, value]) => (
                                                <p key={key} className="ml-2 text-sm">{key}: ₹{value}</p>
                                            ))}
                                        </>
                                    )}
                                    <p className="mt-2 font-bold">Total Deductions: ₹{previewCalculatedPayslip.total_deductions}</p>
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600">
                                <p className="text-2xl font-bold text-green-700 dark:text-green-300">Net Pay: ₹{previewCalculatedPayslip.net_pay}</p>
                            </div>
                        </div>
                    )}


                    <h4 className="text-lg font-semibold mt-8 mb-4">Employee's Salary History</h4>
                    {selectedEmployeeForSalary && employeeSalaryStructures.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Effective Date</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Basic</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">HRA</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Gross</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Other Earnings</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th> {/* Added Actions column */}
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {employeeSalaryStructures.map(structure => (
                                        <tr key={structure.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{structure.effective_date}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">₹{structure.basic_salary}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">₹{structure.hra}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">₹{structure.gross_salary}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">{JSON.stringify(structure.other_earnings)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button
                                                    onClick={() => handleEditSalaryStructure(structure)}
                                                    className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors duration-200"
                                                >
                                                    Edit
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-gray-500 dark:text-gray-400">Select an employee to view their salary structures or no structures found.</p>
                    )}
                </div>
            )}

            {/* Payroll Run Tab Content */}
            {activeSubTab === 'payroll-run' && (
                <div className="space-y-6">
                    <h3 className="text-xl font-semibold mb-4">Run Monthly Payroll</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="payrollMonth" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Month</label>
                            <select id="payrollMonth" value={payrollRunMonth} onChange={(e) => setPayrollRunMonth(parseInt(e.target.value))}
                                className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                {moment.months().map((monthName, index) => (
                                    <option key={index + 1} value={index + 1}>{monthName}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="payrollYear" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Year</label>
                            <input type="number" id="payrollYear" value={payrollRunYear} onChange={(e) => setPayrollRunYear(parseInt(e.target.value))}
                                className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                min="2000" max="2100" />
                        </div>
                    </div>
                    <button onClick={handleRunPayroll} disabled={runningPayroll}
                        className={`px-6 py-2 rounded-md transition-colors duration-200 ${runningPayroll ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'} text-white`}>
                        {runningPayroll ? 'Calculating...' : 'Run Payroll'}
                    </button>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        Running payroll will calculate payslips for all active employees for the selected month and year based on their salary structures, attendance, and company settings.
                    </p>
                </div>
            )}


            {/* Payslip Upload Tab Content */}
            {activeSubTab === 'payslip-upload' && (
                <div className="space-y-6">
                    <h3 className="text-xl font-semibold mb-4">Upload Payslip PDF</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="uploadEmployeeSelect" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Select Employee</label>
                            <select id="uploadEmployeeSelect" value={selectedEmployeeForPayslip} onChange={(e) => setSelectedEmployeeForPayslip(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                <option value="">-- Select Employee --</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_id})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="payslipUploadMonth" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Month</label>
                            <select id="payslipUploadMonth" value={payslipMonth} onChange={(e) => setPayslipMonth(parseInt(e.target.value))}
                                className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                {moment.months().map((monthName, index) => (
                                    <option key={index + 1} value={index + 1}>{monthName}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="payslipUploadYear" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Year</label>
                            <input type="number" id="payslipUploadYear" value={payslipYear} onChange={(e) => setPayslipYear(parseInt(e.target.value))}
                                className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                min="2000" max="2100" />
                        </div>
                        <div className="md:col-span-2">
                            <label htmlFor="payslipFile" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Payslip PDF File</label>
                            <input type="file" id="payslipFile" accept="application/pdf" onChange={handlePayslipFileChange}
                                className="mt-1 block w-full text-sm text-gray-900 dark:text-gray-300
                                           file:mr-4 file:py-2 file:px-4
                                           file:rounded-md file:border-0
                                           file:text-sm file:font-semibold
                                           file:bg-blue-50 file:text-blue-700
                                           hover:file:bg-blue-100" />
                            {payslipFile && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Selected: {payslipFile.name}</p>}
                        </div>
                    </div>
                    <button onClick={handlePayslipUpload} disabled={uploadingPayslip}
                        className={`px-6 py-2 rounded-md transition-colors duration-200 ${uploadingPayslip ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} text-white`}>
                        {uploadingPayslip ? 'Uploading...' : 'Upload Payslip'}
                    </button>
                </div>
            )}
        </section>
    );
};

// Make the component globally accessible
window.AdminPayrollManagement = AdminPayrollManagement;
