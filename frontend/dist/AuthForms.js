// AuthForms.jsx
// No Firebase imports needed anymore
// No local import/export statements as components are loaded globally by index.html with type="text/babel"

const AuthForms = ({
  handleLogin,
  darkMode,
  toggleDarkMode,
  showMessage,
  apiBaseUrl
}) => {
  // State for form inputs
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showForgotPasswordModal, setShowForgotPasswordModal] = React.useState(false); // New state for modal

  // Handle form submission for login
  const onLoginSubmit = async e => {
    e.preventDefault();
    if (!email || !password) {
      showMessage('Please enter both email and password.', 'error');
      return;
    }
    await handleLogin(email, password); // Call the handleLogin function passed from App.jsx
  };
  return /*#__PURE__*/React.createElement("div", {
    className: `min-h-screen flex items-center justify-center w-full p-4 relative // 'relative' is still useful for context, but logos will be 'fixed'
            ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-indigo-100'} // Lighter background gradient
            bg-cover bg-center bg-no-repeat // Keep these Tailwind classes for background behavior
            bg-blue-100 // Fallback solid background color
            transition-all duration-500 transform`,
    style: {
      backgroundImage: `url('/assets/images/beyond-bim-5.png')`
    } // Direct inline style for background image
  }, /*#__PURE__*/React.createElement("img", {
    src: "/assets/images/company-logo.jpeg" // Placeholder for Company Logo
    ,
    alt: "Company Logo",
    className: "fixed top-4 left-4 w-24 h-auto rounded-md shadow-lg z-50" // Changed to 'fixed', added z-index
  }), /*#__PURE__*/React.createElement("div", {
    className: `bg-white dark:bg-gray-800 p-8 sm:p-10 rounded-xl shadow-2xl w-full max-w-md transition-all duration-500 transform ${darkMode ? 'text-white' : 'text-gray-800'} hover:scale-[1.01]`
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end mb-4"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: toggleDarkMode,
    className: "p-2 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 transition-transform duration-200 hover:scale-110",
    "aria-label": "Toggle dark mode"
  }, darkMode ? /*#__PURE__*/React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    className: "h-7 w-7 text-yellow-400",
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M12 3v1m0 16v1m9-9h-1M4 12H3m15.325 3.325l-.707.707M6.372 6.372l-.707-.707m12.728 0l-.707-.707M6.372 17.628l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
  })) : /*#__PURE__*/React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    className: "h-7 w-7 text-gray-700",
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M20.354 15.354A9 9 0 018.646 3.646 9.003 9003 0 0012 21a9 9 0 008.354-5.646z"
  })))), /*#__PURE__*/React.createElement("h2", {
    className: "text-2xl sm:text-3xl font-extrabold text-center mb-2\r bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-700 // ADDED GRADIENT\r "
  }, "Beyond BIM Technologies"), /*#__PURE__*/React.createElement("h2", {
    className: "text-4xl font-extrabold text-center mb-8 text-blue-600 dark:text-blue-400"
  }, "Welcome Back!"), /*#__PURE__*/React.createElement("p", {
    className: "text-center text-gray-600 dark:text-gray-300 mb-8 text-lg"
  }, "Sign in to access your HRMS dashboard."), /*#__PURE__*/React.createElement("form", {
    onSubmit: onLoginSubmit,
    className: "space-y-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "relative"
  }, /*#__PURE__*/React.createElement("div", {
    className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
  }, /*#__PURE__*/React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    className: "h-5 w-5 text-gray-400",
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
  }))), /*#__PURE__*/React.createElement("input", {
    type: "email",
    id: "email",
    className: "block w-full pl-10 pr-4 py-3 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 sm:text-base transition-colors duration-200",
    placeholder: "Email address",
    value: email,
    onChange: e => setEmail(e.target.value),
    required: true
  })), /*#__PURE__*/React.createElement("div", {
    className: "relative"
  }, /*#__PURE__*/React.createElement("div", {
    className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
  }, /*#__PURE__*/React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    className: "h-5 w-5 text-gray-400",
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v3h8z"
  }))), /*#__PURE__*/React.createElement("input", {
    type: "password",
    id: "password",
    className: "block w-full pl-10 pr-4 py-3 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 sm:text-base transition-colors duration-200",
    placeholder: "Password",
    value: password,
    onChange: e => setPassword(e.target.value),
    required: true
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-lg text-xl font-bold text-white bg-gradient-to-r from-blue-600 to-purple-700 hover:from-blue-700 hover:to-purple-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 transition-all duration-300 transform hover:scale-105"
  }, /*#__PURE__*/React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    className: "h-6 w-6 mr-2",
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
  })), "Sign In"))), /*#__PURE__*/React.createElement("div", {
    className: "mt-6 text-center"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowForgotPasswordModal(true),
    className: "text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium focus:outline-none"
  }, "Forgot Password?"))), /*#__PURE__*/React.createElement("img", {
    src: "/assets/images/united-solutions-plus.jpeg" // Placeholder for Developer Logo
    ,
    alt: "Developer Logo",
    className: "fixed bottom-4 right-4 w-20 h-auto rounded-md shadow-lg z-50" // Changed to 'fixed', added z-index
  }), showForgotPasswordModal && /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50"
  }, /*#__PURE__*/React.createElement("div", {
    className: `bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md ${darkMode ? 'text-white' : 'text-gray-800'}`
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-semibold mb-4"
  }, "Forgot Password"), /*#__PURE__*/React.createElement("p", {
    className: "text-gray-700 dark:text-gray-300 mb-6"
  }, "This feature requires backend implementation to send a password reset email. Please contact your administrator for assistance."), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowForgotPasswordModal(false),
    className: "px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
  }, "Close")))));
};