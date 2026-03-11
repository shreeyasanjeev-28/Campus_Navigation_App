CampusNavigationApp-MySQL - Ready to run (Frontend + MySQL Backend)

Contents:
- frontend/index.html    -> Open this in your browser (it talks to backend at http://localhost:5000)
- backend/server.js      -> Node.js + Express backend (uses MySQL)
- backend/package.json   -> npm dependencies
- backend/schema.sql     -> Optional schema (server auto-creates DB and tables)
- README.txt             -> this file

How to run:
1. Install Node.js (v14+ recommended) and have MySQL server running locally.
2. Ensure MySQL server accepts connections for user 'root' with no password (or edit server.js to match your credentials).
3. Open terminal and go to backend:
   cd path/to/CampusNavigationApp-MySQL/backend
4. Install dependencies:
   npm install
5. Start the server:
   node server.js
   or: npm start
   The server will automatically create database 'CampusNavigationSystem', tables, and a default admin.
6. Open the frontend:
   Open frontend/index.html in your browser.

Default admin credentials:
username: admin
password: admin123

Notes:
- To create walkable routes, add locations via the admin panel, then create paths (edges) connecting location IDs using the /add-path API (Postman or curl), or extend the backend with a UI for paths.
- If your MySQL uses a different username/password, edit the MYSQL_USER and MYSQL_PASSWORD variables at the top of backend/server.js.
