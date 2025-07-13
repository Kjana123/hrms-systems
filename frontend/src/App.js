// IMPORTANT: No Firebase imports or logic are included here.
// Authentication relies solely on your backend's JWT and Axios.

// React and ReactDOM are globally available via CDNs in index.html
// axios, moment, and saveAs are also globally available.

const App = () => {
  // State variables for authentication, user data, dark mode, and messages
  const [user, setUser] = React.useState(null);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [darkMode, setDarkMode] = React.useState(false);
  // Combined message state into an object for easier management
  const [message, setMessage] = React.useState({ text: '', type: '' }); // { text: '...', type: 'success' | 'error' }
  const [accessToken, setAccessToken] = React.useState(null); // Store JWT access token
  const [loadingApp, setLoadingApp] = React.useState(true); // New loading state for the App component

  // Base URL for your backend API
  const API_BASE_URL = 'https://hrms-backend-rhsc.onrender.com'; // Adjust if your backend runs on a different port/domain

  // --- START OF NECESSARY CHANGES ---

  // Function to set the access token in Axios headers for all subsequent requests
  const setAuthHeader = React.useCallback((token) => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      console.log("Axios Authorization header set.");
    } else {
      delete axios.defaults.headers.common['Authorization'];
      console.log("Axios Authorization header cleared.");
    }
  }, []);

  // Function to display messages (success or error)
  const showMessage = React.useCallback((text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 5000); // Clear message after 5 seconds
  }, []);

  // Function to toggle dark mode
  const toggleDarkMode = React.useCallback(() => {
    setDarkMode(prevMode => {
      const newMode = !prevMode;
      document.documentElement.classList.toggle('dark', newMode); // Apply class to html tag
      localStorage.setItem('darkMode', JSON.stringify(newMode)); // Save preference
      return newMode;
    });
  }, []);

  // Function to handle logout (defined early as it might be called by fetchUserProfile/refreshAccessToken)
  const handleLogout = React.useCallback(async () => {
    setLoadingApp(true); // Set loading while logging out
    try {
      await axios.post(`${API_BASE_URL}/auth/logout`, {}, {
        withCredentials: true, // Send cookies to clear refresh token on backend
      });
      setUser(null);
      setIsAuthenticated(false);
      setAccessToken(null);
      setAuthHeader(null); // Clear header
      localStorage.removeItem('accessToken'); // Clear access token from local storage
      localStorage.removeItem('refreshToken'); // Ensure refresh token is also cleared
      showMessage('Logged out successfully.', 'success');
      console.log("User logged out.");
    } catch (error) {
      console.error("Logout error:", error.response?.data?.message || error.message);
      showMessage(error.response?.data?.message || 'Logout failed.', 'error');
    } finally {
      setLoadingApp(false); // Logout attempt is complete
    }
  }, [setAuthHeader, showMessage]);

  // Function to fetch full user profile (defined early as it's called by handleLogin, refreshAccessToken)
  const fetchUserProfile = React.useCallback(async (token) => {
    try {
      setAuthHeader(token); // Ensure header is set before fetching profile
      const response = await axios.get(`${API_BASE_URL}/api/users/me`);
      // Ensure all necessary fields are present, even if null from backend
      const userData = {
        ...response.data,
        profile_photo_url: response.data.profile_photo_url || null,
        pan_card_number: response.data.pan_card_number || null,
        bank_account_number: response.data.bank_account_number || null,
        ifsc_code: response.data.ifsc_code || null,
        bank_name: response.data.bank_name || null,
        date_of_birth: response.data.date_of_birth || null,
        personal_details: response.data.personal_details || null,
        family_history: response.data.family_history || null,
        address: response.data.address || null,
        mobile_number: response.data.mobile_number || null,
        kyc_details: response.data.kyc_details || null,
        created_at: response.data.created_at || null,
      };
      setUser(userData);
      setIsAuthenticated(true);
      console.log("User profile fetched and set:", userData);
      return userData;
    } catch (error) {
      console.error("Error fetching user profile:", error.response?.data?.message || error.message);
      showMessage('Failed to fetch user profile.', 'error');
      handleLogout(); // Call handleLogout here if profile fetch fails
      return null;
    }
  }, [setAuthHeader, showMessage, handleLogout]);

  // Function to refresh access token using refresh token (now the primary initial auth check)
  const refreshAccessToken = React.useCallback(async () => {
    setLoadingApp(true); // Ensure loading is true at the start of refresh
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      console.log("No refresh token found. User needs to log in.");
      setIsAuthenticated(false);
      setLoadingApp(false); // Stop loading if no refresh token
      return;
    }

    try {
      console.log("Attempting to refresh access token...");
      const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, { refreshToken });
      const { accessToken: newAccessToken } = response.data;
      setAccessToken(newAccessToken);
      localStorage.setItem('accessToken', newAccessToken); // Store new access token
      await fetchUserProfile(newAccessToken); // Fetch full profile after successful refresh
      console.log("Access token refreshed successfully.");
    } catch (error) {
      console.error("Error refreshing token:", error.response?.data?.message || error.message);
      showMessage('Session expired. Please log in again.', 'error');
      handleLogout(); // Force logout if refresh fails
    } finally {
      setLoadingApp(false); // Stop loading after refresh attempt
    }
  }, [fetchUserProfile, showMessage, handleLogout]);

  // Function to handle user login
  const handleLogin = React.useCallback(async (email, password) => { // Correctly accepts email, password
    setLoadingApp(true); // Set loading while logging in
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, { email, password }, { // Sends as object
        withCredentials: true,
      });
      const { accessToken: receivedAccessToken } = response.data;
      setAccessToken(receivedAccessToken);
      localStorage.setItem('accessToken', receivedAccessToken);
      await fetchUserProfile(receivedAccessToken); // Fetch full user profile after successful login
      showMessage('Login successful!', 'success');
    } catch (error) {
      console.error("Login error:", error.response?.data?.message || error.message);
      showMessage(error.response?.data?.message || 'Login failed. Please try again.', 'error');
      setAccessToken(null);
      setIsAuthenticated(false);
      setAuthHeader(null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken'); // Ensure refresh token is cleared on login failure
    } finally {
      setLoadingApp(false);
    }
  }, [fetchUserProfile, showMessage, setAuthHeader]);

  // --- END OF NECESSARY CHANGES ---


  // Initial app load effect: check for dark mode and try to refresh token
  // This useEffect now directly calls refreshAccessToken for auth check
  React.useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode !== null) {
      setDarkMode(JSON.parse(savedDarkMode));
    }
    refreshAccessToken(); // Attempt to refresh token on app load
  }, [refreshAccessToken]); // Dependency array includes refreshAccessToken

  // Apply dark mode class to body
  React.useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [darkMode]);

  // Determine user role for conditional rendering
  const role = user?.role;

  // Render loading state for the entire App
  if (loadingApp) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded-full animate-pulse bg-blue-600"></div>
          <div className="w-4 h-4 rounded-full animate-pulse bg-blue-600"></div>
          <div className="w-4 h-4 rounded-full animate-pulse bg-blue-600"></div>
          <p>Loading application...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'} font-sans`}>
      {/* Message component is now globally available */}
      {message.text && (
        <Message
          message={message.text}
          type={message.type}
          clearMessage={() => setMessage({ text: '', type: '' })}
        />
      )}

      {!isAuthenticated ? (
        // AuthForms component is now expected to be globally available via window.AuthForms
        <AuthForms
          handleLogin={handleLogin}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
          showMessage={showMessage}
          apiBaseUrl={API_BASE_URL} // Pass API base URL to AuthForms
        />
      ) : (
        <div className="flex flex-1">
          {role === 'admin' ? (
            // AdminDashboard component is now expected to be globally available via window.AdminDashboard
            <AdminDashboard
              user={user}
              handleLogout={handleLogout}
              darkMode={darkMode}
              toggleDarkMode={toggleDarkMode}
              showMessage={showMessage}
              apiBaseUrl={API_BASE_URL} // Pass API base URL to dashboards
              accessToken={accessToken} // Pass accessToken to dashboards
            />
          ) : (
            // EmployeeDashboard component is now expected to be globally available via window.EmployeeDashboard
            <EmployeeDashboard
              user={user}
              handleLogout={handleLogout}
              darkMode={darkMode}
              toggleDarkMode={toggleDarkMode}
              showMessage={showMessage}
              apiBaseUrl={API_BASE_URL} // Pass API base URL to dashboards
              accessToken={accessToken} // Pass accessToken to dashboards
              onProfileUpdateSuccess={fetchUserProfile} // Pass the fetchUserProfile function
            />
          )}
        </div>
      )}
    </div>
  );
};

// Render the App component to the DOM
// Using React 18's createRoot is recommended, but for direct browser script loading with Babel Standalone,
// ReactDOM.render is often used for simplicity. The warning indicates it runs in React 17 compatibility mode.
// To use createRoot, you'd typically need a build step (like Webpack).
ReactDOM.render(<App />, document.getElementById('root'));
