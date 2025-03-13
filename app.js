const express = require("express");

const db = require("./config/database");
const router = require("./routes/routers");
const PurchaseOrder = require("./routes/purchaseRouter");

const app = express();
app.use(express.json());
app.use('/api',router);
app.use('/api/purchase',PurchaseOrder);

const port = 5000;

db.sync()
    .then(() => {
        console.log("Database connected");
    })
    .catch((err) => {
        console.log("Error connecting to database", err);
    });

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});