const express = require("express");
const router = express.Router();
const db = require("../db");

/* =====================================================
   HELPER: ISO → MySQL DATETIME
===================================================== */
function toMySQLDate(iso) {
  if (!iso) return null;
  return new Date(iso).toISOString().slice(0, 19).replace("T", " ");
}

/* =====================================================
   GET ELECTION METADATA
===================================================== */
router.get("/meta", (req, res) => {
  const query = `
    SELECT election_name, start_time, end_time
    FROM election_meta
    WHERE id = 1
  `;

  db.query(query, (err, result) => {
    if (err) {
      console.error("DB ERROR (GET /meta) →", err);
      return res.status(500).json({ success: false });
    }

    if (result.length === 0) {
      return res.json({
        success: true,
        election_name: "",
        start_time: null,
        end_time: null,
      });
    }

    res.json({
      success: true,
      election_name: result[0].election_name,
      start_time: result[0].start_time,
      end_time: result[0].end_time,
    });
  });
});

/* =====================================================
   SAVE / UPDATE ELECTION METADATA
===================================================== */
router.post("/meta", (req, res) => {
  let { election_name, start_time, end_time } = req.body;

  start_time = toMySQLDate(start_time);
  end_time = toMySQLDate(end_time);

  /* 1️⃣ Ensure row exists (NO NULL election_name) */
  const ensureQuery = `
    INSERT IGNORE INTO election_meta (id, election_name)
    VALUES (1, ?)
  `;

  db.query(ensureQuery, [election_name || "Election"], (err) => {
    if (err) {
      console.error("DB ERROR (ENSURE ROW) →", err);
      return res.status(500).json({ success: false });
    }

    /* 2️⃣ Build dynamic UPDATE */
    const fields = [];
    const values = [];

    if (election_name) {
      fields.push("election_name = ?");
      values.push(election_name);
    }
    if (start_time) {
      fields.push("start_time = ?");
      values.push(start_time);
    }
    if (end_time) {
      fields.push("end_time = ?");
      values.push(end_time);
    }

    if (fields.length === 0) {
      return res.json({ success: true });
    }

    const updateQuery = `
      UPDATE election_meta
      SET ${fields.join(", ")}
      WHERE id = 1
    `;

    db.query(updateQuery, values, (err) => {
      if (err) {
        console.error("DB ERROR (UPDATE META) →", err);
        return res.status(500).json({ success: false });
      }

      res.json({
        success: true,
        message: "Election metadata updated",
      });
    });
  });
});

module.exports = router;
