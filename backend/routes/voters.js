const express = require("express");
const router = express.Router();
const db = require("../db");

/* =====================================================
   REGISTER VOTER WALLET
===================================================== */
router.post("/register", (req, res) => {
  const walletAddress = req.body.walletAddress?.toLowerCase().trim();

  if (!walletAddress) {
    return res.status(400).json({
      success: false,
      error: "Wallet address is required",
    });
  }

  const checkQuery =
    "SELECT wallet_address FROM voters WHERE wallet_address = ?";

  db.query(checkQuery, [walletAddress], (err, result) => {
    if (err) {
      console.error("DB ERROR (REGISTER) →", err);
      return res.status(500).json({
        success: false,
        error: "Failed to register wallet",
      });
    }

    if (result.length > 0) {
      return res.json({
        success: true,
        message: "Wallet already registered",
      });
    }

    const insertQuery =
      "INSERT INTO voters (wallet_address, has_voted) VALUES (?, FALSE)";

    db.query(insertQuery, [walletAddress], (err) => {
      if (err) {
        console.error("DB ERROR (INSERT WALLET) →", err);
        return res.status(500).json({
          success: false,
          error: "Failed to insert wallet",
        });
      }

      res.json({
        success: true,
        message: "Wallet registered successfully",
      });
    });
  });
});

/* =====================================================
   MARK VOTER AS VOTED + LOG VOTE
===================================================== */
router.post("/voted", (req, res) => {
  const walletAddress = req.body.walletAddress?.toLowerCase().trim();
  const txHash = req.body.txHash?.trim();

  if (!walletAddress || !txHash) {
    return res.status(400).json({
      success: false,
      error: "Wallet address and transaction hash are required",
    });
  }

  // Prevent duplicate vote logs
  const checkLogQuery =
    "SELECT id FROM vote_logs WHERE wallet_address = ?";

  db.query(checkLogQuery, [walletAddress], (err, result) => {
    if (err) {
      console.error("DB ERROR (CHECK LOG) →", err);
      return res.status(500).json({
        success: false,
        error: "Failed to check vote logs",
      });
    }

    if (result.length > 0) {
      return res.json({
        success: true,
        message: "Vote already logged",
      });
    }

    // 1️⃣ Mark voter as voted
    const updateVoterQuery =
      "UPDATE voters SET has_voted = TRUE WHERE wallet_address = ?";

    db.query(updateVoterQuery, [walletAddress], (err) => {
      if (err) {
        console.error("DB ERROR (MARK VOTED) →", err);
        return res.status(500).json({
          success: false,
          error: "Failed to update voting status",
        });
      }

      // 2️⃣ Insert vote log
      const insertLogQuery = `
        INSERT INTO vote_logs (wallet_address, tx_hash, voted_at)
        VALUES (?, ?, NOW())
      `;

      db.query(insertLogQuery, [walletAddress, txHash], (err) => {
        if (err) {
          console.error("DB ERROR (INSERT LOG) →", err);
          return res.status(500).json({
            success: false,
            error: "Failed to log vote",
          });
        }

        res.json({
          success: true,
          message: "Vote recorded successfully",
        });
      });
    });
  });
});

/* =====================================================
   CHECK VOTING STATUS
===================================================== */
router.get("/status/:wallet", (req, res) => {
  const walletAddress = req.params.wallet?.toLowerCase().trim();

  if (!walletAddress) {
    return res.status(400).json({
      success: false,
      error: "Wallet address is required",
    });
  }

  const query =
    "SELECT has_voted FROM voters WHERE wallet_address = ?";

  db.query(query, [walletAddress], (err, result) => {
    if (err) {
      console.error("DB ERROR (CHECK STATUS) →", err);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch voting status",
      });
    }

    if (result.length === 0) {
      return res.json({
        success: true,
        hasVoted: false,
      });
    }

    res.json({
      success: true,
      hasVoted: Boolean(result[0].has_voted),
    });
  });
});

module.exports = router;
