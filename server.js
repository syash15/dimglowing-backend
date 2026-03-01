const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Use environment variable
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected ✅"))
.catch(err => console.log("MongoDB Error:", err));

const products = [
  { id: 1, name: "LED Bulb", price: 199 },
  { id: 2, name: "Wall Light", price: 899 },
  { id: 3, name: "Ceiling Lamp", price: 1499 }
];

app.get("/products", (req, res) => {
  res.json(products);
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
});