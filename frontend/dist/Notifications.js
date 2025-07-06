// Notifications.js
// REMOVE all local import/export statements when using type="text/babel" in index.html

const Notifications = ({ showMessage, apiBaseUrl, accessToken, notifications, onNotificationMarkedRead }) => {
    //const [notifications, setNotifications] = React.useState([]);
    //const [loadingNotifications, setLoadingNotifications] = React.useState(true);
    const [filterUnread, setFilterUnread] = React.useState(false);

    // Axios instance with token for authenticated requests
    const authAxios = axios.create({
        baseURL: apiBaseUrl,
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    //const fetchNotifications = async () => {
      //  try {
        //    const response = await authAxios.get(`${apiBaseUrl}/api/notifications/my`, {
          //      params: {
            //        unreadOnly: filterUnread
              //  }
            //});
            //setNotifications(response.data);
        //} catch (error) {
          //  console.error("Error fetching notifications:", error.response?.data?.message || error.message);
            //showMessage(`Error fetching notifications: ${error.response?.data?.message || error.message}`, "error");
        //} finally {
          //  setLoadingNotifications(false);
       // }
    //};

    //React.useEffect(() => {
        //if (accessToken) {
          //  fetchNotifications();
        //}
    //}, [accessToken, filterUnread]); // Re-fetch when accessToken or filter changes

      const markAsRead = async (notificationId) => {
        try {
            await authAxios.put(`${apiBaseUrl}/api/notifications/${notificationId}/read`);
            showMessage('Notification marked as read!', 'success');
            // CRITICAL CHANGE: Call the callback from parent to re-fetch and update count
            if (onNotificationMarkedRead) { // Ensure the prop exists before calling
                onNotificationMarkedRead();
            }
            // You might also want to update the local 'notifications' prop list optimistically here
            // or rely completely on the parent re-fetching. For simplicity, letting parent re-fetch.
        } catch (error) {
            console.error("Error marking notification as read:", error.response?.data?.message || error.message);
            showMessage(`Failed to mark notification as read: ${error.response?.data?.message || error.message}`, "error");
        }
    };

     const filteredNotifications = notifications.filter(n => filterUnread ? !n.is_read : true); // Filter the prop data

    //if (loadingNotifications) {
      //  return <p className="text-gray-500 dark:text-gray-400">Loading your notifications...</p>;
    //}

    return (
        <div className="mt-8 p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700">
            <h4 className="text-lg font-medium mb-4">Your Notifications</h4>

            <div className="mb-4">
                <label className="inline-flex items-center">
                    <input
                        type="checkbox"
                        className="form-checkbox h-5 w-5 text-blue-600 rounded dark:bg-gray-700 dark:border-gray-600"
                        checked={filterUnread}
                        onChange={(e) => setFilterUnread(e.target.checked)}
                    />
                    <span className="ml-2 text-gray-700 dark:text-gray-300">Show Unread Only</span>
                </label>
            </div>

            {filteredNotifications.length > 0 ? ( // Use filteredNotifications here
                <div className="space-y-4">
                    {filteredNotifications.map(notification => (
                        <div
                            key={notification.id}
                            className={`p-4 rounded-lg shadow-sm ${
                                notification.is_read
                                    ? 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                                    : 'bg-blue-50 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-semibold'
                            } flex justify-between items-center transition-colors duration-200`}
                        >
                            <div>
                                <p className="text-sm">{notification.message}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {moment(notification.created_at).format('MMM D, YYYY h:mm A')} {/* Fixed format string */}
                                </p>
                            </div>
                            {!notification.is_read && (
                                <button
                                    onClick={() => markAsRead(notification.id)}
                                    className="ml-4 px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors duration-200"
                                >
                                    Mark as Read
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-gray-500 dark:text-gray-400">No notifications found.</p>
            )}
        </div>
    );
};

window.Notifications = Notifications;