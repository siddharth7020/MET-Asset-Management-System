const express = require("express");

// Database configuration
const db = require("./config/database");

// Routers
const mainRouter = require("./routes/routers"); // Assuming this is the intended main router file
const purchaseRouter = require("./routes/purchaseRouter"); // Renamed to avoid conflict

const defineAssociations = require("./models/purchase/associations");

const app = express();
app.use(express.json());

// Routes
app.use("/api", mainRouter); // Main router for general routes
app.use("/api/purchase", purchaseRouter); // Router for purchase-related routes

const port = 5000;

// Define associations
defineAssociations();

// Sync database and start server
const startServer = async () => {
    try {
        await db.sync({ force: false }); // Use { force: true } only during development to drop and recreate tables
        console.log("Database connected");
        
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    } catch (err) {
        console.error("Error connecting to database:", err);
        process.exit(1); // Exit the process if the database connection fails
    }
};

startServer();