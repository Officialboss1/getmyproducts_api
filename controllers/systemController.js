import mongoose from "mongoose";
import os from "os";

export const getSystemHealth = async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? "Connected" : "Disconnected";
    const uptime = process.uptime();

    res.status(200).json({
      status: "OK",
      dbStatus,
      uptime: `${Math.floor(uptime / 60)} minutes`,
      memoryUsage: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
      checkedAt: new Date(),
    });
  } catch (error) {
    res.status(500).json({
      status: "Error",
      message: "Health check failed",
      error: error.message,
    });
  }
};
