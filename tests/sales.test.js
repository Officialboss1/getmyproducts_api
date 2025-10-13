import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app.js";
import User from "../src/models/User.js";
import Product from "../src/models/Product.js";
import Sale from "../src/models/Sale.js";

describe("Sales API", () => {
  let testUser;
  let testProduct;
  let authToken;

  beforeEach(async () => {
    // Clear collections
    await User.deleteMany({});
    await Product.deleteMany({});
    await Sale.deleteMany({});

    // Create test user with admin role for testing admin operations
    testUser = await User.create({
      firstName: "Test",
      lastName: "Admin",
      email: "admin@test.com",
      passwordHash: "hashedpassword",
      role: "admin"
    });

    // Create test product
    testProduct = await Product.create({
      name: "Test Product",
      current_price: 100,
      is_active: true
    });

    // Generate auth token (mock JWT)
    const jwt = (await import("jsonwebtoken")).default;
    authToken = jwt.sign(
      { id: testUser._id, role: testUser.role },
      process.env.JWT_SECRET || "test_secret"
    );
  });

  describe("POST /api/sales", () => {
    it("should create a new sale successfully", async () => {
      const saleData = {
        product_id: testProduct._id.toString(),
        receiver_email: "customer@example.com",
        quantity_sold: 2
      };

      const response = await request(app)
        .post("/api/sales")
        .set("Authorization", `Bearer ${authToken}`)
        .send(saleData)
        .expect(201);

      expect(response.body).toHaveProperty("_id");
      expect(response.body).toHaveProperty("user_id", testUser._id.toString());
      expect(response.body).toHaveProperty("product_id", testProduct._id.toString());
      expect(response.body).toHaveProperty("receiver_email", saleData.receiver_email);
      expect(response.body).toHaveProperty("quantity_sold", saleData.quantity_sold);
      expect(response.body).toHaveProperty("total_amount", 200); // 2 * 100
    });

    it("should return 400 for invalid product ID", async () => {
      const invalidData = {
        product_id: "invalid_id",
        receiver_email: "customer@example.com",
        quantity_sold: 1
      };

      const response = await request(app)
        .post("/api/sales")
        .set("Authorization", `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty("message");
    });

    it("should return 400 for inactive product", async () => {
      // Make product inactive
      await Product.findByIdAndUpdate(testProduct._id, { is_active: false });

      const saleData = {
        product_id: testProduct._id.toString(),
        receiver_email: "customer@example.com",
        quantity_sold: 1
      };

      const response = await request(app)
        .post("/api/sales")
        .set("Authorization", `Bearer ${authToken}`)
        .send(saleData)
        .expect(400);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toMatch(/inactive product/i);
    });

    it("should return 400 for invalid email format", async () => {
      const invalidData = {
        product_id: testProduct._id.toString(),
        receiver_email: "invalid-email",
        quantity_sold: 1
      };

      const response = await request(app)
        .post("/api/sales")
        .set("Authorization", `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toMatch(/validation failed/i);
    });
  });

  describe("GET /api/sales", () => {
    beforeEach(async () => {
      // Create some test sales
      await Sale.create([
        {
          user_id: testUser._id,
          product_id: testProduct._id,
          receiver_email: "customer1@example.com",
          quantity_sold: 1,
          price_per_unit_at_sale: 100,
          total_amount: 100
        },
        {
          user_id: testUser._id,
          product_id: testProduct._id,
          receiver_email: "customer2@example.com",
          quantity_sold: 2,
          price_per_unit_at_sale: 100,
          total_amount: 200
        }
      ]);
    });

    it("should get sales for authenticated user", async () => {
      const response = await request(app)
        .get("/api/sales")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("sales");
      expect(response.body).toHaveProperty("pagination");
      expect(Array.isArray(response.body.sales)).toBe(true);
      expect(response.body.sales).toHaveLength(2);
    });

    it("should return 401 without authentication", async () => {
      const response = await request(app)
        .get("/api/sales")
        .expect(401);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toMatch(/not authorized/i);
    });

    it("should support pagination", async () => {
      const response = await request(app)
        .get("/api/sales?page=1&limit=1")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.sales).toHaveLength(1);
      expect(response.body.pagination).toHaveProperty("page", 1);
      expect(response.body.pagination).toHaveProperty("limit", 1);
      expect(response.body.pagination).toHaveProperty("total", 2);
    });
  });

  describe("PUT /api/sales/:id", () => {
    let testSale;

    beforeEach(async () => {
      testSale = await Sale.create({
        user_id: testUser._id,
        product_id: testProduct._id,
        receiver_email: "customer@example.com",
        quantity_sold: 1,
        price_per_unit_at_sale: 100,
        total_amount: 100
      });
    });

    it("should update sale successfully", async () => {
      const updateData = {
        receiver_email: "updated@example.com",
        quantity_sold: 3
      };

      const response = await request(app)
        .put(`/api/sales/${testSale._id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty("receiver_email", updateData.receiver_email);
      expect(response.body).toHaveProperty("quantity_sold", updateData.quantity_sold);
      expect(response.body).toHaveProperty("total_amount", 300); // 3 * 100
    });

    it("should return 404 for non-existent sale", async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .put(`/api/sales/${fakeId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ receiver_email: "test@example.com" })
        .expect(404);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toMatch(/sale not found/i);
    });
  });

  describe("DELETE /api/sales/:id", () => {
    let testSale;

    beforeEach(async () => {
      testSale = await Sale.create({
        user_id: testUser._id,
        product_id: testProduct._id,
        receiver_email: "customer@example.com",
        quantity_sold: 1,
        price_per_unit_at_sale: 100,
        total_amount: 100
      });
    });

    it("should delete sale successfully", async () => {
      const response = await request(app)
        .delete(`/api/sales/${testSale._id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toMatch(/sale deleted/i);

      // Verify sale is deleted
      const deletedSale = await Sale.findById(testSale._id);
      expect(deletedSale).toBeNull();
    });

    it("should return 404 for non-existent sale", async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .delete(`/api/sales/${fakeId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toMatch(/sale not found/i);
    });
  });
});