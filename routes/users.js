const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');

// --- SIGNUP ---
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;

  // Check if email exists
  db.query('SELECT * FROM users WHERE email=?', [email], async (err, results) => {
    if (err) return res.status(500).send('Database error');

    if (results.length > 0) {
      return res.status(400).send('Email already registered'); // frontend will show this
    }

    try {
      const hashed = await bcrypt.hash(password, 10);
      db.query(
        'INSERT INTO users (name, email, password, address, pincode) VALUES (?, ?, ?, ?, ?)',
        [name, email, hashed],
        (err, result) => {
          if (err) return res.status(500).send('Database error');
          res.send('User registered successfully!');
        }
      );
    } catch (hashErr) {
      console.error(hashErr);
      res.status(500).send('Server error');
    }
  });
});

// --- LOGIN ---
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  db.query('SELECT * FROM users WHERE email=?', [email], async (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }

    if (results.length === 0) {
      return res.status(404).send('User not found');
    }

    const user = results[0];

    if (user.is_blocked === 1) {
      return res.status(403).send("User is blocked");
    }

    try {
      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(401).send('Wrong password');

      // Login success, send only id, name, role
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        address: user.address,
        pincode: user.pincode
      });
    } catch (compareErr) {
      console.error(compareErr);
      res.status(500).send('Server error');
    }
  });
});

// Get all users with total orders count
router.get("/admin/list", (req, res) => {
  const { search, sort } = req.query;

  let baseQuery = `
    SELECT 
      users.id, 
      users.name, 
      users.email, 
      users.role, 
      users.address,
      users.pincode,
      users.is_blocked,
      (
        SELECT COUNT(*) 
        FROM orders 
        WHERE orders.user_id = users.id
      ) AS orderCount
    FROM users
  `;

  let conditions = [];
  let values = [];

  // SEARCH (name or email)
  if (search) {
    conditions.push("(users.name LIKE ? OR users.email LIKE ?)");
    values.push(`%${search}%`, `%${search}%`);
  }

  if (conditions.length > 0) {
    baseQuery += " WHERE " + conditions.join(" AND ");
  }

  // SORTING
  if (sort === "orders_desc") baseQuery += " ORDER BY orderCount DESC";
  else if (sort === "orders_asc") baseQuery += " ORDER BY orderCount ASC";
  else baseQuery += " ORDER BY users.id DESC"; // default newest ID first

  db.query(baseQuery, values, (err, users) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(users);
  });
});

// UPDATE PROFILE (Address, Pincode)
router.put('/update/:id', (req, res) => {
  const { address, pincode } = req.body;
  const userId = req.params.id;

  const sql = "UPDATE users SET address = ?, pincode = ? WHERE id = ?";
  db.query(sql, [address, pincode, userId], (err) => {
    if (err) return res.status(500).json({ message: "Database error" });

    res.json({ message: "Profile updated" });
  });
});


router.put("/admin/block/:id", (req, res) => {
  const userId = req.params.id;
  const sql = `UPDATE users SET is_blocked = 1 WHERE id = ?`;

  db.query(sql, [userId], (err) => {
    if (err) return res.status(500).json({ message: "Error blocking user" });
    res.json({ message: "User blocked" });
  });
});

router.put("/admin/unblock/:id", (req, res) => {
  const userId = req.params.id;
  const sql = `UPDATE users SET is_blocked = 0 WHERE id = ?`;

  db.query(sql, [userId], (err) => {
    if (err) return res.status(500).json({ message: "Error unblocking user" });
    res.json({ message: "User unblocked" });
  });
});


/**
 * POST /users/change-password
 * Body: { email, oldPassword, newPassword }
 */
router.post('/change-password', (req, res) => {
  const { email, oldPassword, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).send('Missing required fields');
  }

  // 1. Find user by email
  db.query('SELECT id, password FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) {
      console.error('Password fetch error', err);
      return res.status(500).send('Database error');
    }

    if (results.length === 0) {
      return res.status(404).send('User not found');
    }

    const user = results[0];

    try {
      // If oldPassword provided, verify it. Otherwise allow update (password reset flow).
      if (oldPassword) {
        const match = await bcrypt.compare(oldPassword, user.password);
        if (!match) return res.status(401).send('Old password incorrect');
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      // Update password in DB
      db.query(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedNewPassword, user.id],
        (err2) => {
          if (err2) {
            console.error('Password update error', err2);
            return res.status(500).send('Database error');
          }

          res.send('Password changed successfully!');
        }
      );
    } catch (error) {
      console.error('Change password error', error);
      res.status(500).send('Server error');
    }
  });
});

module.exports = router;
