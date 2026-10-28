const jwt = require("jsonwebtoken");
const pool = require("../db");

async function requireAuth(req, res, next) {
    try {
        const token = req.cookies?.auth_token;

        if (!token) {
            return res.status(401).json({
                message: "Please log in to continue."
            });
        }

        let payload;

        try {
            payload = jwt.verify(
                token,
                process.env.JWT_SECRET
            );
        } catch (error) {
            return res.status(401).json({
                message: "Your session has expired. Please log in again."
            });
        }

        const [sessions] = await pool.execute(
            `SELECT session_id, user_id
             FROM auth_sessions
             WHERE session_id = ?
             AND user_id = ?
             AND revoked_at IS NULL
             AND expires_at > UTC_TIMESTAMP()
             LIMIT 1`,
            [payload.sid, payload.sub]
        );

        if (sessions.length === 0) {
            return res.status(401).json({
                message: "Session is no longer active."
            });
        }

        req.user = {
            id: Number(payload.sub),
            sessionId: payload.sid
        };

        next();

    } catch (error) {
        next(error);
    }
}

module.exports = requireAuth;