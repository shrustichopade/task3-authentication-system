const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const pool = require("../db");
const requireAuth = require("../middleware/auth");

const router = express.Router();

const COOKIE_NAME = "auth_token";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function cookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: ONE_DAY_MS,
        path: "/"
    };
}

function cleanUser(user) {
    return {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.created_at
    };
}

// REGISTER
router.post("/register", async (req, res, next) => {
    try {
        let { email, username, password } = req.body || {};

        email = typeof email === "string"
            ? email.trim().toLowerCase()
            : "";

        username = typeof username === "string"
            ? username.trim().toLowerCase()
            : "";

        if (!email || !username || typeof password !== "string") {
            return res.status(400).json({
                message: "Email, username, and password are required."
            });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                message: "Please enter a valid email address."
            });
        }

        if (
            username.length < 3 ||
            username.length > 50 ||
            !/^[a-z0-9_.-]+$/.test(username)
        ) {
            return res.status(400).json({
                message: "Username must be 3–50 characters and use letters, numbers, dots, underscores, or hyphens."
            });
        }

        if (password.length < 8 || password.length > 72) {
            return res.status(400).json({
                message: "Password must be between 8 and 72 characters."
            });
        }

        // Hash the password before saving it.
        const passwordHash = await bcrypt.hash(password, 12);

        const [result] = await pool.execute(
            `INSERT INTO users
             (email, username, password_hash)
             VALUES (?, ?, ?)`,
            [email, username, passwordHash]
        );

        return res.status(201).json({
            message: "Registration successful. You can now log in.",
            userId: result.insertId
        });

    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                message: "That email or username is already registered."
            });
        }

        next(error);
    }
});

// LOGIN
router.post("/login", async (req, res, next) => {
    try {
        let { identity, password } = req.body || {};

        identity = typeof identity === "string"
            ? identity.trim().toLowerCase()
            : "";

        if (!identity || typeof password !== "string" || !password) {
            return res.status(400).json({
                message: "Username/email and password are required."
            });
        }

        const [users] = await pool.execute(
            `SELECT id, email, username, password_hash, created_at
             FROM users
             WHERE email = ? OR username = ?
             LIMIT 1`,
            [identity, identity]
        );

        if (
            users.length === 0 ||
            !(await bcrypt.compare(password, users[0].password_hash))
        ) {
            return res.status(401).json({
                message: "Invalid username/email or password."
            });
        }

        const user = users[0];
        const sessionId = crypto.randomUUID();

        // Save the login session in MySQL.
        await pool.execute(
            `INSERT INTO auth_sessions
             (session_id, user_id, expires_at)
             VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 DAY))`,
            [sessionId, user.id]
        );

        // Create a signed JWT.
        const token = jwt.sign(
            {
                sub: String(user.id),
                sid: sessionId
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1d",
                issuer: "task3-authentication-system"
            }
        );

        // Store JWT in an HttpOnly cookie.
        res.cookie(COOKIE_NAME, token, cookieOptions());

        return res.json({
            message: "Login successful.",
            user: cleanUser(user)
        });

    } catch (error) {
        next(error);
    }
});

// GET CURRENT USER - PROTECTED ROUTE
router.get("/me", requireAuth, async (req, res, next) => {
    try {
        const [users] = await pool.execute(
            `SELECT id, email, username, created_at
             FROM users
             WHERE id = ?
             LIMIT 1`,
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(401).json({
                message: "User account not found."
            });
        }

        return res.json({
            user: cleanUser(users[0])
        });

    } catch (error) {
        next(error);
    }
});

// LOGOUT
router.post("/logout", async (req, res, next) => {
    try {
        const token = req.cookies?.[COOKIE_NAME];

        if (token) {
            try {
                const payload = jwt.verify(
                    token,
                    process.env.JWT_SECRET
                );

                await pool.execute(
                    `UPDATE auth_sessions
                     SET revoked_at = UTC_TIMESTAMP()
                     WHERE session_id = ?
                     AND user_id = ?
                     AND revoked_at IS NULL`,
                    [payload.sid, payload.sub]
                );

            } catch (error) {
                // Clear the cookie even if the token has expired.
            }
        }

        res.clearCookie(COOKIE_NAME, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/"
        });

        return res.json({
            message: "You have been logged out."
        });

    } catch (error) {
        next(error);
    }
});

module.exports = router;