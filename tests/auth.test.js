import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app.js";
import User from "../src/models/User.js";

describe("Authentication API", () => {
  beforeEach(async () => {
    // Clear users collection before each test
    await User.deleteMany({});
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user successfully", async () => {
      const userData = {
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        password: "Password123",
        role: "salesperson"
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty("message", "Registration successful");
      expect(response.body).toHaveProperty("token");
      expect(response.body).toHaveProperty("user");
      expect(response.body.user).toHaveProperty("email", userData.email);
      expect(response.body.user).toHaveProperty("role", userData.role);
    });

    it("should return 400 for missing required fields", async () => {
      const incompleteData = {
        firstName: "John",
        email: "john.doe@example.com"
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(incompleteData)
        .expect(400);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toMatch(/validation failed/i);
    });

    it("should return 400 for duplicate email", async () => {
      const userData = {
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        password: "Password123",
        role: "salesperson"
      };

      // Create first user
      await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);

      // Try to create duplicate
      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toMatch(/already registered/i);
    });

    it("should return 400 for invalid email format", async () => {
      const invalidData = {
        firstName: "John",
        lastName: "Doe",
        email: "invalid-email",
        password: "Password123",
        role: "salesperson"
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toMatch(/validation failed/i);
    });
  });

  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      // Create a test user
      const userData = {
        firstName: "Jane",
        lastName: "Smith",
        email: "jane.smith@example.com",
        password: "Password123",
        role: "salesperson"
      };

      await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);
    });

    it("should login successfully with correct credentials", async () => {
      const loginData = {
        email: "jane.smith@example.com",
        password: "Password123"
      };

      const response = await request(app)
        .post("/api/auth/login")
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty("_id");
      expect(response.body).toHaveProperty("firstName", "Jane");
      expect(response.body).toHaveProperty("lastName", "Smith");
      expect(response.body).toHaveProperty("email", loginData.email);
      expect(response.body).toHaveProperty("role", "salesperson");
      expect(response.body).toHaveProperty("token");
    });

    it("should return 401 for invalid credentials", async () => {
      const invalidData = {
        email: "jane.smith@example.com",
        password: "wrongpassword"
      };

      const response = await request(app)
        .post("/api/auth/login")
        .send(invalidData)
        .expect(401);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toMatch(/invalid credentials/i);
    });

    it("should return 401 for non-existent user", async () => {
      const nonExistentData = {
        email: "nonexistent@example.com",
        password: "Password123"
      };

      const response = await request(app)
        .post("/api/auth/login")
        .send(nonExistentData)
        .expect(401);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toMatch(/invalid credentials/i);
    });
  });
});