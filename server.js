const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = 3000;

// near the top of server.js, after app = express() and middleware setup
const path = require('path');

// redirect root to auth.html
app.get('/', (req, res) => {
  res.redirect('/auth.html');
});

// static after the redirect (or you can leave static where it is, but route must be before it)
app.use(express.static(path.join(__dirname, 'public')));

// --- FIX: move bodyParser and cors before static files --- //
app.use(express.json());
app.use(cors());

// Serve frontend
app.use(express.static('public')); // serve frontend

// Routes
const productsRoute = require('./routes/products');
const usersRoute = require('./routes/users');
const ordersRoute = require('./routes/orders');
const couponRoutes = require("./routes/coupons");

app.use('/products', productsRoute);
app.use('/users', usersRoute);
app.use('/orders', ordersRoute);
app.use('/coupons', couponRoutes);
app.use("/", couponRoutes);
app.use("/api/payment", require("./routes/payment"));
app.use("/api/invoice", require("./routes/invoice"));

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
