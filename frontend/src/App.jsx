import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './output.css';

const localizer = momentLocalizer(moment);
const DnDCalendar = withDragAndDrop(Calendar);

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [role, setRole] = useState(null);
  const [tab, setTab] = useState('attendance');
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showCorrectionRequestModal, setShowCorrectionRequestModal] = useState(false);
  const [allLeaves, setAllLeaves] = useState([]);
  const [allCorrections, setAllCorrections] = useState([]);
  const [today, setToday] = useState(moment().format('YYYY-MM-DD'));

  // Update today dynamically
  useEffect(() => {
    const interval = setInterval(() => {
      const newToday = moment().format('YYYY-MM-DD');
      if (newToday !== today) {
        setToday(newToday);
        refreshUserData();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [today]);

  const todayAttendance = useMemo(() => {
    return attendance.find(a => moment(a.date).format('YYYY-MM-DD') === today);
  }, [attendance, today]);

  // Decode token and fetch initial data
  useEffect(() => {
    if (token) {
      try {
        const decoded = jwtDecode(token);
        axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;
        setRole(decoded.role);
        refreshUserData();
        if (decoded.role === 'admin') {
          fetchAllAdminData();
        }
      } catch (err) {
        console.error('Token decoding failed:', err);
        handleLogout();
      }
    }
  }, [token]);

  // Map attendance and leaves to calendar events
  useEffect(() => {
    const mapped = [
      ...attendance.map(a => ({
        title: `Check-in: ${a.status.toUpperCase()} (${a.check_in ? moment(a.check_in).format('h:mm A') : 'N/A'} - ${a.check_out ? moment(a.check_out).format('h:mm A') : 'N/A'})`,
        start: new Date(a.date),
        end: new Date(a.date),
        allDay: true,
        resource: { type: 'attendance', status: a.status }
      })),
      ...leaves.map(l => ({
        title: `Leave: ${l.reason} [${l.status}]`,
        start: new Date(l.from_date),
        end: new Date(moment(l.to_date).add(1, 'days')),
        allDay: true,
        resource: { type: 'leave', status: l.status }
      })),
      {
        title: 'Company Holiday - Diwali',
        start: new Date('2025-11-01'),
        end: new Date('2025-11-01'),
        allDay: true,
        resource: { type: 'holiday' }
      }
    ];
    setCalendarEvents(mapped);
  }, [attendance, leaves]);

  const refreshUserData = async () => {
    await Promise.all([fetchAttendance(), fetchLeaves(), fetchCorrections()]);
  };

  const refreshAdminData = async () => {
    await Promise.all([fetchAllAdminLeaves(), fetchAllAdminCorrections()]);
  };

const fetchAttendance = async () => {
  try {
    const res = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/attendance`);
    console.log('Fetched attendance data:', res.data);
    setAttendance(res.data);
  } catch (err) {
    console.error('Error fetching attendance:', err);
    alert('Failed to fetch attendance data.');
  }
};

  const fetchLeaves = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/leaves`);
      setLeaves(res.data);
    } catch (err) {
      console.error('Error fetching leaves:', err);
      alert('Failed to fetch leaves data.');
    }
  };

  const fetchCorrections = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/attendance/corrections`);
      setCorrections(res.data);
    } catch (err) {
      console.error('Error fetching corrections:', err);
      alert('Failed to fetch corrections data.');
    }
  };

  const fetchAllAdminLeaves = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/admin/leaves`);
      setAllLeaves(res.data);
    } catch (err) {
      console.error('Error fetching all admin leaves:', err);
      alert('Failed to fetch admin leaves data.');
    }
  };

  const fetchAllAdminCorrections = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/attendance/corrections`);
      setAllCorrections(res.data);
    } catch (err) {
      console.error('Error fetching all admin corrections:', err);
      alert('Failed to fetch admin corrections data.');
    }
  };

  const fetchAllAdminData = async () => {
    await Promise.all([fetchAllAdminLeaves(), fetchAllAdminCorrections()]);
  };

  const handleCheckIn = async () => {
    try {
      await axios.post(`${process.env.REACT_APP_API_BASE_URL}/attendance/checkin`);
      alert('Checked in successfully!');
      await refreshUserData();
    } catch (err) {
      console.error('Check-in failed:', err);
      alert('Check-in failed: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleCheckOut = async () => {
    try {
      await axios.post(`${process.env.REACT_APP_API_BASE_URL}/attendance/checkout`);
      alert('Checked out successfully!');
      await refreshUserData();
    } catch (err) {
      console.error('Check-out failed:', err);
      alert('Check-out failed: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleCorrectionRequest = async (date, reason) => {
    try {
      await axios.post(`${process.env.REACT_APP_API_BASE_URL}/attendance/correction-request`, { date, reason });
      alert('Correction request submitted!');
      await refreshUserData();
      setShowCorrectionRequestModal(false);
    } catch (err) {
      console.error('Correction request failed:', err);
      alert('Correction request failed: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleCorrectionApproval = async (id, status) => {
    try {
      await axios.post(`${process.env.REACT_APP_API_BASE_URL}/attendance/correction-review`, { id, status });
      alert(`Correction ID ${id} ${status}!`);
      await refreshAdminData();
      await refreshUserData();
    } catch (err) {
      console.error('Correction review failed:', err);
      alert('Correction review failed: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleLeaveApproval = async (leave_id, status) => {
    try {
      await axios.post(`${process.env.REACT_APP_API_BASE_URL}/admin/leaves/update`, { leave_id, status });
      alert(`Leave ID ${leave_id} ${status}!`);
      await refreshAdminData();
      await refreshUserData();
    } catch (err) {
      console.error('Leave update failed:', err);
      alert('Leave update failed: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleApplyLeave = async (from_date, to_date, reason) => {
    try {
      await axios.post(`${process.env.REACT_APP_API_BASE_URL}/leaves/apply`, { from_date, to_date, reason });
      alert('Leave application submitted!');
      await refreshUserData();
    } catch (err) {
      console.error('Leave application failed:', err);
      alert('Leave application failed: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleChangePassword = async (currentPassword, newPassword) => {
    try {
      const res = await axios.post(`${process.env.REACT_APP_API_BASE_URL}/auth/change-password`, { currentPassword, newPassword });
      alert(res.data.message);
      setShowChangePasswordModal(false);
    } catch (err) {
      console.error('Change password failed:', err.response?.data?.message || err.message);
      alert('Change password failed: ' + (err.response?.data?.message || 'Please check your current password.'));
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    setToken(null);
    setRole(null);
    setAttendance([]);
    setLeaves([]);
    setCorrections([]);
    setCalendarEvents([]);
    setAllLeaves([]);
    setAllCorrections([]);
    setTab('attendance');
  };

  const toggleDarkMode = () => setDarkMode(!darkMode);

  // Handle drag-and-drop events
  const handleEventDrop = async ({ event, start, end }) => {
    if (event.resource.type === 'attendance' || event.resource.type === 'holiday') {
      alert('Cannot modify attendance or holiday events.');
      return;
    }
    try {
      const updatedEvent = {
        ...event,
        start,
        end: moment(end).subtract(1, 'days').toDate(), // Adjust for all-day events
      };
      await axios.put(`${process.env.REACT_APP_API_BASE_URL}/leaves/${event.id}`, {
        from_date: moment(start).format('YYYY-MM-DD'),
        to_date: moment(end).subtract(1, 'days').format('YYYY-MM-DD'),
      });
      setCalendarEvents(prev =>
        prev.map(evt => (evt.id === event.id ? updatedEvent : evt))
      );
      alert('Leave event updated!');
    } catch (err) {
      console.error('Event update failed:', err);
      alert('Failed to update event: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleSelectSlot = ({ start }) => {
    if (role !== 'admin') return;
    const reason = prompt('Enter leave reason:');
    if (reason) {
      handleApplyLeave(
        moment(start).format('YYYY-MM-DD'),
        moment(start).format('YYYY-MM-DD'),
        reason
      );
    }
  };

  const urlParams = new URLSearchParams(window.location.search);
  const resetToken = urlParams.get('token');
  const authView = urlParams.get('view') === 'resetPassword' && resetToken ? 'resetPassword' : 'login';

  if (!token) {
    return <AuthForms authView={authView} setToken={setToken} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />;
  }

  return (
    <div className={`app-container ${darkMode ? 'dark' : ''}`}>
      <div className="header">
        <h1 className="text-2xl font-bold">
          HRMS Dashboard <span className="text-indigo-600 dark:text-indigo-400">({role})</span>
        </h1>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowChangePasswordModal(true)}
            className="btn btn-primary"
          >
            Change Password
          </button>
          <button
            onClick={handleLogout}
            className="btn btn-danger"
          >
            Logout
          </button>
        </div>
      </div>

      <button
        onClick={toggleDarkMode}
        className="btn btn-dark-toggle mb-6"
      >
        Toggle {darkMode ? 'Light' : 'Dark'} Mode
      </button>

      <div className="tabs flex space-x-4 mb-6 flex-wrap gap-y-2">
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
        {role === 'admin' && (
          <button
            onClick={() => { setTab('admin'); refreshAdminData(); }}
            className={`tabs ${tab === 'admin' ? 'active' : ''}`}
          >
            Admin Panel
          </button>
        )}
      </div>

      {tab === 'attendance' && (
        <div className="card">
          <h2 className="text-xl mb-4">Attendance Actions</h2>
          <div className="flex space-x-4 mb-6 flex-wrap gap-y-2">
            <button
              onClick={handleCheckIn}
              className="btn btn-success"
              disabled={!!todayAttendance}
            >
              {todayAttendance ? 'Already Recorded Today' : 'Check In'}
            </button>
            <button
              onClick={handleCheckOut}
              className="btn btn-warning"
              disabled={!todayAttendance || !todayAttendance.check_in || todayAttendance.check_out}
            >
              Check Out
            </button>
          </div>

          <h3 className="text-lg mb-3">Today's Status</h3>
          {todayAttendance ? (
            <p className="mb-4">
              You checked in at <span className="font-medium">{moment(todayAttendance.check_in).format('HH:mm')}</span>.
              {todayAttendance.check_out ? (
                <>
                  You checked out at <span className="font-medium">{moment(todayAttendance.check_out).format('HH:mm')}</span>.
                  <span className={`status-badge status-badge-${todayAttendance.status}`}>
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
                  <span className="font-medium">{a.date}</span>: {a.check_in ? moment(a.check_in).format('HH:mm') : 'N/A'} - {a.check_out ? moment(a.check_out).format('HH:mm') : 'N/A'}
                  <span className={`status-badge status-badge-${a.status}`}>
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
            className="btn btn-secondary"
          >
            Request Correction
          </button>

          <h3 className="text-lg mt-6 mb-3">Your Correction Requests History</h3>
          <ul className="list-disc pl-5 space-y-2 scrollbar-thin max-h-96 overflow-y-auto">
            {corrections.length > 0 ? (
              corrections.map((c, idx) => (
                <li key={idx} className="py-1">
                  <span className="font-medium">{c.date}</span>: {c.reason}
                  <span className={`status-badge status-badge-${c.status}`}>
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
        <div className="card">
          <h2 className="text-xl mb-4">Apply for Leave</h2>
          <LeaveApplicationForm onApplyLeave={handleApplyLeave} darkMode={darkMode} />
          <h3 className="text-lg mb-3">Your Leave Applications</h3>
          <ul className="list-disc pl-5 space-y-2 scrollbar-thin max-h-96 overflow-y-auto">
            {leaves.length > 0 ? (
              leaves.map((l, i) => (
                <li key={i} className="py-1">
                  <span className="font-medium">{l.from_date} to {l.to_date}</span>: {l.reason}
                  <span className={`status-badge status-badge-${l.status}`}>
                    [{l.status}]
                  </span>
                </li>
              ))
            ) : (
              <p>No leave applications found.</p>
            )}
          </ul>
        </div>
      )}

      {tab === 'calendar' && (
        <div className="card">
          <h2 className="text-xl mb-4">Interactive Calendar</h2>
          <DnDCalendar
            localizer={localizer}
            events={calendarEvents}
            selectable
            onSelectSlot={handleSelectSlot}
            startAccessor="start"
            endAccessor="end"
            className="rbc-calendar"
            defaultView="month" // Set horizontal grid
            views={['month', 'week', 'day']} // Enable month/week/day views
            eventPropGetter={(event) => {
              let className = '';
              if (event.resource) {
                if (event.resource.type === 'attendance') {
                  className = `rbc-event-attendance-${event.resource.status}`;
                } else if (event.resource.type === 'leave') {
                  className = `rbc-event-leave-${event.resource.status}`;
                } else if (event.resource.type === 'holiday') {
                  className = 'rbc-event-holiday';
                }
              }
              return { className };
            }}
            onEventDrop={handleEventDrop}
            style={{ height: 600 }} // Ensure sufficient height
          />
        </div>
      )}

      {role === 'admin' && tab === 'admin' && (
        <AdminPanel
          allLeaves={allLeaves}
          allCorrections={allCorrections}
          handleLeaveApproval={handleLeaveApproval}
          handleCorrectionApproval={handleCorrectionApproval}
          darkMode={darkMode}
        />
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
    </div>
  );
}

function AuthForms({ authView, setToken, darkMode, toggleDarkMode }) {
  const handleViewChange = (newView) => {
    if (window.location.search.includes('token') && newView !== 'resetPassword') {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('token');
      newUrl.searchParams.delete('view');
      window.history.replaceState({}, '', newUrl.toString());
    }
    window.location.search = `?view=${newView}`;
  };

  let CurrentForm;
  switch (authView) {
    case 'forgotPassword':
      CurrentForm = <ForgotPasswordForm onBackToLogin={() => handleViewChange('login')} darkMode={darkMode} />;
      break;
    case 'resetPassword':
      CurrentForm = <ResetPasswordForm onBackToLogin={() => handleViewChange('login')} darkMode={darkMode} />;
      break;
    case 'login':
    default:
      CurrentForm = <LoginForm setToken={setToken} onForgotPassword={() => handleViewChange('forgotPassword')} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />;
      break;
  }

  return (
    <div className={`flex items-center justify-center min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
      {CurrentForm}
    </div>
  );
}

function LoginForm({ setToken, onForgotPassword, darkMode, toggleDarkMode }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async e => {
    e.preventDefault();
    try {
      const res = await axios.post(`${process.env.REACT_APP_API_BASE_URL}/auth/login`, { email, password });
      setToken(res.data.token);
      localStorage.setItem('token', res.data.token);
    } catch (err) {
      console.error('Login failed:', err.response?.data?.message || err.message);
      alert('Login failed: ' + (err.response?.data?.message || 'Invalid credentials.'));
    }
  };

  return (
    <form onSubmit={handleLogin} className="card w-full max-w-sm">
      <h2 className="text-2xl font-bold mb-4 text-center">Login</h2>
      <button
        type="button"
        onClick={toggleDarkMode}
        className="btn btn-dark-toggle w-full mb-4"
      >
        Toggle {darkMode ? 'Light' : 'Dark'} Mode
      </button>
      <div className="mb-4">
        <label className="form-label">Email:</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="form-input"
        />
      </div>
      <div className="mb-4">
        <label className="form-label">Password:</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          className="form-input"
        />
      </div>
      <button
        type="submit"
        className="btn btn-primary w-full"
      >
        Login
      </button>
      <button
        type="button"
        onClick={onForgotPassword}
        className="btn text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 w-full mt-2"
      >
        Forgot Password?
      </button>
    </form>
  );
}

function ForgotPasswordForm({ onBackToLogin, darkMode }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      const res = await axios.post(`${process.env.REACT_APP_API_BASE_URL}/auth/forgot-password`, { email });
      setMessage(res.data.message);
      setEmail('');
    } catch (err) {
      console.error('Forgot password request failed:', err.response?.data?.message || err.message);
      setError(err.response?.data?.message || 'Failed to send reset email. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card w-full max-w-sm">
      <h2 className="text-2xl font-bold mb-4 text-center">Forgot Password</h2>
      {message && <p className="text-emerald-600 text-center mb-4">{message}</p>}
      {error && <p className="text-red-600 text-center mb-4">{error}</p>}
      <div className="mb-4">
        <label className="form-label">Email:</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="form-input"
        />
      </div>
      <button
        type="submit"
        className="btn btn-primary w-full"
      >
        Send Reset Link
      </button>
      <button
        type="button"
        onClick={onBackToLogin}
        className="btn text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 w-full mt-2"
      >
        Back to Login
      </button>
    </form>
  );
}

function ResetPasswordForm({ onBackToLogin, darkMode }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [token, setToken] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
    } else {
      setError('Password reset token not found in URL.');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!token) {
      setError('Missing reset token.');
      return;
    }

    try {
      const res = await axios.post(`${process.env.REACT_APP_API_BASE_URL}/auth/reset-password`, { token, newPassword });
      setMessage(res.data.message);
      setNewPassword('');
      setConfirmPassword('');
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('token');
      newUrl.searchParams.delete('view');
      window.history.replaceState({}, '', newUrl.toString());
      setTimeout(onBackToLogin, 3000);
    } catch (err) {
      console.error('Password reset failed:', err.response?.data?.message || err.message);
      setError(err.response?.data?.message || 'Failed to reset password. Token might be invalid or expired.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card w-full max-w-sm">
      <h2 className="text-2xl font-bold mb-4 text-center">Reset Password</h2>
      {message && <p className="text-emerald-600 text-center mb-4">{message}</p>}
      {error && <p className="text-red-600 text-center mb-4">{error}</p>}
      {!token && !error && <p className="text-amber-600 text-center mb-4">Loading reset token...</p>}
      {token && !error && (
        <>
          <div className="mb-4">
            <label className="form-label">New Password:</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="form-input"
            />
          </div>
          <div className="mb-4">
            <label className="form-label">Confirm New Password:</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="form-input"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary w-full"
          >
            Reset Password
          </button>
        </>
      )}
      <button
        type="button"
        onClick={onBackToLogin}
        className="btn text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 w-full mt-2"
      >
        Back to Login
      </button>
    </form>
  );
}

function ChangePasswordModal({ onClose, onChangePassword, darkMode }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    await onChangePassword(currentPassword, newPassword);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button
          onClick={onClose}
          className="modal-close"
          aria-label="Close"
        >
          ×
        </button>
        <h2 className="text-2xl font-bold mb-4 text-center">Change Password</h2>
        {error && <p className="text-red-600 text-center mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Current Password:</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">New Password:</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Confirm New Password:</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="form-input"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary w-full"
          >
            Change Password
          </button>
        </form>
      </div>
    </div>
  );
}

function LeaveApplicationForm({ onApplyLeave, darkMode }) {
  const [from_date, setFromDate] = useState('');
  const [to_date, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!from_date || !to_date || !reason) {
      setError('All fields are required.');
      return;
    }

    if (new Date(from_date) > new Date(to_date)) {
      setError('Start date cannot be after end date.');
      return;
    }

    await onApplyLeave(from_date, to_date, reason);
    setFromDate('');
    setToDate('');
    setReason('');
  };

  return (
    <form onSubmit={handleSubmit} className="card mb-6">
      {error && <p className="text-red-600 text-center mb-4">{error}</p>}
      <div className="mb-4">
        <label htmlFor="from_date" className="form-label">Start Date:</label>
        <input
          type="date"
          id="from_date"
          value={from_date}
          onChange={(e) => setFromDate(e.target.value)}
          required
          className="form-input"
        />
      </div>
      <div className="mb-4">
        <label htmlFor="to_date" className="form-label">End Date:</label>
        <input
          type="date"
          id="to_date"
          value={to_date}
          onChange={(e) => setToDate(e.target.value)}
          required
          className="form-input"
        />
      </div>
      <div className="mb-4">
        <label htmlFor="reason" className="form-label">Reason for Leave:</label>
        <textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows="3"
          required
          className="form-textarea"
        ></textarea>
      </div>
      <button type="submit" className="btn btn-primary">
        Submit Leave Application
      </button>
    </form>
  );
}

function CorrectionRequestModal({ onClose, onSubmit, darkMode }) {
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!date || !reason) {
      setError('Both date and reason are required.');
      return;
    }

    await onSubmit(date, reason);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button
          onClick={onClose}
          className="modal-close"
          aria-label="Close"
        >
          ×
        </button>
        <h2 className="text-2xl font-bold mb-4 text-center">Request Attendance Correction</h2>
        {error && <p className="text-red-600 text-center mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="correctionDate" className="form-label">Date to Correct (YYYY-MM-DD):</label>
            <input
              type="date"
              id="correctionDate"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="form-input"
            />
          </div>
          <div>
            <label htmlFor="correctionReason" className="form-label">Reason for Correction:</label>
            <textarea
              id="correctionReason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows="4"
              required
              className="form-textarea"
            ></textarea>
          </div>
          <button type="submit" className="btn btn-primary w-full">
            Submit Correction Request
          </button>
        </form>
      </div>
    </div>
  );
}

function AdminPanel({ allLeaves, allCorrections, handleLeaveApproval, handleCorrectionApproval, darkMode }) {
  return (
    <div className="card">
      <h2 className="text-2xl font-bold mb-6 text-center">Admin Panel</h2>

      <h3 className="text-xl mb-4 border-b pb-2">Leave Requests</h3>
      {allLeaves.length > 0 ? (
        <div className="overflow-x-auto mb-8 scrollbar-thin">
          <table className="min-w-full table-auto border-collapse">
            <thead>
              <tr className="table-header">
                <th className="table-cell">User</th>
                <th className="table-cell">From</th>
                <th className="table-cell">To</th>
                <th className="table-cell">Reason</th>
                <th className="table-cell">Status</th>
                <th className="table-cell">Actions</th>
              </tr>
            </thead>
            <tbody>
              {allLeaves.map((leave) => (
                <tr key={leave.id} className="table-row">
                  <td className="table-cell">{leave.name}</td>
                  <td className="table-cell">{moment(leave.from_date).format('YYYY-MM-DD')}</td>
                  <td className="table-cell">{moment(leave.to_date).format('YYYY-MM-DD')}</td>
                  <td className="table-cell">{leave.reason}</td>
                  <td className="table-cell">
                    <span className={`status-badge status-badge-${leave.status}`}>{leave.status}</span>
                  </td>
                  <td className="table-cell flex space-x-2">
                    {leave.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleLeaveApproval(leave.id, 'approved')}
                          className="btn btn-success text-xs"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleLeaveApproval(leave.id, 'rejected')}
                          className="btn btn-danger text-xs"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mb-8">No leave requests found.</p>
      )}

      <h3 className="text-xl mb-4 border-b pb-2">Attendance Correction Requests</h3>
      {allCorrections.length > 0 ? (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="min-w-full table-auto border-collapse">
            <thead>
              <tr className="table-header">
                <th className="table-cell">User</th>
                <th className="table-cell">Date</th>
                <th className="table-cell">Reason</th>
                <th className="table-cell">Status</th>
                <th className="table-cell">Actions</th>
              </tr>
            </thead>
            <tbody>
              {allCorrections.map((correction) => (
                <tr key={correction.id} className="table-row">
                  <td className="table-cell">{correction.user_name}</td>
                  <td className="table-cell">{moment(correction.date).format('YYYY-MM-DD')}</td>
                  <td className="table-cell">{correction.reason}</td>
                  <td className="table-cell">
                    <span className={`status-badge status-badge-${correction.status}`}>{correction.status}</span>
                  </td>
                  <td className="table-cell flex space-x-2">
                    {correction.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleCorrectionApproval(correction.id, 'approved')}
                          className="btn btn-success text-xs"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleCorrectionApproval(correction.id, 'rejected')}
                          className="btn btn-danger text-xs"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No attendance correction requests found.</p>
      )}
    </div>
  );
}

export default App;