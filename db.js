const mysql = require('mysql2');

// Create connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',          // your MySQL username
  password: 'Akshat2003',  // your MySQL password
  database: 'ecommerce'  // database name
});

// Connect
db.connect(err => {
  if (err) throw err;
  console.log('MySQL connected...');
});

module.exports = db;
