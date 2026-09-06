# OpportunityHub — Full-Stack PHP/MySQL Version

SEN106/SEN216 Web Technologies Group 1 project: Internship/Job Opportunity Portal.

## Stack
- Frontend: HTML5, CSS3, JavaScript
- Backend: PHP 8+
- Database: MySQL
- Local server: XAMPP (Apache + MySQL)
- Database manager: phpMyAdmin

## Main features
- Browse internship and job opportunities from MySQL
- Server-side search and filtering
- Opportunity details
- Student registration and login
- Password hashing with PHP `password_hash()`
- Session-based authentication
- Application submission with server-side validation
- CV upload (PDF/DOC/DOCX, max 5MB)
- Applications stored in MySQL
- Prepared statements for database queries
- Responsive and accessible frontend

## XAMPP setup
1. Copy the `OpportunityHub` folder into your XAMPP `htdocs` folder. Typical Windows path: `C:\xampp\htdocs\OpportunityHub`.
2. Start **Apache** and **MySQL** in XAMPP Control Panel.
3. Open phpMyAdmin from XAMPP.
4. Choose **Import**, select `database/opportunityhub.sql`, and run the import.
5. Open `http://localhost/OpportunityHub/` in your browser.
6. Register a new account, log in, open an opportunity and submit an application.

## Important
Do not open the HTML files directly with `file:///...` once the backend is enabled. Use Apache through `http://localhost/OpportunityHub/` so PHP APIs and MySQL work.

## Database tables
- `users` — student accounts
- `opportunities` — internship/job records
- `applications` — student applications and CV filenames

## Security awareness
This is a student project running locally. Production deployment should add HTTPS, stricter upload MIME validation, CSRF protection, rate limiting, secure cookie settings, environment-based database credentials, access controls and stronger file-storage isolation.
