import bcrypt from "bcryptjs";
import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { User } from "../../models/index.js";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  req.session.userId = String(user._id);
  res.json({ ok: true });
});

authRouter.post("/logout", requireAuth, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

authRouter.get("/me", (req, res) => {
  res.json({ authenticated: Boolean(req.session.userId) });
});
