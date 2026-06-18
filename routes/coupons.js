const express = require("express");
const router = express.Router();
const db = require("../db"); 

// -----------------------
// GET ALL COUPONS
// -----------------------
router.get("/", (req, res) => {
  const sql = "SELECT code, type, value, min_order_value, expires_at FROM coupons";

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: "Database error" });

    res.json(results);
  });
});

// -----------------------
// VALIDATE COUPON
// -----------------------
router.post("/validate", (req, res) => {
  const { code, subtotal } = req.body;

  if (!code) return res.status(400).json({ message: "Coupon code missing" });

  const sql = "SELECT * FROM coupons WHERE code = ?";
  db.query(sql, [code], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    if (results.length === 0) return res.status(404).json({ message: "Invalid coupon" });

    const c = results[0];

    // check expiry
    if (new Date(c.expires_at) < new Date()) {
      return res.status(400).json({ message: "Coupon expired" });
    }

    // check minimum order requirement
    if (c.min_order_value && subtotal < c.min_order_value) {
      return res.status(400).json({
        message: `Minimum order value is ₹${c.min_order_value}`
      });
    }

    // VALID!
    res.json({
      valid: true,
      code: c.code,
      type: c.type,
      value: c.value,
      minAmount: c.min_order_value || 0,
      message: "Coupon applied"
    });
  });
});

module.exports = router;