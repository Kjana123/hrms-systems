
# HRMS React Frontend

## Setup Instructions

1. Install dependencies:

```bash
npm install
```

2. Start development server:

```bash
npm start
```

The app runs at `http://localhost:3000` by default.

---

## Deployment

To build for production:

```bash
npm run build
```

Then deploy the contents of the `build` folder to any static hosting provider like Netlify, Vercel, or GitHub Pages.

Make sure your backend API (Node.js server) runs on an accessible endpoint (e.g. http://localhost:3001) or update the API URLs accordingly.

---

## Features Included

- JWT Authentication with login form
- Attendance check-in/check-out
- Attendance corrections with admin approval
- Leave management (apply & view)
- Interactive drag-and-drop calendar
- Dark mode toggle
- Role-based tabs (admin vs employee)

---

## Future Improvements

- Pagination and filtering for attendance and leaves
- Email/SMS notifications for approvals
- More comprehensive admin panel
- Better UI/UX with component libraries (e.g. Material UI)
- Unit & integration testing

---
