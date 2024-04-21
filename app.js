const express = require("express");
const ErrorHandler = require("./middleware/error");
const app = express();
const cookieParser = require("cookie-parser");
const cors = require("cors");

app.use(cors({
  origin: ['*', 'http://localhost:3000', 'https://villaja-frontend.vercel.app', "https://www.villaja.com"],
  credentials: true
}));

// Set limit for JSON requests
app.use(express.json({ limit: "1000mb" }));

// Set limit for URL-encoded requests
app.use(express.urlencoded({ extended: true, limit: "1000mb" }));

app.use(cookieParser());

app.use("/test", (req, res) => {
  res.send("Testing route");
});
app.use("/", (req, res) => {
  res.send("Welcome to villaja's backend server");
});


// config
if (process.env.NODE_ENV !== "PRODUCTION") {
  require("dotenv").config({
    path: "config/.env",
  });
}

// import routes
const user = require("./controller/user");
const shop = require("./controller/shop");
const product = require("./controller/product");
const payment = require("./controller/payment");
const order = require("./controller/order");
const cart = require('./controller/cartItems');
const conversation = require("./controller/conversation");
const message = require("./controller/message");
const withdraw = require("./controller/withdraw");
const recomendation = require('./controller/recomendation');
const quickSell = require('./controller/quickSell')

app.use("/api/user", user);
app.use("/api/shop", shop);
app.use("/api/conversation", conversation);
app.use("/api/message", message);
app.use("/api/product", product);
app.use("/api/order", order);
app.use("/api/payment", payment);
app.use("/api/cart", cart);
app.use("/api/recomendation", recomendation);
app.use("/api/withdraw", withdraw);
app.use("/api/quick-sell", quickSell);

// it's for ErrorHandling
app.use(ErrorHandler);

module.exports = app;
