const express = require('express');
const router = express.Router();
const db = require('../db');

// ---------- HELPERS ----------
function computeTotals(items, productsMap, couponObj) {
  const TAX_PERCENT = 18;
  const DELIVERY_CHARGE = 49;
  const FREE_DELIVERY_THRESHOLD = 1000;

  let subtotal = 0;
  items.forEach(it => {
    const p = productsMap[it.id];
    const price = Number(p?.price || 0);
    subtotal += price * it.qty;
  });

  let discount = 0;
  if (couponObj && couponObj.valid) {
    if (couponObj.type === 'pct') discount = (couponObj.value / 100) * subtotal;
    else discount = Number(couponObj.value || 0);
    if (discount > subtotal) discount = subtotal;
  }

  const taxable = Math.max(0, subtotal - discount);
  const tax = (TAX_PERCENT / 100) * taxable;
  const delivery = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_CHARGE;
  const grandTotal = Math.max(0, taxable + tax + delivery);

  return { subtotal, discount, tax, delivery, grandTotal };
}

// ---------- COUPON VALIDATION ----------
router.post('/validate', (req, res) => {
  const { code, subtotal } = req.body;
  if (!code) return res.status(400).json({ message: 'Missing coupon code' });
  db.query('SELECT * FROM coupons WHERE code = ? LIMIT 1', [code], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'DB error' });
    }
    if (!rows || rows.length === 0)
      return res.status(404).json({ message: 'Coupon not found' });

    const c = rows[0];

    // expiry + minimum check
    if (c.expires_at && new Date(c.expires_at) < new Date())
      return res.status(400).json({ message: 'Coupon expired' });

    if (c.min_order_value && subtotal && subtotal < Number(c.min_order_value))
      return res.status(400).json({ message: `Minimum order ₹${c.min_order_value} required` });

    const couponObj = {
      code: c.code,
      type: c.type,
      value: Number(c.value),
      valid: true,
      message: 'Coupon valid'
    };
    return res.json(couponObj);
  });
});

router.get("/user/:id", (req, res) => {
  const userId = req.params.id;

  db.query("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC",
    [userId],
    (err, results) => {
      if (err) return res.status(500).json({ error: "Database error" });
      res.json(results);
    });
});


// ---------- PLACE ORDER ----------
router.post('/', (req, res) => {
  const { items, coupon, userId } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0)
    return res.status(400).json({ message: 'Cart empty' });

  const ids = items.map(it => it.id);
  const placeholders = ids.map(() => '?').join(',');

  db.beginTransaction(err => {
    if (err) return res.status(500).json({ message: 'Transaction start failed' });

    db.query(`SELECT id, name, price, stock FROM products WHERE id IN (${placeholders}) FOR UPDATE`, ids, (err1, productsRows) => {
      if (err1) {
        console.error(err1);
        return db.rollback(() => res.status(500).json({ message: 'DB error fetching products' }));
      }

      const productsMap = {};
      productsRows.forEach(p => (productsMap[p.id] = p));

      // validate stock
      for (const it of items) {
        const p = productsMap[it.id];
        if (!p)
          return db.rollback(() => res.status(400).json({ message: `Product ${it.id} not found` }));
        if (p.stock < it.qty)
          return db.rollback(() =>
            res.status(400).json({ message: `Insufficient stock for ${p.name}` })
          );
      }

      // handle coupon
      const handleCoupon = cb => {
        if (!coupon) return cb(null, null);
        db.query('SELECT * FROM coupons WHERE code = ? LIMIT 1', [coupon], (err2, rows) => {
          if (err2) return cb(err2);
          if (!rows || rows.length === 0)
            return cb(null, { valid: false, message: 'Coupon not found' });
          const c = rows[0];
          if (c.expires_at && new Date(c.expires_at) < new Date())
            return cb(null, { valid: false, message: 'Coupon expired' });
          return cb(null, { code: c.code, type: c.type, value: Number(c.value), valid: true });
        });
      };

      handleCoupon((errC, couponObj) => {
        if (errC) {
          console.error(errC);
          return db.rollback(() => res.status(500).json({ message: 'DB error validating coupon' }));
        }

        const totals = computeTotals(items, productsMap, couponObj);

        const orderSql = `INSERT INTO orders (user_id, items, subtotal, discount, tax, delivery, total, status, created_at)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`;
        db.query(
          orderSql,
          [userId || null, JSON.stringify(items), totals.subtotal, totals.discount, totals.tax, totals.delivery, totals.grandTotal, 'placed'],
          (err3, result) => {
            if (err3) {
              console.error(err3);
              return db.rollback(() => res.status(500).json({ message: 'DB error inserting order' }));
            }

            const orderId = result.insertId;

            // reduce stock safely
            const stockUpdates = items.map(it => {
              return new Promise((resolve, reject) => {
                db.query(
                  'UPDATE products SET stock = stock - ? WHERE id = ?',
                  [it.qty, it.id],
                  err4 => (err4 ? reject(err4) : resolve())
                );
              });
            });

            Promise.all(stockUpdates)
              .then(() => {
                db.commit(commitErr => {
                  if (commitErr) {
                    console.error(commitErr);
                    return db.rollback(() => res.status(500).json({ message: 'Commit failed' }));
                  }
                  res.json({ success: true, message: 'Payment simulated, order saved', orderId, totals });
                });
              })
              .catch(stockErr => {
                console.error(stockErr);
                db.rollback(() => res.status(500).json({ message: 'Error updating stock' }));
              });
          }
        );
      });
    });
  });
});

module.exports = router;
