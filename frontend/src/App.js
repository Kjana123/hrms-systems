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

  // Function to set the access token in Axios headers for all subsequent requests
  const setAuthHeader = (token) => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      console.log("Axios Authorization header set.");
    } else {
      delete axios.defaults.headers.common['Authorization'];
      console.log("Axios Authorization header cleared.");
    }
  };

  // Effect hook to check user authentication status on component mount
  React.useEffect(() => {
    const checkAuthStatus = async () => {
      console.log("Attempting to check authentication status...");
      setLoadingApp(true); // Start loading at the beginning of the check

      // --- IMPORTANT FIX: Attempt to retrieve token from localStorage first ---
      const storedToken = localStorage.getItem('accessToken');
      if (storedToken) {
        console.log("Found stored token in localStorage. Attempting to use it.");
        setAccessToken(storedToken); // Set state immediately
        setAuthHeader(storedToken); // Set Axios header for the upcoming /auth/me call
      } else {
        console.log("No stored token found in localStorage.");
        // If no stored token, the /auth/me call below will likely fail,
        // leading to the login screen, which is the correct flow.
      }
      // --- END IMPORTANT FIX ---

      try {
        // Attempt to get user details from backend (will use existing token/refresh token)
        // This endpoint should return user data if authenticated, or 401/403 if not.
        const response = await axios.get(`${API_BASE_URL}/auth/me`, {
          // withCredentials is important if your backend relies on cookies (like refresh token)
          withCredentials: true,
        });

        const userData = response.data;
        const newAccessToken = response.headers['x-new-access-token']; // Check for new token from backend

        setUser(userData);
        setIsAuthenticated(true);

        // --- IMPORTANT FIX: Update accessToken state and localStorage if a new token is provided ---
        if (newAccessToken) {
          setAccessToken(newAccessToken);
          setAuthHeader(newAccessToken);
          localStorage.setItem('accessToken', newAccessToken); // Persist new token
          console.log("New Access Token received from backend and stored in localStorage.");
        } else if (storedToken && !accessToken) { // If a token was stored but not yet in state (e.g., first load)
          setAccessToken(storedToken);
          setAuthHeader(storedToken);
        }
        // --- END IMPORTANT FIX ---

        console.log("Authentication check successful. User:", userData);
        console.log("Current Access Token state (after successful check):", (newAccessToken || storedToken || accessToken) ? "Present" : "Null");

      } catch (error) {
        console.error("Authentication check failed (likely no active session or token expired):", error.response?.data?.message || error.message);
        setUser(null);
        setAccessToken(null); // Explicitly clear token on failure
        setIsAuthenticated(false);
        setAuthHeader(null); // Clear header if authentication fails
        localStorage.removeItem('accessToken'); // --- IMPORTANT FIX: Clear token from localStorage on failure ---
      } finally {
        setLoadingApp(false); // Authentication check is complete
        console.log("Authentication check process finished.");
      }
    };

    checkAuthStatus();
  }, []); // Run once on mount

  // Log changes to isAuthenticated and accessToken for debugging
  React.useEffect(() => {
    console.log("isAuthenticated changed to:", isAuthenticated);
    console.log("accessToken changed to:", accessToken ? "Present" : "Null");
  }, [isAuthenticated, accessToken]);


  // Function to handle user login (called from AuthForms)
  const handleLogin = async (email, password) => {
    setLoadingApp(true); // Set loading while logging in
    try {
      // Call your backend login API
      const response = await axios.post(`${API_BASE_URL}/auth/login`, { email, password }, {
        withCredentials: true, // Important for sending cookies (refresh token)
      });
      const { accessToken: receivedAccessToken, user: userData } = response.data; // Destructure received token

      setAccessToken(receivedAccessToken);
      setUser(userData);
      setIsAuthenticated(true);
      setAuthHeader(receivedAccessToken); // Set token for future requests immediately
      localStorage.setItem('accessToken', receivedAccessToken); // --- IMPORTANT FIX: Persist token to localStorage ---
      console.log("Login successful. Access Token stored in localStorage.");

      showMessage('Login successful!', 'success');
      console.log("Login successful. Received Access Token:", receivedAccessToken ? "Present" : "Null");
    } catch (error) {
      console.error("Login error:", error.response?.data?.message || error.message);
      showMessage(error.response?.data?.message || 'Login failed. Please try again.', 'error');
      setAccessToken(null); // Ensure token is cleared on login failure
      setIsAuthenticated(false);
      setAuthHeader(null);
      localStorage.removeItem('accessToken'); // --- IMPORTANT FIX: Clear token from localStorage on login failure ---
    } finally {
      setLoadingApp(false); // Login attempt is complete
    }
  };

  // Function to handle user logout
  const handleLogout = async () => {
    setLoadingApp(true); // Set loading while logging out
    try {
      await axios.post(`${API_BASE_URL}/auth/logout`, {}, {
        withCredentials: true, // Send cookies to clear refresh token on backend
      });
      setUser(null);
      setIsAuthenticated(false);
      setAccessToken(null);
      setAuthHeader(null); // Clear header
      localStorage.removeItem('accessToken'); // --- IMPORTANT FIX: Clear token from localStorage on logout ---
      showMessage('Logged out successfully.', 'success');
      console.log("Logged out successfully. Access token cleared from localStorage.");
    } catch (error) {
      console.error("Logout error:", error.response?.data?.message || error.message);
      showMessage(error.response?.data?.message || 'Logout failed.', 'error');
    } finally {
      setLoadingApp(false); // Logout attempt is complete
    }
  };

  // Function to toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(prevMode => {
      const newMode = !prevMode;
      document.documentElement.classList.toggle('dark', newMode);
      return newMode;
    });
  };

  // Function to display messages (now updates the message object)
  const showMessage = (msg, type) => {
    setMessage({ text: msg, type: type });
    setTimeout(() => {
      setMessage({ text: '', type: '' }); // Clear message after 3 seconds
    }, 3000);
  };

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
