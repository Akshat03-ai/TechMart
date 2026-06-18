const express = require("express");
const router = express.Router();
const razorpay = require("../config/razorpay");
const crypto = require("crypto");
const db = require("../db");

// --- CREATE ORDER --- //
router.post("/create-order", async (req, res) => {
    const { amount, user } = req.body; // user = {id,name,email,phone}

    if (!amount) return res.json({ success: false });

    try {
        const order = await razorpay.orders.create({
            amount: Math.round(amount * 100),   // paise
            currency: "INR",
            receipt: "rcpt_" + Date.now()
        });

        return res.json({
            success: true,
            order_id: order.id,
            razorpay_key: process.env.RAZORPAY_KEY_ID
        });

    } catch (err) {
        console.error("Razorpay CREATE ERROR:", err);
        return res.json({ success: false });
    }
});

// --- VERIFY PAYMENT --- //
router.post("/verify", async (req, res) => {
    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        cart,
        totals,
        userId
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest("hex");

    if (expectedSignature !== razorpay_signature) {
        return res.json({ success: false, message: "Invalid signature" });
    }

    // Save order in MySQL
    const sql = `
        INSERT INTO orders
        (user_id, items, subtotal, discount, tax, delivery, total, status, payment_id, order_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    db.query(
        sql,
        [
            userId,
            JSON.stringify(cart),
            totals.subtotal,
            totals.discount,
            totals.tax,
            totals.delivery,
            totals.grandTotal,
            "paid",
            razorpay_payment_id,
            razorpay_order_id
        ],
        (err) => {
            if (err) {
                console.error("MySQL Insert Error:", err);
                return res.json({ success: false });
            }

            return res.json({ success: true });
        }
    );
});

module.exports = router;
