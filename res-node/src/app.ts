import express from "express";

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  const nodeNum = process.env.NODE_NUM || "Error: NODE_NUM not set";
  console.log(`Received request on Node ${nodeNum}`);
  res.status(200).send(`Hello from Node ${nodeNum}`);
});

export default app;
