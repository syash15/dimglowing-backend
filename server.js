const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());

/* ================= DATABASE ================= */

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected ✅"))
  .catch(err => console.log("MongoDB Error:", err));


/* ================= USER MODEL ================= */

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, default: "user" }, // Default role = user
  resetToken: String,
  resetTokenExpiry: Date,
});

const User = mongoose.model("User", userSchema);


/* ================= PRODUCT MODEL ================= */

const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  image: String,
  description: String
});

const Product = mongoose.model("Product", productSchema);

/* ================= ORDER MODEL ================= */

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  items: [
    {
      productId: String,
      name: String,
      price: Number,
      quantity: Number
    }
  ],
  totalAmount: Number,
  shipping: {
    name: String,
    email: String,
    phone: String,
    address: String,
    city: String,
    postal: String
  },
  status: { type: String, default: "Pending" },
  createdAt: { type: Date, default: Date.now }
});

const Order = mongoose.model("Order", orderSchema);

/* ================= CREATE ORDER ================= */

app.post("/create-order", verifyToken, async (req, res) => {
  try {

    const { items, shipping } = req.body;

    if (!items || items.length === 0)
      return res.status(400).json({ error: "Cart is empty" });

    let totalAmount = 0;

    items.forEach(item => {
      totalAmount += item.price * item.quantity;
    });

    const newOrder = new Order({
      userId: req.user.id,
      items,
      totalAmount,
      shipping,
      status: "Pending"
    });

    await newOrder.save();

    res.json({ message: "Order placed successfully ✅" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
/* ================= GET ALL ORDERS (ADMIN) ================= */

app.get("/admin/orders", verifyToken, verifyAdmin, async (req, res) => {
  try {

    const orders = await Order.find().populate("userId", "name email");

    res.json(orders);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= USER ORDERS ================= */

app.get("/my-orders", verifyToken, async (req, res) => {
  try {

    const orders = await Order.find({ userId: req.user.id });

    res.json(orders);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= SIGNUP ================= */

app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ error: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role: "user" // 🔒 Always user (secure)
    });

    await newUser.save();

    res.json({ message: "User Registered Successfully ✅" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/* ================= LOGIN ================= */

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ error: "Wrong password" });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || "secret123",
      { expiresIn: "1h" }
    );

    res.json({ message: "Login successful ✅", token, role: user.role });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= FORGOT PASSWORD ================= */

app.post("/forgot-password", async (req, res) => {
  try {

    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ error: "User not found" });

    const resetToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || "secret123",
      { expiresIn: "15m" }
    );

    user.resetToken = resetToken;
    user.resetTokenExpiry = Date.now() + 15 * 60 * 1000;

    await user.save();

    // Normally you'd send email here
    res.json({
      message: "Reset link generated",
      resetLink: `https://yourfrontend.com/reset-password.html?token=${resetToken}`
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= RESET PASSWORD ================= */

app.post("/reset-password", async (req, res) => {
  try {

    const { token, newPassword } = req.body;

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "secret123"
    );

    const user = await User.findById(decoded.id);

    if (!user || user.resetToken !== token)
      return res.status(400).json({ error: "Invalid or expired token" });

    if (user.resetTokenExpiry < Date.now())
      return res.status(400).json({ error: "Token expired" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.resetToken = null;
    user.resetTokenExpiry = null;

    await user.save();

    res.json({ message: "Password reset successful ✅" });

  } catch (err) {
    res.status(400).json({ error: "Invalid or expired token" });
  }
});

/* ================= AUTH MIDDLEWARE ================= */

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader)
    return res.status(401).json({ message: "Access Denied" });

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : authHeader;

  try {
    const verified = jwt.verify(
      token,
      process.env.JWT_SECRET || "secret123"
    );

    req.user = verified;
    next();

  } catch (err) {
    res.status(400).json({ message: "Invalid Token" });
  }
}

function verifyAdmin(req, res, next) {
  if (req.user.role !== "admin")
    return res.status(403).json({ message: "Admin Only" });

  next();
}


/* ================= ADMIN ADD PRODUCT ================= */

app.post("/admin/add-product", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { name, price, image, description } = req.body;

    const newProduct = new Product({
      name,
      price,
      image,
      description
    });

    await newProduct.save();

    res.json({ message: "Product Added Successfully 🚀" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= DELETE PRODUCT ================= */

app.delete("/admin/delete-product/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await Product.findByIdAndDelete(id);

    res.json({ message: "Product Deleted Successfully 🗑️" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= UPDATE PRODUCT ================= */

app.put("/admin/update-product/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, image, description } = req.body;

    await Product.findByIdAndUpdate(id, {
      name,
      price,
      image,
      description
    });

    res.json({ message: "Product Updated Successfully ✏️" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= GET PRODUCTS ================= */

app.get("/products", async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= GET PROFILE ================= */

app.get("/profile", verifyToken, async (req, res) => {
  try {

    const user = await User.findById(req.user.id).select("-password");

    if (!user)
      return res.status(404).json({ error: "User not found" });

    res.json(user);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= START SERVER ================= */

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
});