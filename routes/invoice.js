const express = require("express");
const router = express.Router();
const db = require("../db");
const pdf = require("html-pdf-node");
const fs = require("fs");
const path = require("path");

// Load signature
const signaturePath = path.join(process.cwd(), "sign.png");
const signatureBase64 = fs.readFileSync(signaturePath).toString("base64");
const signatureDataUrl = `data:image/png;base64,${signatureBase64}`;

// Generate invoice number like INV-2025-000123
function generateInvoiceNumber(order) {
    const year = new Date(order.created_at).getFullYear();
    const padded = order.id.toString().padStart(6, "0");
    return `INV-${year}-${padded}`;
}

router.get("/:orderId", (req, res) => {
    const orderId = req.params.orderId;

    db.query("SELECT * FROM orders WHERE id = ? LIMIT 1", [orderId], (err, rows) => {
        if (err || rows.length === 0) {
            return res.status(404).send("Order not found");
        }

        const order = rows[0];

        // Parse items
        let items = [];
        try {
            items = typeof order.items === "string" ? JSON.parse(order.items) : order.items;
        } catch {
            items = [];
        }

        const invoiceNo = generateInvoiceNumber(order);

        // Fetch user details
        db.query(
            "SELECT name, email, address, pincode FROM users WHERE id = ? LIMIT 1",
            [order.user_id],
            (errUser, userRows) => {
                if (errUser || userRows.length === 0) {
                    return res.status(404).send("User not found");
                }

                const user = userRows[0];

                // Collect product IDs
                const productIds = items.map(i => i.id);

                if (productIds.length === 0) {
                    return res.status(400).send("No product items found in order");
                }

                // Fetch product details
                db.query(
                    "SELECT id, name, image, price FROM products WHERE id IN (?)",
                    [productIds],
                    (err2, productRows) => {
                        if (err2) {
                            console.error("Product fetch error:", err2);
                            return res.status(500).send("Error loading products");
                        }

                        const productMap = {};
                        productRows.forEach(p => (productMap[p.id] = p));

                        const mergedItems = items.map(item => {
                            const product = productMap[item.id] || {};
                            return {
                                ...item,
                                name: product.name || "Unknown Product",
                                image: product.image ? product.image.split(",")[0] : "",
                                price: Number(product.price) || 0,
                                subtotal: (Number(product.price) || 0) * item.qty,
                            };
                        });

                        // ⭐ Invoice HTML (with watermark + signature + support)
                        const html = `
                        <html>
                        <head>
                            <style>
                                body { 
                                    font-family: Arial, sans-serif; 
                                    padding: 20px; 
                                    position: relative;
                                }

                                .watermark {
                                    position: fixed;
                                    top: 40%;
                                    left: 50%;
                                    transform: translate(-50%, -50%) rotate(-30deg);
                                    font-size: 110px;
                                    color: rgba(0, 0, 0, 0.06);
                                    z-index: 999;
                                    pointer-events: none;
                                }

                                h1 { text-align: center; margin-bottom: 5px; }
                                .sub { text-align: center; margin-top: 0; font-size: 13px; color: #555; }

                                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                                th, td { border: 1px solid #ddd; padding: 6px; text-align: center; }
                                th { background: #f5f5f5; }

                                .box h3 { margin-top: 2px; margin-bottom: 2px; }

                                img.product { width: 120px; height: 100px; object-fit: cover; border-radius: 6px; }

                                .box { 
                                    padding: 6px; 
                                    border: 1px solid #ddd; 
                                    margin-top: 5px; 
                                    border-radius: 6px; 
                                    font-size: 14px; 
                                    line-height: 1.2;
                                }

                                .signature-block {
                                    margin-top: 20px;
                                    text-align: right;
                                }

                                .signature-block img {
                                    width: 120px;
                                    height: auto;
                                }
                                
                                .signature-block p {
                                    margin: 2px 0;
                                    padding: 0;
                                    line-height: 1.1;
                                }

                                .footer {
                                    margin-top: 2px;
                                    text-align: center;
                                    font-size: 12px;
                                    color: #666;
                                }

                                .footer-watermark {
                                    text-align: center;
                                    font-size: 12px;
                                    margin-top: 8px;
                                    color: #999;
                                }
                            </style>
                        </head>
                        <body>

                            <div class="watermark">TechMart</div>

                            <h1>TechMart Invoice</h1>
                            <p class="sub">Premium Electronic Accessories Store</p>

                            <div class="box">
                                <h3>Invoice Details</h3>
                                <p><strong>Invoice Number:</strong> ${invoiceNo}</p>
                                <p><strong>Order ID:</strong> ${order.order_id}</p>
                                <p><strong>Payment ID:</strong> ${order.payment_id}</p>
                                <p><strong>Date:</strong> ${order.created_at}</p>
                            </div>

                            <div class="box">
                                <h3>Customer Details</h3>
                                <p><strong>Name:</strong> ${user.name}</p>
                                <p><strong>Email:</strong> ${user.email}</p>
                                <p><strong>Address:</strong> ${user.address}</p>
                                <p><strong>Pincode:</strong> ${user.pincode}</p>
                            </div>

                            <h3>Items</h3>
                            <table>
                                <tr>
                                    <th>Product Image</th>
                                    <th>Name</th>
                                    <th>ID</th>
                                    <th>Qty</th>
                                    <th>Price</th>
                                    <th>Subtotal</th>
                                </tr>

                                ${mergedItems
                                .map(
                                    i => `
                                            <tr>
                                                <td>${i.image ? `<img src="${i.image}" class="product"/>` : "No Image"}</td>
                                                <td>${i.name}</td>
                                                <td>${i.id}</td>
                                                <td>${i.qty}</td>
                                                <td>₹ ${i.price.toLocaleString("en-IN")}</td>
                                                <td><strong>₹ ${i.subtotal.toLocaleString("en-IN")}</strong></td>
                                            </tr>
                                        `
                                )
                                .join("")}
                            </table>

                            <div class="box">
                                <h3>Payment Summary</h3>
                                <p><strong>Subtotal:</strong> ₹ ${order.subtotal}</p>
                                <p><strong>Discount:</strong> ₹ ${order.discount}</p>
                                <p><strong>Tax:</strong> ₹ ${order.tax}</p>
                                <p><strong>Delivery:</strong> ₹ ${order.delivery}</p>
                                <p><strong>Grand Total:</strong> <strong>₹ ${order.total}</strong></p>
                            </div>

                            <div class="signature-block">
                                <img src="${signatureDataUrl}" />
                                <p><strong>Akshat Dubey</strong></p>
                                <p>Owner, TechMart</p>
                                <p>Date: ${new Date().toLocaleDateString()}</p>
                            </div>

                            <div class="footer">
                                For support, Contact us:
                                <br>Email: akshat00312@gmail.com
                                <br>Phone: +91 8839598761
                            </div>

                            <div class="footer-watermark">TechMart©2025</div>

                        </body>
                        </html>
                        `;

                        const file = { content: html };

                        pdf
                            .generatePdf(file, { format: "A4" })
                            .then(pdfBuffer => {
                                res.setHeader("Content-Type", "application/pdf");
                                res.setHeader(
                                    "Content-Disposition",
                                    `attachment; filename=invoice_${invoiceNo}.pdf`
                                );
                                res.send(pdfBuffer);
                            })
                            .catch(err => {
                                console.error("PDF Error:", err);
                                res.status(500).send("PDF generation failed");
                            });
                    }
                );
            }
        );
    });
});

module.exports = router;