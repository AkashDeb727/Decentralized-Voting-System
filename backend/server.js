/* =====================================================
   SERVER ENTRY POINT
===================================================== */
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./db"); // initializes DB connection

const app = express();

/* =====================================================
   GLOBAL MIDDLEWARE
===================================================== */
app.use(cors()); // allow frontend requests
app.use(express.json()); // parse JSON bodies

/* =====================================================
   API ROUTES
===================================================== */
app.use("/api/voters", require("./routes/voters"));
app.use("/api/elections", require("./routes/elections"));

/* =====================================================
   HEALTH CHECK ROUTE
===================================================== */
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Backend running and database connected 🚀",
  });
});

/* =====================================================
   START SERVER
===================================================== */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
