require("dotenv").config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error(
        "ERROR: Set JWT_SECRET in your .env file to a random secret of at least 32 characters."
    );
    process.exit(1);
}

const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const pool = require("./db");
const authRoutes = require("./routes/auth");
const requireAuth = require("./middleware/auth");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Security headers.
app.use(helmet());

// Parse incoming request bodies.
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({
    extended: false,
    limit: "10kb"
}));

// Read cookies.
app.use(cookieParser());

// Limit repeated authentication requests.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
        message: "Too many attempts. Please wait 15 minutes and try again."
    }
});

// Authentication APIs.
app.use("/api/auth", authLimiter, authRoutes);

// Serve HTML, CSS, and JavaScript files.
app.use(express.static(path.join(__dirname, "public")));

// Database health check.
app.get("/api/health", async (req, res) => {
    try {
        await pool.query("SELECT 1");

        res.json({
            status: "ok",
            database: "connected"
        });

    } catch (error) {
        res.status(503).json({
            status: "error",
            database: "disconnected"
        });
    }
});

// Example protected API.
app.get("/api/protected", requireAuth, (req, res) => {
    res.json({
        message: "You have accessed a protected route.",
        userId: req.user.id
    });
});

// Handle unknown routes.
app.use((req, res) => {
    res.status(404).json({
        message: "Route not found."
    });
});

// Error handler.
app.use((error, req, res, next) => {
    console.error(error);

    if (res.headersSent) {
        return next(error);
    }

    res.status(500).json({
        message: "An unexpected server error occurred."
    });
});

// Start the server after checking the database connection.
async function start() {
    try {
        await pool.query("SELECT 1");

        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error(
            "Could not connect to MySQL. Check your .env settings and make sure MySQL is running."
        );

        console.error(error.message);
        process.exit(1);
    }
}

start();