import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment-timezone';
import { saveAs } from 'file-saver';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './output.css'; // Assuming this is your Tailwind CSS output file

const localizer = momentLocalizer(moment);
const DnDCalendar = withDragAndDrop(Calendar);

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001'; // Updated for local development to port 3001

const axiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        console.log('Attempting to refresh token...');
        const { data } = await axiosInstance.post('/auth/refresh');
        console.log('Token refreshed successfully');
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('user', JSON.stringify(data.user)); // Update user in local storage as well
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        console.error('Refresh token failed:', {
          message: refreshError.message,
          response: refreshError.response?.data,
          status: refreshError.response?.status,
        });
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user'); // Also remove user data if token refresh fails
        // Prevent auto-redirect to avoid refresh loop
        return Promise.reject(refreshError);
      }
    }
    console.error('API error:', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.response?.data?.message,
    });
    return Promise.reject(error);
  }
);


// AuthForms Component (Login Page)
const AuthForms = ({ authView, setToken, setUser, setRole, darkMode, toggleDarkMode }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [name, setName] = useState(''); // For registration
  const [employeeId, setEmployeeId] = useState(''); // For registration
  const [roleInput, setRoleInput] = useState('employee'); // For registration, default to employee
  const [shiftType, setShiftType] = useState('day'); // For registration, default to day

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axiosInstance.post('/auth/login', { email, password });
      localStorage.setItem('accessToken', res.data.accessToken);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setToken(res.data.accessToken);
      setUser(res.data.user);
      setRole(res.data.user.role);
      alert('Login successful!');
    } catch (err) {
      alert('Login failed: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const res = await axiosInstance.post('/register', { name, email, password, employee_id: employeeId, role: roleInput, shift_type: shiftType });
      alert('Registration successful! Please login.');
      // Optionally auto-login or redirect to login
      setEmail('');
      setPassword('');
      setName('');
      setEmployeeId('');
      setRoleInput('employee');
      setShiftType('day');
    } catch (err) {
      alert('Registration failed: ' + (err.response?.data?.message || err.message));
    }
  };


  const handleResetPassword = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/auth/reset-password`, { token: new URLSearchParams(window.location.search).get('token'), newPassword });
      alert('Password reset successful! Please login.');
      window.location.href = '/';
    } catch (err) {
      alert('Reset password failed: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
      <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-xl transform transition-all duration-300 hover:shadow-3xl">
        <div className="flex justify-end mb-4">
          <button
            onClick={toggleDarkMode}
            className="text-sm text-blue-500 hover:text-blue-600 transition-colors duration-200 font-medium"
          >
            Toggle {darkMode ? 'Light' : 'Dark'} Mode
          </button>
        </div>
        {authView === 'login' ? (
          <>
            <h2 className="text-3xl font-bold mb-6 text-center text-gray-800 dark:text-white">Welcome Back</h2>
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  placeholder="Enter your email"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  placeholder="Enter your password"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-700 transition-all duration-200 font-semibold"
              >
                Sign In
              </button>
            </form>
            <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
              Don't have an account?{' '}
              <a href="/?view=register" className="text-blue-500 hover:text-blue-600 font-medium transition-colors duration-200">
                Register here
              </a>
            </p>
            <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
              Forgot your password?{' '}
              <a href="/?view=resetPassword" className="text-blue-500 hover:text-blue-600 font-medium transition-colors duration-200">
                Reset it here
              </a>
            </p>
          </>
        ) : authView === 'register' ? (
          <>
            <h2 className="text-3xl font-bold mb-6 text-center text-gray-800 dark:text-white">Register New Account</h2>
            <form onSubmit={handleRegister} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-3 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Your Name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Your Email"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Choose a strong password"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Employee ID</label>
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full p-3 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Unique Employee ID"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Role</label>
                <select
                  value={roleInput}
                  onChange={(e) => setRoleInput(e.target.value)}
                  className="w-full p-3 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                >
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Shift Type</label>
                <select
                  value={shiftType}
                  onChange={(e) => setShiftType(e.target.value)}
                  className="w-full p-3 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                >
                  <option value="day">Day Shift</option>
                  <option value="evening">Evening Shift</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full bg-green-500 text-white p-3 rounded-lg hover:bg-green-600 focus:ring-4 focus:ring-green-300 dark:focus:ring-green-700 transition-all duration-200 font-semibold"
              >
                Register
              </button>
            </form>
            <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
              Already have an account?{' '}
              <a href="/" className="text-blue-500 hover:text-blue-600 font-medium transition-colors duration-200">
                Login here
              </a>
            </p>
          </>
        ) : (
          <>
            <h2 className="text-3xl font-bold mb-6 text-center text-gray-800 dark:text-white">Reset Password</h2>
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-3 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Enter new password"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 focus:ring-4 focus:ring-300 dark:focus:ring-blue-700 transition-all duration-200 font-semibold"
              >
                Reset Password
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

// LeaveApplicationForm Component
const LeaveApplicationForm = ({ onApplyLeave, darkMode }) => {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [totalDays, setTotalDays] = useState(0);

  // Calculate total days when dates change
  useEffect(() => {
    if (fromDate && toDate) {
      const start = moment(fromDate);
      const end = moment(toDate);
      if (end.isSameOrAfter(start)) {
        setTotalDays(end.diff(start, 'days') + 1);
      } else {
        setTotalDays(0);
      }
    } else {
      setTotalDays(0);
    }
  }, [fromDate, toDate]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (totalDays <= 0) {
      alert('Please select a valid leave duration (To Date must be on or after From Date).');
      return;
    }
    onApplyLeave(fromDate, toDate, reason);
    setFromDate('');
    setToDate('');
    setReason('');
    setTotalDays(0); // Reset total days after submission
  }, [fromDate, toDate, reason, onApplyLeave, totalDays]);

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium mb-1">From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            required
          />
        </div>
      </div>
      {totalDays > 0 && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          Total days of leave: <span className="font-semibold">{totalDays}</span>
        </p>
      )}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Reason</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          rows="4"
          required
        />
      </div>
      <button type="submit" className="bg-green-500 text-white p-2 rounded hover:bg-green-600">
        Apply Leave
      </button>
    </form>
  );
};

// AdminPanel Component
const AdminPanel = ({ allLeaves, allCorrections, handleLeaveApproval, handleCorrectionApproval, allEmployeeAttendance, fetchAllEmployeeAttendance, monthlySummary, fetchAllEmployeeMonthlySummary, darkMode, handleExportAttendance }) => {
  const [selectedDate, setSelectedDate] = useState(moment().tz('Asia/Kolkata').format('YYYY-MM-DD'));
  const [selectedAnalyticsYear, setSelectedAnalyticsYear] = useState(moment().tz('Asia/Kolkata').year());
  const [selectedAnalyticsMonth, setSelectedAnalyticsMonth] = useState(moment().tz('Asia/Kolkata').month() + 1); // Month is 0-indexed in moment
  const [exportEmployeeId, setExportEmployeeId] = useState('');
  const [exportEmployeeName, setExportEmployeeName] = useState('');


  useEffect(() => {
    fetchAllEmployeeAttendance(selectedDate);
  }, [selectedDate, fetchAllEmployeeAttendance]);

  // Fetch monthly summary when year or month changes for analytics
  useEffect(() => {
    fetchAllEmployeeMonthlySummary(selectedAnalyticsYear, selectedAnalyticsMonth);
  }, [selectedAnalyticsYear, selectedAnalyticsMonth, fetchAllEmployeeMonthlySummary]);


  return (
    <div>
      <h3 className="text-lg mb-3">Manage Leaves</h3>
      <ul className="list-disc pl-5 space-y-2 mb-6 max-h-48 overflow-y-auto scrollbar-thin">
        {allLeaves.length > 0 ? (
          allLeaves.map((l, i) => (
            <li key={i} className="py-1 flex justify-between items-center text-sm">
              <span>
                <strong>{l.user_name} ({l.employee_id})</strong> applied for leave: {moment(l.from_date).tz('Asia/Kolkata').format('YYYY-MM-DD')} to {moment(l.to_date).tz('Asia/Kolkata').format('YYYY-MM-DD')} - {l.reason}
                {/* Apply toLowerCase and replace for status badge */}
                <span className={`status-badge status-badge-${l.status?.toLowerCase().replace(/\s/g, '-') || 'unknown'}`}>
                  [{l.status}]
                </span>
                {l.assigned_admin_name && <span className="ml-2 text-gray-500 dark:text-gray-400"> (Assigned to: {l.assigned_admin_name})</span>}
              </span>
              {/* Actions based on leave status */}
              {l.status === 'pending' && (
                <div>
                  <button
                    onClick={() => handleLeaveApproval(l.id, 'approved')}
                    className="bg-green-500 text-white px-2 py-1 rounded mr-2 hover:bg-green-600"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleLeaveApproval(l.id, 'rejected')}
                    className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                  >
                    Reject
                  </button>
                </div>
              )}
              {l.status === 'cancellation_pending' && (
                <div>
                  <button
                    onClick={() => handleLeaveApproval(l.id, 'cancellation_approved')}
                    className="bg-yellow-500 text-white px-2 py-1 rounded mr-2 hover:bg-yellow-600"
                  >
                    Approve Cancellation
                  </button>
                  <button
                    onClick={() => handleLeaveApproval(l.id, 'cancellation_rejected')}
                    className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                  >
                    Reject Cancellation
                  </button>
                </div>
              )}
            </li>
          ))
        ) : (
          <p>No leave requests found.</p>
        )}
      </ul>
      <h3 className="text-lg mb-3">Manage Correction Requests</h3>
      <ul className="list-disc pl-5 space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
        {allCorrections.length > 0 ? (
          allCorrections.map((c, i) => (
            <li key={i} className="py-1 flex justify-between items-center text-sm">
              <span>
                <strong>{c.user_name} ({c.employee_id})</strong> requested correction for: {moment(c.date).tz('Asia/Kolkata').format('YYYY-MM-DD')} - {c.reason}
                {/* Apply toLowerCase and replace for status badge */}
                <span className={`status-badge status-badge-${c.status?.toLowerCase().replace(/\s/g, '-') || 'unknown'}`}>
                  [{c.status}]
                </span>
                {c.assigned_admin_name && <span className="ml-2 text-gray-500 dark:text-gray-400"> (Assigned to: {c.assigned_admin_name})</span>}
              </span>
              {c.status === 'pending' && (
                <div>
                  <button
                    onClick={() => handleCorrectionApproval(c.id, 'approved')}
                    className="bg-green-500 text-white px-2 py-1 rounded mr-2 hover:bg-green-600"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleCorrectionApproval(c.id, 'rejected')}
                    className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                  >
                    Reject
                  </button>
                </div>
              )}
            </li>
          ))
        ) : (
          <p>No correction requests found.</p>
        )}
      </ul>

      <h3 className="text-lg mt-6 mb-3">Daily Employee Attendance Overview</h3>
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Select Date:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden text-sm">
          <thead className="bg-gray-200 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold">Employee Name</th>
              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold">Employee ID</th>
              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold">Shift Type</th>
              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold">Status</th>
              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold">Check-in</th>
              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold">Check-out</th>
            </tr>
          </thead>
          <tbody>
            {allEmployeeAttendance.length > 0 ? (
              allEmployeeAttendance.map((emp, index) => (
                <tr key={emp.user_id} className={index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-750' : 'bg-white dark:bg-gray-800'}>
                  <td className="px-4 py-2 whitespace-nowrap">{emp.name}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{emp.employee_id}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{emp.shift_type}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {/* Add optional chaining and fallback for status */}
                    <span className={`status-badge status-badge-${emp.status?.toLowerCase().replace(/\s/g, '-') || 'unknown'}`}>
                      {emp.status || 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">{emp.check_in || 'N/A'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{emp.check_out || 'N/A'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="px-4 py-2 text-center">No employee attendance data found for this date.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h3 className="text-lg mt-6 mb-3">Monthly Employee Summary</h3>
      <div className="flex space-x-4 mb-4">
        <label className="block text-sm font-medium mb-1">Year:</label>
        <input
          type="number"
          value={selectedAnalyticsYear}
          onChange={(e) => setSelectedAnalyticsYear(parseInt(e.target.value, 10))}
          className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white w-24"
          min="2000"
          max="2099"
        />
        <label className="block text-sm font-medium mb-1">Month:</label>
        <input
          type="number"
          value={selectedAnalyticsMonth}
          onChange={(e) => setSelectedAnalyticsMonth(parseInt(e.target.value, 10))}
          className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white w-24"
          min="1"
          max="12"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden text-sm">
          <thead className="bg-gray-200 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold">Employee Name</th>
              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold">Employee ID</th>
              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold">Present Days</th>
              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold">Leave Days</th>
            </tr>
          </thead>
          <tbody>
            {monthlySummary.length > 0 ? (
              monthlySummary.map((emp, index) => (
                <tr key={emp.user_id} className={index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-750' : 'bg-white dark:bg-gray-800'}>
                  <td className="px-4 py-2 whitespace-nowrap">{emp.name}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{emp.employee_id}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{emp.present_days}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{emp.leave_days}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="px-4 py-2 text-center">No monthly summary data found for the selected period.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>


      <h3 className="text-lg mt-6 mb-3">Export Attendance Data</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="exportYear" className="block text-sm font-medium mb-1">Year:</label>
          <input
            type="number"
            placeholder="Year (e.g., 2025)"
            className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white w-full"
            id="exportYear"
            min="2000"
            max="2099"
          />
        </div>
        <div>
          <label htmlFor="exportMonth" className="block text-sm font-medium mb-1">Month:</label>
          <input
            type="number"
            placeholder="Month (1-12)"
            className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white w-full"
            id="exportMonth"
            min="1"
            max="12"
          />
        </div>
        <div>
          <label htmlFor="exportEmployeeId" className="block text-sm font-medium mb-1">Employee ID (Optional):</label>
          <input
            type="text"
            placeholder="Employee ID"
            className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white w-full"
            value={exportEmployeeId}
            onChange={(e) => setExportEmployeeId(e.target.value)}
            id="exportEmployeeId"
          />
        </div>
        <div>
          <label htmlFor="exportEmployeeName" className="block text-sm font-medium mb-1">Employee Name (Optional):</label>
          <input
            type="text"
            placeholder="Employee Name"
            className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white w-full"
            value={exportEmployeeName}
            onChange={(e) => setExportEmployeeName(e.target.value)}
            id="exportEmployeeName"
          />
        </div>
      </div>
      <button
        onClick={() => {
          const year = document.getElementById('exportYear').value;
          const month = document.getElementById('exportMonth').value;
          // Pass exportEmployeeId and exportEmployeeName to the handler
          if (year && month) {
            handleExportAttendance(year, month, exportEmployeeId, exportEmployeeName);
          } else {
            alert('Please enter year and month.');
          }
        }}
        className="btn-primary"
      >
        Download CSV
      </button>
    </div>
  );
};

// ChangePasswordModal Component
const ChangePasswordModal = ({ onClose, onChangePassword, darkMode }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    onChangePassword(currentPassword, newPassword);
    setCurrentPassword('');
    setNewPassword('');
  }, [currentPassword, newPassword, onChangePassword]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
        <h2 className="text-xl font-bold mb-4">Change Password</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              required
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button type="button" onClick={onClose} className="bg-gray-500 text-white p-2 rounded hover:bg-gray-600">
              Cancel
            </button>
            <button type="submit" className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600">
              Change Password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// CorrectionRequestModal Component
const CorrectionRequestModal = ({ onClose, onSubmit, darkMode }) => {
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    onSubmit(date, reason);
    setDate('');
    setReason('');
  }, [date, reason, onSubmit]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
        <h2 className="text-xl font-bold mb-4">Request Attendance Correction</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              rows="4"
              required
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button type="button" onClick={onClose} className="bg-gray-500 text-white p-2 rounded hover:bg-gray-600">
              Cancel
            </button>
            <button type="submit" className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600">
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// CancelLeaveModal Component
const CancelLeaveModal = ({ onClose, onConfirmCancel, leaveId, darkMode }) => {
  const handleConfirm = useCallback(() => {
    onConfirmCancel(leaveId);
    onClose();
  }, [onConfirmCancel, leaveId, onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-xs ${darkMode ? 'text-white' : 'text-gray-900'}`}>
        <h2 className="text-xl font-bold mb-4">Confirm Cancellation</h2>
        <p className="mb-6">Are you sure you want to request cancellation for this leave?</p>
        <div className="flex justify-end space-x-2">
          <button type="button" onClick={onClose} className="bg-gray-500 text-white p-2 rounded hover:bg-gray-600">
            No, Keep It
          </button>
          <button type="button" onClick={handleConfirm} className="bg-red-500 text-white p-2 rounded hover:bg-red-600">
            Yes, Request Cancellation
          </button>
        </div>
      </div>
    </div>
  );
};


// Main App Component
function App() {
  const [token, setToken] = useState(localStorage.getItem('accessToken'));
  const [role, setRole] = useState(null);
  const [tab, setTab] = useState('attendance');
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showCorrectionRequestModal, setShowCorrectionRequestModal] = useState(false);
  const [showCancelLeaveModal, setShowCancelLeaveModal] = useState(false);
  const [selectedLeaveToCancel, setSelectedLeaveToCancel] = useState(null);
  const [allLeaves, setAllLeaves] = useState([]);
  const [allCorrections, setAllCorrections] = useState([]);
  const [allEmployeeAttendance, setAllEmployeeAttendance] = useState([]); // New state for all employee daily attendance
  const [monthlySummary, setMonthlySummary] = useState([]); // New state for monthly summary
  const [today, setToday] = useState(moment.tz('Asia/Kolkata').format('YYYY-MM-DD'));
  const [user, setUser] = useState(null);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [analytics, setAnalytics] = useState({
    presentDays: 0,
    weeklyOffs: 0,
    leavesTaken: 0,
    holidays: 0
  });

  // useCallback for logout
  const handleLogout = useCallback(async () => {
    try {
      await axiosInstance.post('/auth/logout'); // Assuming a logout endpoint
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      setToken(null);
      setUser(null);
      setRole(null);
      setTodayAttendance(null);
      setAttendance([]);
      setLeaves([]);
      setCorrections([]);
      setCalendarEvents([]);
      setAllLeaves([]);
      setAllCorrections([]);
      setAllEmployeeAttendance([]); // Clear all employee attendance
      setMonthlySummary([]); // Clear monthly summary
      setHolidays([]);
      setTab('attendance');
      setAnalytics({ presentDays: 0, weeklyOffs: 0, leavesTaken: 0, holidays: 0 });
      alert('Logged out successfully!');
    } catch (err) {
      console.error('Logout failed:', err);
      alert('Logout failed. Please try again.');
      // Even if logout fails on client, clear client-side data
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      setToken(null);
      setUser(null);
      setRole(null);
    }
  }, []);

  // Define fetch functions with useCallback and error handling
  const fetchAttendance = useCallback(async () => {
    try {
      const res = await axiosInstance.get(`/attendance`);
      console.log('Fetched attendance data:', res.data);
      setAttendance(res.data);
    } catch (err) {
      console.error('Error fetching attendance:', err);
      if (err.response?.status === 401) handleLogout();
      // alert('Failed to fetch attendance data.'); // Removed to avoid multiple alerts
    }
  }, [handleLogout]);

  const fetchLeaves = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get('/leaves');
      setLeaves(data);
    } catch (error) {
      console.error('Error fetching leaves:', error);
      if (error.response?.status === 401) handleLogout();
    }
  }, [handleLogout]);

  const fetchHolidays = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get('/holidays');
      setHolidays(data);
    } catch (error) {
      console.error('Error fetching holidays:', error);
      if (error.response?.status === 404) {
        console.warn('Holidays endpoint not found; using empty holidays list.');
        setHolidays([]);
      } else if (error.response?.status === 401) {
        handleLogout();
      }
    }
  }, [handleLogout]);

  const fetchCorrections = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get('/attendance/corrections');
      setCorrections(data);
    } catch (error) {
      console.error('Error fetching corrections:', error);
      if (error.response?.status === 401) handleLogout();
    }
  }, [handleLogout]);

  const fetchAllAdminLeaves = useCallback(async () => {
    if (user?.role === 'admin') {
      try {
        const { data } = await axiosInstance.get('/admin/leaves');
        setAllLeaves(data);
      } catch (error) {
        console.error('Error fetching all admin leaves:', error);
        if (error.response?.status === 401) handleLogout();
      }
    }
  }, [user?.role, handleLogout]);

  const fetchAllAdminCorrections = useCallback(async () => {
    if (user?.role === 'admin') {
      try {
        const { data } = await axiosInstance.get('/admin/attendance/corrections');
        setAllCorrections(data);
      } catch (error) {
        console.error('Error fetching all admin corrections:', error);
        if (error.response?.status === 401) handleLogout();
      }
    }
  }, [user?.role, handleLogout]);

  const fetchAllEmployeeAttendance = useCallback(async (date) => {
    if (user?.role === 'admin') {
      try {
        const { data } = await axiosInstance.get(`/admin/attendance/daily?date=${date}`);
        setAllEmployeeAttendance(data);
      } catch (error) {
        console.error('Error fetching all employee daily attendance:', error);
        if (error.response?.status === 401) handleLogout();
      }
    }
  }, [user?.role, handleLogout]);

  // New function to fetch monthly summary for all employees
  const fetchAllEmployeeMonthlySummary = useCallback(async (year, month) => {
    if (user?.role === 'admin') {
      try {
        const { data } = await axiosInstance.get(`/admin/analytics/monthly-summary?year=${year}&month=${month}`);
        setMonthlySummary(data);
      } catch (error) {
        console.error('Error fetching all employee monthly summary:', error);
        if (error.response?.status === 401) handleLogout();
      }
    }
  }, [user?.role, handleLogout]);


  const fetchAllAdminData = useCallback(async () => {
    await Promise.all([
      fetchAllAdminLeaves(),
      fetchAllAdminCorrections(),
      // fetchAllEmployeeAttendance(moment().tz('Asia/Kolkata').format('YYYY-MM-DD')) // Fetch for today by default
      fetchAllEmployeeMonthlySummary(moment().tz('Asia/Kolkata').year(), moment().tz('Asia/Kolkata').month() + 1) // Initial fetch for monthly summary
    ]);
  }, [fetchAllAdminLeaves, fetchAllAdminCorrections, fetchAllEmployeeMonthlySummary]); // Removed fetchAllEmployeeAttendance here to avoid double fetch, it's called in AdminPanel useEffect


  // Define refreshUserData with useCallback
  const refreshUserData = useCallback(async () => {
    if (isCheckingIn) {
      console.log('Skipping refreshUserData during check-in');
      return;
    }
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      console.warn('No access token found, skipping attendance fetch and clearing user state.');
      setUser(null); // Clear user state if no token
      setRole(null);
      return;
    }
    try {
      const todayFormatted = moment().tz('Asia/Kolkata').format('YYYY-MM-DD');
      console.log('Refreshing data for date:', todayFormatted);

      const res = await axiosInstance.get('/attendance');
      const allRecords = res.data;
      console.log('Fetched attendance records:', allRecords);
      const todayRecord = allRecords.find(a => moment(a.date).tz('Asia/Kolkata').format('YYYY-MM-DD') === todayFormatted);
      console.log('Today\'s attendance record:', todayRecord);
      setAttendance(allRecords);
      setTodayAttendance(todayRecord || null);

      await Promise.all([fetchLeaves(), fetchCorrections(), fetchHolidays()]);

    } catch (error) {
      console.error('Failed to fetch user data or attendance:', {
        message: error.message,
        status: error.response?.status,
        url: error.config?.url,
      });
      if (error.response?.status === 401) {
        console.warn('Unauthorized during data refresh, logging out.');
        handleLogout(); // Force logout if refresh fails
      }
      setTodayAttendance(null);
    }
  }, [isCheckingIn, fetchLeaves, fetchCorrections, fetchHolidays, handleLogout]); // fetchAttendance dependency removed as it's called internally


  // Analytics Update Logic (New useEffect for analytics)
  const updateAnalytics = useCallback(() => {
    const startOfMonth = moment().tz('Asia/Kolkata').startOf('month');
    const endOfMonth = moment().tz('Asia/Kolkata').endOf('month');
    let presentDays = 0;
    let weeklyOffs = 0;
    let leavesTaken = 0; // Will be total days
    let holidaysCount = 0; // Initialize holidaysCount

    presentDays = attendance.filter(a =>
      moment(a.date).tz('Asia/Kolkata').isBetween(startOfMonth, endOfMonth, null, '[]') &&
      a.status && ['present', 'late'].includes(a.status.toLowerCase()) // Only count actual presence
    ).length;

    let currentDay = startOfMonth.clone();
    while (currentDay.isSameOrBefore(endOfMonth)) {
      if (currentDay.day() === 0 || currentDay.day() === 6) { // Sunday or Saturday
        const hasAttendance = attendance.some(a =>
          moment(a.date).tz('Asia/Kolkata').format('YYYY-MM-DD') === currentDay.format('YYYY-MM-DD')
        );
        if (!hasAttendance) weeklyOffs++;
      }
      currentDay.add(1, 'day');
    }

    leaves.filter(l => l.status === 'approved').forEach(l => {
      const leaveStart = moment(l.from_date).tz('Asia/Kolkata');
      const leaveEnd = moment(l.to_date).tz('Asia/Kolkata');

      // Calculate the intersection of the leave period with the current month
      const effectiveStart = moment.max(leaveStart, startOfMonth);
      const effectiveEnd = moment.min(leaveEnd, endOfMonth);

      // Only count days if the effective period is valid (start is before or same as end)
      if (effectiveStart.isSameOrBefore(effectiveEnd)) {
        // Corrected calculation for leavesTaken
        leavesTaken += effectiveEnd.diff(effectiveStart, 'days') + 1;
      }
    });

    // Count holidays within the current month
    holidaysCount = holidays.filter(h =>
      moment(h.date).tz('Asia/Kolkata').isBetween(startOfMonth, endOfMonth, null, '[]')
    ).length;


    setAnalytics({
      presentDays,
      weeklyOffs,
      leavesTaken,
      holidays: holidaysCount
    });
  }, [attendance, leaves, holidays]); // Dependencies for analytics

  // Effect to update analytics whenever its dependencies change
  useEffect(() => {
    updateAnalytics();
  }, [attendance, leaves, holidays, updateAnalytics]);


  // Initial load from localStorage (runs once on mount)
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedAccessToken = localStorage.getItem('accessToken');
    if (storedUser && storedAccessToken) {
      try {
        const parsedUser = JSON.parse(storedUser);
        console.log('App.jsx: Loaded user from localStorage (parsed):', parsedUser);
        setUser(parsedUser);
        setRole(parsedUser.role);
        setToken(storedAccessToken);
        console.log('App.jsx: User state SET from localStorage:', parsedUser.name);
      } catch (error) {
        console.error("App.jsx: Failed to parse user data from localStorage:", error);
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        setUser(null);
        setRole(null);
        setToken(null);
      }
    } else {
      console.log('App.jsx: No user data or token found in localStorage.');
      setUser(null);
      setRole(null);
      setToken(null);
    }
  }, []);

  // Refresh data when token or user state changes (after initial load or login)
  useEffect(() => {
    if (token && user) {
      refreshUserData();
      if (user.role === 'admin') {
        fetchAllAdminData();
        // Initial fetch for all employee attendance for today
        fetchAllEmployeeAttendance(moment().tz('Asia/Kolkata').format('YYYY-MM-DD'));
        fetchAllEmployeeMonthlySummary(moment().tz('Asia/Kolkata').year(), moment().tz('Asia/Kolkata').month() + 1); // Initial fetch for monthly summary
      }
    } else if (!token && !user) {
      setTodayAttendance(null);
      setAttendance([]);
      setLeaves([]);
      setCorrections([]);
      setCalendarEvents([]);
      setAllLeaves([]);
      setAllCorrections([]);
      setAllEmployeeAttendance([]);
      setMonthlySummary([]); // Clear monthly summary
      setHolidays([]);
      setAnalytics({ presentDays: 0, weeklyOffs: 0, leavesTaken: 0, holidays: 0 });
    }
  }, [token, user, refreshUserData, fetchAllAdminData, fetchAllEmployeeAttendance, fetchAllEmployeeMonthlySummary]);


  // Log todayAttendance updates
  useEffect(() => {
    console.log('✅ Updated todayAttendance:', todayAttendance);
  }, [todayAttendance]);

  // Update today dynamically
  useEffect(() => {
    const interval = setInterval(() => {
      const newToday = moment.tz('Asia/Kolkata').format('YYYY-MM-DD');
      if (newToday !== today) {
        console.log('Date changed, refreshing data:', newToday);
        setToday(newToday);
        setTodayAttendance(null); // Reset todayAttendance for new day
        refreshUserData(); // Fetch data for the new day
        if (user?.role === 'admin') {
          fetchAllEmployeeAttendance(newToday); // Refresh for new day for admin
          fetchAllEmployeeMonthlySummary(moment().tz('Asia/Kolkata').year(), moment().tz('Asia/Kolkata').month() + 1); // Refresh monthly summary
        }
      }
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [today, refreshUserData, user?.role, fetchAllEmployeeAttendance, fetchAllEmployeeMonthlySummary]);


  // Map attendance, leaves, and holidays to calendar events
  useEffect(() => {
    const mapped = [
      ...attendance.map(a => ({
        id: `attendance-${a.id || Math.random()}`,
        title: `Check-in: ${a.status ? a.status.toUpperCase() : 'UNKNOWN'} (${a.check_in ? moment(a.check_in).tz('Asia/Kolkata').format('h:mm A') : 'N/A'} - ${a.check_out ? moment(a.check_out).tz('Asia/Kolkata').format('h:mm A') : 'N/A'})`,
        start: new Date(moment(a.date).tz('Asia/Kolkata')),
        end: new Date(moment(a.date).tz('Asia/Kolkata')),
        allDay: true,
        resource: { type: 'attendance', status: a.status }
      })),
      ...leaves.map(l => ({
        id: `leave-${l.id || Math.random()}`,
        // Adjusted title to show actual leave duration, not just from_date
        title: `Leave: ${l.reason} [${l.status}] (${moment(l.from_date).tz('Asia/Kolkata').format('MMM D')} - ${moment(l.to_date).tz('Asia/Kolkata').format('MMM D')})`,
        start: new Date(moment(l.from_date).tz('Asia/Kolkata')),
        // React Big Calendar end date is exclusive, so add 1 day for inclusive range display
        // This is the FIX for the calendar showing one extra day
        end: new Date(moment(l.to_date).tz('Asia/Kolkata').add(1, 'days')),
        allDay: true,
        resource: { type: 'leave', status: l.status, leaveData: l }
      })),
      ...holidays.map(h => ({
        id: `holiday-${h.id || Math.random()}`,
        title: `Holiday: ${h.name}`,
        start: new Date(moment(h.date).tz('Asia/Kolkata')),
        end: new Date(moment(h.date).tz('Asia/Kolkata')),
        allDay: true,
        resource: { type: 'holiday' }
      }))
    ];
    setCalendarEvents(mapped);
  }, [attendance, leaves, holidays]);

  const handleCheckIn = useCallback(async () => {
    try {
      setIsCheckingIn(true);
      const response = await axiosInstance.post('/attendance/checkin');
      alert(`Checked in successfully! Status: ${response.data.data.status}`);
      setTodayAttendance({
        ...response.data.data,
        date: moment(response.data.data.date).tz('Asia/Kolkata').format('YYYY-MM-DD')
      });
      await refreshUserData();
    } catch (err) {
      console.error('Check-in failed:', err);
      alert('Check-in failed: ' + (err.response?.data?.message || err.message));
      if (err.response?.status === 401) handleLogout();
    } finally {
      setIsCheckingIn(false);
    }
  }, [refreshUserData, handleLogout]);

  const handleCheckOut = useCallback(async () => {
    try {
      setIsCheckingIn(true);
      const response = await axiosInstance.post('/attendance/checkout');
      alert('Checked out successfully!');
      setTodayAttendance({
        ...response.data.data,
        date: moment(response.data.data.date).tz('Asia/Kolkata').format('YYYY-MM-DD')
      });
      await refreshUserData();
    } catch (err) {
      console.error('Check-out failed:', err);
      alert('Check-out failed: ' + (err.response?.data?.message || err.message));
      if (err.response?.status === 401) handleLogout();
    } finally {
      setIsCheckingIn(false);
    }
  }, [refreshUserData, handleLogout]);

  const handleExportAttendance = useCallback(async (year, month, employeeId = '', employeeName = '') => {
    try {
      const params = { year, month };
      let filenameSuffix = '';

      if (employeeId) {
        params.employee_id = employeeId;
        filenameSuffix = `_${employeeId}`;
      } else if (employeeName) {
        params.employee_name = employeeName;
        filenameSuffix = `_${employeeName.replace(/\s/g, '_')}`; // Replace spaces for filename
      }

      const response = await axiosInstance.get('/admin/attendance/export', {
        params: params,
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'text/csv' });
      saveAs(blob, `attendance_${year}_${month}${filenameSuffix}.csv`);
      alert('Attendance data exported successfully!');
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed: ' + (err.response?.data?.message || err.message));
      if (err.response?.status === 401) handleLogout();
    }
  }, [handleLogout]);

  const refreshAdminData = useCallback(async () => {
    await Promise.all([
      fetchAllAdminLeaves(),
      fetchAllAdminCorrections(),
      fetchAllEmployeeAttendance(moment().tz('Asia/Kolkata').format('YYYY-MM-DD')), // Refresh all employee attendance for today
      fetchAllEmployeeMonthlySummary(moment().tz('Asia/Kolkata').year(), moment().tz('Asia/Kolkata').month() + 1) // Refresh monthly summary
    ]);
  }, [fetchAllAdminLeaves, fetchAllAdminCorrections, fetchAllEmployeeAttendance, fetchAllEmployeeMonthlySummary]);

  const handleCorrectionRequest = useCallback(async (date, reason) => {
    try {
      if (moment(date).isAfter(moment().tz('Asia/Kolkata'), 'day')) {
        alert('Attendance correction can only be requested for past or current dates.');
        return;
      }
      await axiosInstance.post('/attendance/correction-request', { date, reason });
      alert('Correction request submitted!');
      await refreshUserData();
      if (user?.role === 'admin') {
        await fetchAllAdminCorrections();
      }
      setShowCorrectionRequestModal(false);
    } catch (err) {
      console.error('Correction request failed:', err);
      alert('Correction request failed: ' + (err.response?.data?.message || err.message));
      if (err.response?.status === 401) handleLogout();
    }
  }, [refreshUserData, handleLogout, user?.role, fetchAllAdminCorrections]);

  const handleCorrectionApproval = useCallback(async (id, status) => {
    try {
      await axiosInstance.post('/admin/attendance/correction-review', { id, status });
      alert(`Correction ID ${id} ${status}!`);
      await refreshAdminData(); // Refresh all admin data
      await refreshUserData(); // Refresh user-specific data to reflect changes
    } catch (err) {
      console.error('Correction review failed:', err);
      alert('Correction review failed: ' + (err.response?.data?.message || err.message));
      if (err.response?.status === 401) handleLogout();
    }
  }, [refreshAdminData, refreshUserData, handleLogout]);

  const handleLeaveApproval = useCallback(async (leave_id, status) => {
    try {
      if (status === 'approved' || status === 'rejected') {
        await axiosInstance.post('/admin/leaves/update', { leave_id, status });
        alert(`Leave ID ${leave_id} ${status}!`);
      } else if (status === 'cancellation_approved' || status === 'cancellation_rejected') {
        await axiosInstance.post('/admin/leaves/update-cancellation', { leave_id, status });
        alert(`Leave ID ${leave_id} cancellation ${status.replace('cancellation_', '')}!`);
      } else {
        alert('Invalid leave status provided.');
        return;
      }
      await refreshAdminData();
      await refreshUserData();
    } catch (err) {
      console.error('Leave update failed:', err);
      alert('Leave update failed: ' + (err.response?.data?.message || err.message));
      if (err.response?.status === 401) handleLogout();
    }
  }, [refreshAdminData, refreshUserData, handleLogout]);

  const handleApplyLeave = useCallback(async (from_date, to_date, reason) => {
    try {
      console.log('Submitting leave application:', { from_date, to_date, reason });
      await axiosInstance.post('/leaves/apply', { from_date, to_date, reason });
      alert('Leave application submitted!');
      await refreshUserData();
    } catch (err) {
      console.error('Leave application failed:', err);
      alert('Leave application failed: ' + (err.response?.data?.message || err.message));
      if (err.response?.status === 401) handleLogout();
    }
  }, [refreshUserData, handleLogout]);

  const handleCancelLeaveRequest = useCallback(async (leaveId) => {
    try {
      console.log(`Requesting cancellation for leave ID: ${leaveId}`);
      await axiosInstance.post('/leaves/cancel-request', { leave_id: leaveId });
      alert('Leave cancellation request submitted successfully!');
      await refreshUserData();
      setShowCancelLeaveModal(false);
      setSelectedLeaveToCancel(null);
    } catch (err) {
      console.error('Leave cancellation request failed:', err);
      alert('Leave cancellation request failed: ' + (err.response?.data?.message || err.message));
      if (err.response?.status === 401) handleLogout();
    } finally {
      setShowCancelLeaveModal(false);
      setSelectedLeaveToCancel(null);
    }
  }, [refreshUserData, handleLogout]);

  const handleChangePassword = useCallback(async (currentPassword, newPassword) => {
    try {
      const res = await axiosInstance.post('/auth/change-password', { currentPassword, newPassword });
      alert(res.data.message);
      setShowChangePasswordModal(false);
    } catch (err) {
      console.error('Change password failed:', err.response?.data?.message || err.message);
      alert('Change password failed: ' + (err.response?.data?.message || 'Please check your current password.'));
      if (err.response?.status === 401) handleLogout();
    }
  }, [handleLogout]);

  const toggleDarkMode = useCallback(() => setDarkMode(prev => !prev), []);

  const handleEventDrop = useCallback(async ({ event, start, end }) => {
    if (event.resource.type === 'attendance' || event.resource.type === 'holiday') {
      alert('Cannot modify attendance or holiday events.');
      return;
    }
    if (event.resource.type === 'leave' && event.resource.status !== 'approved') {
      alert('Only approved leaves can be modified via drag and drop.');
      return;
    }

    try {
      const adjustedEndDate = moment(end).tz('Asia/Kolkata').subtract(1, 'days');

      if (moment(start).isAfter(adjustedEndDate)) {
        alert('Start date cannot be after end date.');
        await refreshUserData();
        return;
      }

      const updatedEvent = {
        ...event,
        start,
        end: adjustedEndDate.toDate(),
      };

      await axiosInstance.put(`/leaves/${event.resource.leaveData.id}`, {
        from_date: moment(start).tz('Asia/Kolkata').format('YYYY-MM-DD'),
        to_date: adjustedEndDate.format('YYYY-MM-DD'),
      });
      setCalendarEvents(prev =>
        prev.map(evt => (evt.id === event.id ? updatedEvent : evt))
      );
      alert('Leave event updated successfully!');
      await refreshUserData();
    } catch (err) {
      console.error('Event update failed:', err);
      alert('Failed to update event: ' + (err.response?.data?.message || err.message));
      if (err.response?.status === 401) handleLogout();
      await refreshUserData();
    }
  }, [refreshUserData, handleLogout]);

  const handleSelectSlot = useCallback(async ({ start }) => {
    if (user?.role !== 'admin') {
      alert('Only admins can add leaves directly from the calendar.');
      return;
    }
    const reason = prompt('Enter leave reason:');
    if (reason) {
      await handleApplyLeave(
        moment(start).tz('Asia/Kolkata').format('YYYY-MM-DD'),
        moment(start).tz('Asia/Kolkata').format('YYYY-MM-DD'),
        reason
      );
    }
  }, [user?.role, handleApplyLeave]);

  const urlParams = new URLSearchParams(window.location.search);
  const resetToken = urlParams.get('token');
  const authView = urlParams.get('view') === 'resetPassword' && resetToken ? 'resetPassword' : urlParams.get('view') === 'register' ? 'register' : 'login';

  if (!token) {
    return <AuthForms authView={authView} setToken={setToken} setUser={setUser} setRole={setRole} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />;
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'} p-6`}>
      <style>
        {`
          .btn:disabled {
            cursor: not-allowed;
            opacity: 0.6;
          }
          .btn-success {
            background-color: #28a745;
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            border: none;
          }
          .btn-success:hover:not(:disabled) {
            background-color: #218838;
          }
          .btn-warning {
            background-color: #f4a261;
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            border: none;
          }
          .btn-warning:disabled {
            cursor: not-allowed;
            opacity: 0.6;
            background-color: #f4a261;
            color: #fff;
          }
          .btn-warning:hover:not(:disabled) {
            background-color: #e68a41;
          }
          .btn-primary {
            background-color: #007bff;
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            border: none;
          }
          .btn-primary:hover:not(:disabled) {
            background-color: #0056b3;
          }
          .btn-danger {
            background-color: #dc3545;
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            border: none;
          }
          .btn-danger:hover:not(:disabled) {
            background-color: #c82333;
          }
          .btn-secondary {
            background-color: #6c757d;
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            border: none;
          }
          .btn-secondary:hover:not(:disabled) {
            background-color: #5a6268;
          }
          .btn-dark-toggle {
            background-color: #6b7280;
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            border: none;
          }
          .btn-dark-toggle:hover {
            background-color: #4b5563;
          }
          .tabs {
            padding: 8px 16px;
            border-radius: 4px;
            background-color: #e5e7eb;
            color: #374151;
          }
          .tabs.active {
            background-color: #3b82f6;
            color: white;
          }
          .tabs:hover:not(.active) {
            background-color: #d1d5db;
          }
          .card {
            background-color: ${darkMode ? '#1f2937' : 'white'};
            padding: 16px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 24px;
          }
          .status-badge {
            padding: 2px 8px;
            border-radius: 12px;
            margin-left: 8px;
            font-size: 0.9em;
          }
          .status-badge-present {
            background-color: #28a745;
            color: white;
          }
          .status-badge-late {
            background-color: #dc3545;
            color: white;
          }
          .status-badge-checked-in {
            background-color: #007bff;
            color: white;
          }
          .status-badge-approved {
            background-color: #28a745; /* Green for approved leaves/corrections */
            color: white;
          }
          .status-badge-pending {
            background-color: #ffc107; /* Yellow for pending */
            color: black;
          }
          .status-badge-rejected {
            background-color: #dc3545; /* Red for rejected */
            color: white;
          }
          .status-badge-cancellation-pending { /* Corrected class name */
            background-color: #fd7e14; /* Orange for cancellation pending */
            color: white;
          }
          .status-badge-cancelled {
            background-color: #6c757d; /* Gray for cancelled */
            color: white;
          }
          .status-badge-absent {
            background-color: #6c757d; /* Gray for absent */
            color: white;
          }
          .scrollbar-thin {
            scrollbar-width: thin;
          }
          .scrollbar-thin::-webkit-scrollbar {
            width: 8px;
          }
          .scrollbar-thin::-webkit-scrollbar-thumb {
            background-color: #6b7280;
            border-radius: 4px;
          }
          /* Calendar event styles */
          .rbc-event-attendance-present {
            background-color: #28a745; /* Green */
          }
          .rbc-event-attendance-late {
            background-color: #dc3545; /* Red */
          }
          .rbc-event-attendance-absent {
            background-color: #6c757d; /* Gray */
          }
          .rbc-event-attendance-checked-in {
            background-color: #007bff; /* Blue */
          }
          .rbc-event-leave-pending {
            background-color: #ffc107; /* Yellow */
          }
          .rbc-event-leave-approved {
            background-color: #28a745; /* Green */
          }
          .rbc-event-leave-rejected {
            background-color: #dc3544; /* Red */
          }
          .rbc-event-leave-cancellation_pending {
            background-color: #fd7e14; /* Orange */
          }
          .rbc-event-leave-cancelled {
            background-color: #6c757d; /* Gray */
            text-decoration: line-through; /* Strikethrough cancelled leaves */
          }
          .rbc-event-holiday {
            background-color: #6f42c1; /* Purple */
          }
        `}
      </style>
      <div className="max-w-7xl mx-auto text-center">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">
              👋 Welcome to HRMS, {user?.name || 'User'}!
            </h1>
            <p className="text-lg mt-1">
              You are logged in as <span className="font-semibold">{role}</span>. Shift: <span className="font-semibold">{user?.shift_type || 'day'}</span> {user?.employee_id && `(Employee ID: ${user.employee_id})`}
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowChangePasswordModal(true)}
              className="btn-primary"
            >
              Change Password
            </button>
            <button
              onClick={handleLogout}
              className="btn-danger"
            >
              Logout
            </button>
          </div>
        </div>

        <button
          onClick={toggleDarkMode}
          className="btn-dark-toggle mb-6"
        >
          Toggle {darkMode ? 'Light' : 'Dark'} Mode
        </button>

        <div className="flex space-x-4 mb-6 flex-wrap gap-y-2 justify-center">
          <button
            onClick={() => setTab('attendance')}
            className={`tabs ${tab === 'attendance' ? 'active' : ''}`}
          >
            Attendance
          </button>
          <button
            onClick={() => setTab('leaves')}
            className={`tabs ${tab === 'leaves' ? 'active' : ''}`}
          >
            Leaves
          </button>
          <button
            onClick={() => setTab('calendar')}
            className={`tabs ${tab === 'calendar' ? 'active' : ''}`}
          >
            Calendar
          </button>
          <button
            onClick={() => setTab('analytics')}
            className={`tabs ${tab === 'analytics' ? 'active' : ''}`}
          >
            Analytics
          </button>
          {role === 'admin' && (
            <button
              onClick={() => { setTab('admin'); refreshAdminData(); }}
              className={`tabs ${tab === 'admin' ? 'active' : ''}`}
            >
              Admin Panel
            </button>
          )}
        </div>

        {console.log("🪪 todayAttendance:", todayAttendance)}
        {tab === 'attendance' && (
          <div className="card text-left">
            <h2 className="text-xl mb-4">Attendance Actions</h2>
            <p className="mb-4">
              Expected check-in: {user?.shift_type === 'evening' ? '9:00 PM IST' : '9:00 AM IST'}
            </p>
            <div className="flex space-x-4 mb-6 flex-wrap gap-y-2">
              <button
                onClick={handleCheckIn}
                className="btn-success"
                disabled={!!todayAttendance?.check_in || isCheckingIn}
              >
                {todayAttendance?.check_in ? 'Already Checked In' : 'Check In'}
              </button>
              <button
                onClick={handleCheckOut}
                className="btn-warning"
                disabled={
                  !todayAttendance ||
                  todayAttendance.check_in === null ||
                  todayAttendance.check_out !== null ||
                  isCheckingIn
                }
                title={
                  !todayAttendance?.check_in
                    ? "You must check in before checking out."
                    : todayAttendance?.check_out
                    ? "You have already checked out today."
                    : ""
                }
              >
                Check Out
              </button>
            </div>

            <h3 className="text-lg mb-3">Today's Status</h3>
            {todayAttendance ? (
              <p className="mb-4">
                You checked in at <span className="font-medium">{moment(todayAttendance.check_in).tz('Asia/Kolkata').format('HH:mm')}</span>.
                {todayAttendance.check_out ? (
                  <>
                    You checked out at <span className="font-medium">{moment(todayAttendance.check_out).tz('Asia/Kolkata').format('HH:mm')}</span>.
                    <span className={`status-badge status-badge-${todayAttendance.status?.toLowerCase().replace(/\s/g, '-') || 'unknown'}`}>
                      Status: {todayAttendance.status}
                    </span>
                  </>
                ) : (
                  <span className="status-badge status-badge-checked-in">
                    Status: Currently Checked In
                  </span>
                )}
              </p>
            ) : (
              <p className="mb-4">No attendance record for today yet.</p>
            )}

            <h3 className="text-lg mb-3">Your Attendance Log</h3>
            <ul className="list-disc pl-5 space-y-2 scrollbar-thin max-h-96 overflow-y-auto">
              {attendance.length > 0 ? (
                attendance.map((a, i) => (
                  <li key={i} className="py-1">
                    <span className="font-medium">{moment(a.date).tz('Asia/Kolkata').format('YYYY-MM-DD')}</span>: {a.check_in ? moment(a.check_in).tz('Asia/Kolkata').format('HH:mm') : 'N/A'} - {a.check_out ? moment(a.check_out).tz('Asia/Kolkata').format('HH:mm') : 'N/A'}
                    <span className={`status-badge status-badge-${a.status?.toLowerCase().replace(/\s/g, '-') || 'unknown'}`}>
                      Status: {a.status}
                    </span>
                  </li>
                ))
              ) : (
                <p>No attendance records found.</p>
              )}
            </ul>

            <h3 className="text-lg mt-6 mb-3">Request Attendance Correction</h3>
            <button
              onClick={() => setShowCorrectionRequestModal(true)}
              className="btn-secondary"
            >
              Request Correction
            </button>

            <h3 className="text-lg mt-6 mb-3">Your Correction Requests History</h3>
            <ul className="list-disc pl-5 space-y-2 scrollbar-thin max-h-96 overflow-y-auto">
              {corrections.length > 0 ? (
                corrections.map((c, idx) => (
                  <li key={idx} className="py-1">
                    <span className="font-medium">{moment(c.date).tz('Asia/Kolkata').format('YYYY-MM-DD')}</span>: {c.reason}
                    <span className={`status-badge status-badge-${c.status?.toLowerCase().replace(/\s/g, '-') || 'unknown'}`}>
                      [{c.status}]
                    </span>
                  </li>
                ))
              ) : (
                <p>No correction requests found.</p>
              )}
            </ul>
          </div>
        )}

        {tab === 'leaves' && (
          <div className="card text-left">
            <h2 className="text-xl mb-4">Apply for Leave</h2>
            <LeaveApplicationForm onApplyLeave={handleApplyLeave} darkMode={darkMode} />
            <h3 className="text-lg mb-3">Your Leave Applications</h3>
            <ul className="list-disc pl-5 space-y-2 scrollbar-thin max-h-96 overflow-y-auto">
              {leaves.length > 0 ? (
                leaves.map((l, i) => {
                  const isFutureApprovedLeave = l.status === 'approved' && moment(l.from_date).isAfter(moment().tz('Asia/Kolkata'), 'day');
                  return (
                    <li key={i} className="py-1 flex justify-between items-center">
                      <span>
                        <span className="font-medium">{moment(l.from_date).tz('Asia/Kolkata').format('YYYY-MM-DD')} to {moment(l.to_date).tz('Asia/Kolkata').format('YYYY-MM-DD')}</span>: {l.reason}
                        <span className={`status-badge status-badge-${l.status?.toLowerCase().replace(/\s/g, '-') || 'unknown'}`}>
                          [{l.status}]
                        </span>
                      </span>
                      {isFutureApprovedLeave && (
                        <button
                          onClick={() => {
                            setSelectedLeaveToCancel(l.id);
                            setShowCancelLeaveModal(true);
                          }}
                          className="bg-yellow-500 text-white px-2 py-1 rounded ml-2 hover:bg-yellow-600 text-sm"
                        >
                          Request Cancellation
                        </button>
                      )}
                    </li>
                  );
                })
              ) : (
                <p>No leave applications found.</p>
              )}
            </ul>
          </div>
        )}

        {tab === 'calendar' && (
          <div className="card text-left">
            <h2 className="text-xl mb-4">Interactive Calendar</h2>
            <DnDCalendar
              localizer={localizer}
              events={calendarEvents}
              selectable
              onSelectSlot={handleSelectSlot}
              startAccessor="start"
              endAccessor="end"
              className="rbc-calendar"
              defaultView="month"
              views={['month', 'week', 'day']}
              eventPropGetter={(event) => {
                let className = '';
                if (event.resource) {
                  if (event.resource.type === 'attendance') {
                    // Added optional chaining and fallback for status
                    className = `rbc-event-attendance-${event.resource.status?.toLowerCase().replace(/\s/g, '-') || 'unknown'}`;
                  } else if (event.resource.type === 'leave') {
                    // Added optional chaining and fallback for status
                    className = `rbc-event-leave-${event.resource.status?.toLowerCase().replace(/\s/g, '-') || 'unknown'}`;
                  } else if (event.resource.type === 'holiday') {
                    className = 'rbc-event-holiday';
                  }
                }
                return { className };
              }}
              onEventDrop={handleEventDrop}
              resizable
              style={{ height: 600 }}
            />
          </div>
        )}

        {tab === 'analytics' && (
          <div className="card text-left">
            <h2 className="text-xl mb-4">Monthly Attendance Analytics</h2>
            <p className="mb-2">For {moment.tz('Asia/Kolkata').format('MMMMYYYY')}</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Days Present: {analytics.presentDays}</li>
              <li>Weekly Offs (Sat/Sun, no check-in): {analytics.weeklyOffs}</li>
              <li>Leaves Taken: {analytics.leavesTaken}</li>
              <li>Holidays: {analytics.holidays}</li>
            </ul>
          </div>
        )}

        {role === 'admin' && tab === 'admin' && (
          <div className="card text-left">
            <h2 className="text-xl mb-4">Admin Panel</h2>
            <AdminPanel
              allLeaves={allLeaves}
              allCorrections={allCorrections}
              handleLeaveApproval={handleLeaveApproval}
              handleCorrectionApproval={handleCorrectionApproval}
              allEmployeeAttendance={allEmployeeAttendance}
              fetchAllEmployeeAttendance={fetchAllEmployeeAttendance}
              monthlySummary={monthlySummary}
              fetchAllEmployeeMonthlySummary={fetchAllEmployeeMonthlySummary}
              darkMode={darkMode}
              handleExportAttendance={handleExportAttendance}
            />
          </div>
        )}

        {showChangePasswordModal && (
          <ChangePasswordModal
            onClose={() => setShowChangePasswordModal(false)}
            onChangePassword={handleChangePassword}
            darkMode={darkMode}
          />
        )}

        {showCorrectionRequestModal && (
          <CorrectionRequestModal
            onClose={() => setShowCorrectionRequestModal(false)}
            onSubmit={handleCorrectionRequest}
            darkMode={darkMode}
          />
        )}

        {showCancelLeaveModal && (
          <CancelLeaveModal
            onClose={() => {
              setShowCancelLeaveModal(false);
              setSelectedLeaveToCancel(null);
            }}
            onConfirmCancel={handleCancelLeaveRequest}
            leaveId={selectedLeaveToCancel}
            darkMode={darkMode}
          />
        )}
      </div>
    </div>
  );
}

export default App;
