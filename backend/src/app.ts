import express from "express"
const app=express();

app.use(express.json());

app.get("/hi", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Reneo backend is running",
  });
});
export default app;