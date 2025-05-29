const express = require("express");
const fileUpload = require("express-fileupload"); // Add express-fileupload
const path = require("path"); // Add path module for file handling

// Database configuration
const db = require("./config/database");

const cors = require("cors");

// Routers
const mainRouter = require("./routes/routers");
const purchaseRouter = require("./routes/purchaseRouter");

const defineAssociations = require("./models/purchase/associations");

const app = express();
app.use(express.json());

// Enable file upload middleware
app.use(fileUpload({
    createParentPath: true, // Automatically create directories if they don't exist
    limits: { fileSize: 10 * 1024 * 1024 }, // Limit file size to 10MB
    abortOnLimit: true // Abort if file exceeds limit
}));

app.use(cors()); // Enable CORS for all routes

// Serve static files from the uploads directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api", mainRouter);
app.use("/api/purchase", purchaseRouter);

const port = 5000;

// Define associations
defineAssociations();

// Sync database and start server
const startServer = async () => {
    try {
        await db.sync({ force: false });
        console.log("Database connected");
        
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    } catch (err) {
        console.error("Error connecting to database:", err);
        process.exit(1);
    }
};

startServer();