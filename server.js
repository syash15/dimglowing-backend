const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected ✅"))
.catch(err => console.log("MongoDB Error:", err));

// ================= USER MODEL =================
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, default: "user" } // 👈 Add this
});

const User = mongoose.model("User", userSchema);
// ================= PRODUCT MODEL =================
const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  image: String,
  description: String
});

const Product = mongoose.model("Product", productSchema);

// ================= SIGNUP =================
app.post("/signup", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role: role || "user"
    });

    await newUser.save();

    res.json({ message: "User Registered Successfully ✅" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ================= LOGIN =================
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ error: "User not found" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ error: "Wrong password" });

  const token = jwt.sign(
    { id: user._id, role: user.role },
    "secret123",
    { expiresIn: "1h" }
  );

  res.json({ message: "Login successful ✅", token });
});

// ================= AUTH MIDDLEWARE =================

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Access Denied" });
  }

  // Split Bearer token
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : authHeader;

  try {
    const verified = jwt.verify(token, "secret123");
    req.user = verified;
    next();
  } catch (err) {
    console.log("TOKEN ERROR:", err.message);
    res.status(400).json({ message: "Invalid Token" });
  }
}

function verifyAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin Only" });
  }
  next();
}
// ================= ADMIN ADD PRODUCT =================

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

// ================= PRODUCTS =================
app.get("/products", async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
