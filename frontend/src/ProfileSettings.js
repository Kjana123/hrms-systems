// ProfileSettings.js
// REMOVE all local import/export statements when using type="text/babel" in index.html

const ProfileSettings = ({ user, showMessage, apiBaseUrl, accessToken }) => {
    // Existing states
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

    // NEW STATES for additional profile fields
    const [panCardNumber, setPanCardNumber] = React.useState(user?.pan_card_number || '');
    const [bankAccountNumber, setBankAccountNumber] = React.useState(user?.bank_account_number || '');
    const [ifscCode, setIfscCode] = React.useState(user?.ifsc_code || '');
    const [bankName, setBankName] = React.useState(user?.bank_name || '');
    // Ensure date_of_birth is formatted correctly for input type="date"
    const [dateOfBirth, setDateOfBirth] = React.useState(user?.date_of_birth ? moment(user.date_of_birth).format('YYYY-MM-DD') : '');
    const [personalDetails, setPersonalDetails] = React.useState(user?.personal_details || ''); // New state for personal details
    const [familyHistory, setFamilyHistory] = React.useState(user?.family_history || ''); // New state for family history
    const [profileUpdateReason, setProfileUpdateReason] = React.useState(''); // Reason for profile update request


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
            // These fields are now read-only, but we still initialize their states
            // to display the current user data.
            setName(user.name || '');
            setEmail(user.email || '');
            setEmployeeId(user.employee_id || '');

            setAddress(user.address || '');
            setMobileNumber(user.mobile_number || '');
            setKycDetails(user.kyc_details || '');
            setProfilePhoto(user.profile_photo || null);
            // Update new states from user prop
            setPanCardNumber(user.pan_card_number || '');
            setBankAccountNumber(user.bank_account_number || '');
            setIfscCode(user.ifsc_code || '');
            setBankName(user.bank_name || '');
            setDateOfBirth(user.date_of_birth ? moment(user.date_of_birth).format('YYYY-MM-DD') : '');
            setPersonalDetails(user.personal_details || ''); // Initialize new state
            setFamilyHistory(user.family_history || '');     // Initialize new state
        }
    }, [user]);

    const handleProfileUpdateRequest = async (e) => {
        e.preventDefault();

        if (!profileUpdateReason.trim()) {
            showMessage('Please provide a reason for your profile update request.', 'error');
            return;
        }

        try {
            // Construct payload with proposed changes
            // ONLY include fields that are meant for employee-initiated update requests (non-sensitive ones like name, email, employee_id are excluded)
            const requestedChanges = {
                address: address || null,
                mobile_number: mobileNumber || null,
                kyc_details: kycDetails || null,
                pan_card_number: panCardNumber || null,
                bank_account_number: bankAccountNumber || null,
                ifsc_code: ifscCode || null,
                bank_name: bankName || null,
                date_of_birth: dateOfBirth || null,
                personal_details: personalDetails || null, // Include new state
                family_history: familyHistory || null,     // Include new state
            };

            // Send request to the backend endpoint for profile update approval
            await authAxios.post(`${apiBaseUrl}/api/employee/profile-update-request`, {
                requested_data: requestedChanges,
                reason: profileUpdateReason // Include the reason
            });

            showMessage('Profile update request submitted for admin approval!', 'success');
            setProfileUpdateReason(''); // Clear the reason field after submission
            setPhotoFile(null); // Clear the selected file after upload (if any)

            // Note: The user's profile on the frontend will NOT immediately reflect these changes
            // because they are pending admin approval. The 'user' prop will only update
            // when the main App component re-fetches user data after admin approval.

        } catch (error) {
            console.error("Error submitting profile update request:", error.response?.data?.message || error.message);
            showMessage(`Failed to submit profile update request: ${error.response?.data?.message || error.message}`, 'error');
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (!currentPassword || !newPassword || !confirmNewPassword) {
            showMessage('All password fields are required.', 'error');
            return;
        }
        if (newPassword !== confirmNewPassword) {
            showMessage('New password and confirmation do not match.', 'error');
            return;
        }
        if (newPassword.length < 6) { // Example: enforce minimum password length
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

    const handlePhotoChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setPhotoFile(e.target.files[0]);
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


    return (
        <div className="mt-8 p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700">
            <h4 className="text-lg font-medium mb-4">Update Your Profile</h4>
            <form onSubmit={handleProfileUpdateRequest} className="space-y-4">
                <div className="flex items-center space-x-4">
                    {profilePhoto ? (
                        <img src={profilePhoto} alt="Profile" className="w-24 h-24 rounded-full object-cover border-2 border-blue-500" />
                    ) : (
                        <div className="w-24 h-24 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-400 text-4xl">
                            {user?.name ? user.name[0].toUpperCase() : '?'}
                        </div>
                    )}
                    <div>
                        <label htmlFor="profilePhotoUpload" className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors duration-200 text-sm">
                            Select New Photo
                        </label>
                        <input
                            id="profilePhotoUpload"
                            type="file"
                            accept="image/jpeg,image/png"
                            className="hidden"
                            onChange={handlePhotoChange}
                        />
                        {photoFile && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{photoFile.name}</p>}
                        {photoFile && (
                            <button
                                type="button" // Important: type="button" to prevent form submission
                                onClick={handlePhotoUpload}
                                className="ml-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors duration-200 text-sm"
                            >
                                Upload Photo
                            </button>
                        )}
                    </div>
                </div>

                {/* Read-only Profile Fields (Name, Email, Employee ID) */}
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                    <input type="text" id="name" className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white sm:text-sm" value={name} readOnly />
                </div>
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                    <input type="email" id="email" className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white sm:text-sm" value={email} readOnly />
                </div>
                <div>
                    <label htmlFor="employeeId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Employee ID</label>
                    <input type="text" id="employeeId" className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white sm:text-sm" value={employeeId} readOnly />
                </div>

                {/* Editable Profile Fields for Update Request */}
                <div>
                    <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Address</label>
                    <textarea id="address" rows="2" className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" value={address} onChange={(e) => setAddress(e.target.value)}></textarea>
                </div>
                <div>
                    <label htmlFor="mobileNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Mobile Number</label>
                    <input type="text" id="mobileNumber" className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} />
                </div>
                <div>
                    <label htmlFor="kycDetails" className="block text-sm font-medium text-gray-700 dark:text-gray-300">KYC Details</label>
                    <textarea id="kycDetails" rows="2" className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" value={kycDetails} onChange={(e) => setKycDetails(e.target.value)}></textarea>
                </div>

                {/* NEW PROFILE FIELDS FOR EMPLOYEE TO REQUEST UPDATE */}
                <div>
                    <label htmlFor="panCardNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300">PAN Card Number</label>
                    <input type="text" id="panCardNumber" className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" value={panCardNumber} onChange={(e) => setPanCardNumber(e.target.value)} />
                </div>
                <div>
                    <label htmlFor="bankAccountNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bank Account Number</label>
                    <input type="text" id="bankAccountNumber" className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} />
                </div>
                <div>
                    <label htmlFor="ifscCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300">IFSC Code</label>
                    <input type="text" id="ifscCode" className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" value={ifscCode} onChange={(e) => setIfscCode(e.target.value)} />
                </div>
                <div>
                    <label htmlFor="bankName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bank Name</label>
                    <input type="text" id="bankName" className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" value={bankName} onChange={(e) => setBankName(e.target.value)} />
                </div>
                <div>
                    <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date of Birth</label>
                    <input type="date" id="dateOfBirth" className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
                </div>
                <div>
                    <label htmlFor="personalDetails" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Personal Details</label>
                    <textarea id="personalDetails" rows="2" className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" value={personalDetails} onChange={(e) => setPersonalDetails(e.target.value)}></textarea>
                </div>
                <div>
                    <label htmlFor="familyHistory" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Family History</label>
                    <textarea id="familyHistory" rows="2" className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" value={familyHistory} onChange={(e) => setFamilyHistory(e.target.value)}></textarea>
                </div>

                <div>
                    <label htmlFor="profileUpdateReason" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Reason for Update Request</label>
                    <textarea id="profileUpdateReason" rows="3" className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" value={profileUpdateReason} onChange={(e) => setProfileUpdateReason(e.target.value)} required></textarea>
                </div>

                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors duration-200 shadow-md">
                    Submit Profile Changes for Approval
                </button>
            </form>

            <h4 className="text-lg font-medium mt-8 mb-4">Change Password</h4>
            <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                    <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Current Password</label>
                    <input type="password" id="currentPassword" className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                </div>
                <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">New Password</label>
                    <input type="password" id="newPassword" className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                </div>
                <div>
                    <label htmlFor="confirmNewPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm New Password</label>
                    <input type="password" id="confirmNewPassword" className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} required />
                </div>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 shadow-md">
                    Change Password
                </button>
            </form>
        </div>
    );
};

// Make the component globally accessible
window.ProfileSettings = ProfileSettings;
