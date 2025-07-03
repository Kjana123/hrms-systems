// ProfileSettings.js
// REMOVE all local import/export statements when using type="text/babel" in index.html

const ProfileSettings = ({
  user,
  showMessage,
  apiBaseUrl,
  accessToken
}) => {
  // Removed onUserUpdate prop
  const [name, setName] = React.useState(user?.name || '');
  const [email, setEmail] = React.useState(user?.email || '');
  const [employeeId, setEmployeeId] = React.useState(user?.employee_id || '');
  const [address, setAddress] = React.useState(user?.address || '');
  const [mobileNumber, setMobileNumber] = React.useState(user?.mobile_number || '');
  const [kycDetails, setKycDetails] = React.useState(user?.kyc_details || '');
  const [profilePhoto, setProfilePhoto] = React.useState(user?.profile_photo || null);
  const [newPassword, setNewPassword] = React.useState('');
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [confirmNewPassword, setConfirmNewPassword] = React.useState('');
  const [photoFile, setPhotoFile] = React.useState(null);

  // Axios instance with token for authenticated requests
  const authAxios = axios.create({
    baseURL: apiBaseUrl,
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  // Update state if user prop changes (e.g., after initial load or re-login)
  React.useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setEmployeeId(user.employee_id || '');
      setAddress(user.address || '');
      setMobileNumber(user.mobile_number || '');
      setKycDetails(user.kyc_details || '');
      setProfilePhoto(user.profile_photo || null);
    }
  }, [user]);
  const handleProfileUpdateRequest = async e => {
    // Renamed function
    e.preventDefault();
    try {
      // Construct payload with proposed changes
      const requestedChanges = {
        name: name,
        email: email,
        employee_id: employeeId,
        address: address || null,
        mobile_number: mobileNumber || null,
        kyc_details: kycDetails || null
      };

      // Send request to a new backend endpoint for profile update approval
      await authAxios.post(`${apiBaseUrl}/api/profile-update-requests`, {
        requested_data: requestedChanges // Send all updated fields
      });
      showMessage('Profile update request submitted for admin approval!', 'success');
      // Clear photo file state after submission
      setPhotoFile(null);

      // Note: The user's profile on the frontend will NOT immediately reflect these changes
      // because they are pending admin approval. The 'user' prop will only update
      // when the main App component re-fetches user data after admin approval.
    } catch (error) {
      console.error("Error submitting profile update request:", error.response?.data?.message || error.message);
      showMessage(`Failed to submit profile update request: ${error.response?.data?.message || error.message}`, 'error');
    }
  };
  const handleChangePassword = async e => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      showMessage('All password fields are required.', 'error');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showMessage('New password and confirmation do not match.', 'error');
      return;
    }
    if (newPassword.length < 6) {
      // Example: enforce minimum password length
      showMessage('New password must be at least 6 characters long.', 'error');
      return;
    }
    try {
      await authAxios.post(`${apiBaseUrl}/auth/change-password`, {
        currentPassword,
        newPassword
      });
      showMessage('Password changed successfully!', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error) {
      console.error("Error changing password:", error.response?.data?.message || error.message);
      showMessage(`Failed to change password: ${error.response?.data?.message || error.message}`, 'error');
    }
  };
  const handlePhotoChange = e => {
    if (e.target.files && e.target.files[0]) {
      setPhotoFile(e.target.files[0]);
      // For now, photo upload is still direct. If photo also needs approval,
      // it would need to be part of the requested_data JSONB in the backend.
      // For simplicity, we'll assume photo updates are immediate or handled separately.
      // If photo also needs approval, it would be a more complex change.
      // For now, if a photo is selected, we could trigger an immediate upload or
      // include its base64/URL in the requested_data. For this iteration,
      // we'll keep photo upload as a separate, direct action for simplicity
      // or assume it's handled by a different flow if approval is needed.
      // For now, I'll remove the direct photo upload from here to align with approval flow.
      // If photo changes also need approval, they should be part of the requested_data.
    }
  };
  const handlePhotoUpload = async () => {
    if (!photoFile) {
      showMessage('Please select a photo to upload.', 'error');
      return;
    }
    try {
      const photoFormData = new FormData();
      photoFormData.append('photo', photoFile);
      const photoUploadResponse = await authAxios.post(`${apiBaseUrl}/api/users/photo`, photoFormData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setProfilePhoto(photoUploadResponse.data.photo_url);
      showMessage('Profile photo updated successfully!', 'success');
      setPhotoFile(null); // Clear the selected file after upload
    } catch (error) {
      console.error("Error uploading profile photo:", error.response?.data?.message || error.message);
      showMessage(`Failed to upload profile photo: ${error.response?.data?.message || error.message}`, 'error');
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "mt-8 p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "text-lg font-medium mb-4"
  }, "Update Your Profile"), /*#__PURE__*/React.createElement("form", {
    onSubmit: handleProfileUpdateRequest,
    className: "space-y-4"
  }, " ", /*#__PURE__*/React.createElement("div", {
    className: "flex items-center space-x-4"
  }, profilePhoto ? /*#__PURE__*/React.createElement("img", {
    src: profilePhoto,
    alt: "Profile",
    className: "w-24 h-24 rounded-full object-cover border-2 border-blue-500"
  }) : /*#__PURE__*/React.createElement("div", {
    className: "w-24 h-24 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-400 text-4xl"
  }, user?.name ? user.name[0].toUpperCase() : '?'), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "profilePhotoUpload",
    className: "cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors duration-200 text-sm"
  }, "Select New Photo"), /*#__PURE__*/React.createElement("input", {
    id: "profilePhotoUpload",
    type: "file",
    accept: "image/jpeg,image/png",
    className: "hidden",
    onChange: handlePhotoChange
  }), photoFile && /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-gray-600 dark:text-gray-400 mt-1"
  }, photoFile.name), photoFile && /*#__PURE__*/React.createElement("button", {
    type: "button" // Important: type="button" to prevent form submission
    ,
    onClick: handlePhotoUpload,
    className: "ml-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors duration-200 text-sm"
  }, "Upload Photo"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "name",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Name"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    id: "name",
    className: "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm",
    value: name,
    onChange: e => setName(e.target.value),
    required: true
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "email",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Email"), /*#__PURE__*/React.createElement("input", {
    type: "email",
    id: "email",
    className: "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm",
    value: email,
    onChange: e => setEmail(e.target.value),
    required: true
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "employeeId",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Employee ID"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    id: "employeeId",
    className: "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm",
    value: employeeId,
    onChange: e => setEmployeeId(e.target.value),
    required: true
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "address",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Address"), /*#__PURE__*/React.createElement("textarea", {
    id: "address",
    rows: "2",
    className: "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm",
    value: address,
    onChange: e => setAddress(e.target.value)
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "mobileNumber",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Mobile Number"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    id: "mobileNumber",
    className: "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm",
    value: mobileNumber,
    onChange: e => setMobileNumber(e.target.value)
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "kycDetails",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "KYC Details"), /*#__PURE__*/React.createElement("textarea", {
    id: "kycDetails",
    rows: "2",
    className: "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm",
    value: kycDetails,
    onChange: e => setKycDetails(e.target.value)
  })), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors duration-200 shadow-md"
  }, "Submit Profile Changes for Approval")), /*#__PURE__*/React.createElement("h4", {
    className: "text-lg font-medium mt-8 mb-4"
  }, "Change Password"), /*#__PURE__*/React.createElement("form", {
    onSubmit: handleChangePassword,
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "currentPassword",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Current Password"), /*#__PURE__*/React.createElement("input", {
    type: "password",
    id: "currentPassword",
    className: "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm",
    value: currentPassword,
    onChange: e => setCurrentPassword(e.target.value),
    required: true
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "newPassword",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "New Password"), /*#__PURE__*/React.createElement("input", {
    type: "password",
    id: "newPassword",
    className: "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm",
    value: newPassword,
    onChange: e => setNewPassword(e.target.value),
    required: true
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    htmlFor: "confirmNewPassword",
    className: "block text-sm font-medium text-gray-700 dark:text-gray-300"
  }, "Confirm New Password"), /*#__PURE__*/React.createElement("input", {
    type: "password",
    id: "confirmNewPassword",
    className: "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm",
    value: confirmNewPassword,
    onChange: e => setConfirmNewPassword(e.target.value),
    required: true
  })), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 shadow-md"
  }, "Change Password")));
};