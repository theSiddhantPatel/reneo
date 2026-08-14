// import { Result } from "pg";
import app from "./app.js"
import pool from "./config/db.js"

pool.query("SELECT NOW()")
    .then((result) => {
        console.log("DB connected", result.rows[0]);

    }).catch((error) => {
        console.error("DB connection failed", error);
    });

const PORT = 4000;

app.listen(PORT, () => {
    console.log(`server is running on http://localhost:${PORT}`);
}) 