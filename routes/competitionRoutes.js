import express from "express";
import {
  createCompetition,
  getCompetitions,
  getCompetitionLeaderboard,
} from "../controllers/competitionController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, createCompetition); // Admins only
router.get("/", protect, getCompetitions); // All authenticated
router.get("/:id/leaderboard", protect, getCompetitionLeaderboard); // All authenticated

export default router;
