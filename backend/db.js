/* =====================================================
   DATABASE CONNECTION (MySQL)
===================================================== */
const mysql = require("mysql2");
require("dotenv").config();

/* =====================================================
   CREATE DATABASE CONNECTION
===================================================== */
const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "voting_db",
  port: process.env.DB_PORT || 3306,
});

/* =====================================================
   CONNECT TO DATABASE
===================================================== */
db.connect((err) => {
  if (err) {
    console.error("❌ MySQL connection failed →", err.message);
    return;
  }
  console.log("✅ MySQL connected successfully");
});

module.exports = db;
