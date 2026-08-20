import "dotenv/config";
import app from "./app.js";
import { supabase } from "./config/supabase.js";

const PORT = Number(process.env.PORT ?? 4000);

app.listen(PORT, () => {
    console.log("supabase backend client configured", !!supabase);
    console.log(`server is running on http://localhost:${PORT}`);
});
