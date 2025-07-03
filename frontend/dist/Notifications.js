// Notifications.js
// REMOVE all local import/export statements when using type="text/babel" in index.html

const Notifications = ({
  showMessage,
  apiBaseUrl,
  accessToken
}) => {
  const [notifications, setNotifications] = React.useState([]);
  const [loadingNotifications, setLoadingNotifications] = React.useState(true);
  const [filterUnread, setFilterUnread] = React.useState(false);

  // Axios instance with token for authenticated requests
  const authAxios = axios.create({
    baseURL: apiBaseUrl,
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  const fetchNotifications = async () => {
    try {
      const response = await authAxios.get(`${apiBaseUrl}/api/notifications/my`, {
        params: {
          unreadOnly: filterUnread
        }
      });
      setNotifications(response.data);
    } catch (error) {
      console.error("Error fetching notifications:", error.response?.data?.message || error.message);
      showMessage(`Error fetching notifications: ${error.response?.data?.message || error.message}`, "error");
    } finally {
      setLoadingNotifications(false);
    }
  };
  React.useEffect(() => {
    if (accessToken) {
      fetchNotifications();
    }
  }, [accessToken, filterUnread]); // Re-fetch when accessToken or filter changes

  const markAsRead = async notificationId => {
    try {
      await authAxios.put(`${apiBaseUrl}/api/notifications/${notificationId}/read`);
      showMessage('Notification marked as read!', 'success');
      fetchNotifications(); // Re-fetch to update the list
    } catch (error) {
      console.error("Error marking notification as read:", error.response?.data?.message || error.message);
      showMessage(`Failed to mark notification as read: ${error.response?.data?.message || error.message}`, "error");
    }
  };
  if (loadingNotifications) {
    return /*#__PURE__*/React.createElement("p", {
      className: "text-gray-500 dark:text-gray-400"
    }, "Loading your notifications...");
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "mt-8 p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "text-lg font-medium mb-4"
  }, "Your Notifications"), /*#__PURE__*/React.createElement("div", {
    className: "mb-4"
  }, /*#__PURE__*/React.createElement("label", {
    className: "inline-flex items-center"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    className: "form-checkbox h-5 w-5 text-blue-600 rounded dark:bg-gray-700 dark:border-gray-600",
    checked: filterUnread,
    onChange: e => setFilterUnread(e.target.checked)
  }), /*#__PURE__*/React.createElement("span", {
    className: "ml-2 text-gray-700 dark:text-gray-300"
  }, "Show Unread Only"))), notifications.length > 0 ? /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, notifications.map(notification => /*#__PURE__*/React.createElement("div", {
    key: notification.id,
    className: `p-4 rounded-lg shadow-sm ${notification.is_read ? 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400' : 'bg-blue-50 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-semibold'} flex justify-between items-center transition-colors duration-200`
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    className: "text-sm"
  }, notification.message), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-gray-500 dark:text-gray-400 mt-1"
  }, moment(notification.created_at).format('MMM D, YYYY h:mm A'))), !notification.is_read && /*#__PURE__*/React.createElement("button", {
    onClick: () => markAsRead(notification.id),
    className: "ml-4 px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors duration-200"
  }, "Mark as Read")))) : /*#__PURE__*/React.createElement("p", {
    className: "text-gray-500 dark:text-gray-400"
  }, "No notifications found."));
};