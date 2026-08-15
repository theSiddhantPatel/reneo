// import { Result } from "pg";
import "dotenv/config";
import app from "./app.js"
import pool from "./config/db.js"
import { supabase } from "./config/supabase.js"

pool.query("SELECT NOW()")
    .then((result) => {
        console.log("DB connected", result.rows[0]);

    }).catch((error) => {
        console.error("DB connection failed", error);
    });

const PORT = 4000;

app.listen(PORT, () => {
    console.log("supabase backend client configured", !!supabase);
    console.log(`server is running on http://localhost:${PORT}`);
}) 