import express from "express";
const router = express.Router();

router.post("/login", (req, res) => {
  console.log("LOGIN ROUTE HIT");
  // Simulate a token and user profile
  const dummyToken = "dummy-access-token-123";
  const user = { email: req.body.email, name: "Demo User" };
  const profile = { email: req.body.email, displayName: "Demo User" };
  res.json({ success: true, token: dummyToken, user, profile });
});

router.get("/me", (req, res) => {
  res.json({ authenticated: true });
});

export default router;
