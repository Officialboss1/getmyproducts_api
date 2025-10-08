import express from "express";
import {
  createCompetition,
  createGlobalCompetition,
  getCompetitions,
  getCompetitionLeaderboard,
  joinCompetition,
  leaveCompetition,
  getCompetitionById,
} from "../controllers/competitionController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, createCompetition); // Admins only
router.post("/global", protect, createGlobalCompetition); // Super Admins only
router.get("/", protect, getCompetitions); // All authenticated
router.get("/:id", protect, getCompetitionById);
router.get("/:id/leaderboard", protect, getCompetitionLeaderboard); // All authenticated
router.post("/:id/join", protect, joinCompetition);
router.post("/:id/leave", protect, leaveCompetition);

export default router;
