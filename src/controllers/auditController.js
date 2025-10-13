import mongoose from 'mongoose';
import SalesAudit from "../models/SalesAudit.js";
import { Parser } from 'json2csv';
import ExcelJS from 'exceljs';

// @desc Get audit logs (Admin: team-level, Super Admin: global)
export const getAuditLogs = async (req, res) => {
  try {
    const {
      saleId,
      editorId,
      search,
      userRole,
      actionType,
      dateFrom,
      dateTo,
      page = 1,
      limit = 10
    } = req.query;

    const matchConditions = {};

    if (saleId) matchConditions.sale_id = mongoose.Types.ObjectId(saleId);
    if (editorId) matchConditions.editor_user_id = mongoose.Types.ObjectId(editorId);
    if (actionType) matchConditions.action_type = actionType;
    if (dateFrom || dateTo) {
      matchConditions.createdAt = {};
      if (dateFrom) matchConditions.createdAt.$gte = new Date(dateFrom);
      if (dateTo) matchConditions.createdAt.$lte = new Date(dateTo);
    }

    // 🔹 If role is "admin", in the future we'll scope this to their team
    if (req.user.role === "admin") {
      // TODO: When User has teamId, filter logs for that team only
      // Example: matchConditions.editor_user_id = { $in: teamUserIds }
    }

    const pipeline = [
      { $match: matchConditions },
      {
        $lookup: {
          from: 'users',
          localField: 'editor_user_id',
          foreignField: '_id',
          as: 'editor_user'
        }
      },
      { $unwind: '$editor_user' },
      {
        $lookup: {
          from: 'sales',
          localField: 'sale_id',
          foreignField: '_id',
          as: 'sale'
        }
      },
      { $unwind: { path: '$sale', preserveNullAndEmptyArrays: true } }
    ];

    // Add filters for populated fields
    const postLookupMatch = {};
    if (userRole) postLookupMatch['editor_user.role'] = userRole;
    if (search) {
      postLookupMatch.$or = [
        { $expr: { $regexMatch: { input: { $concat: ['$editor_user.firstName', ' ', '$editor_user.lastName'] }, regex: search, options: 'i' } } },
        { action_type: { $regex: search, $options: 'i' } }
      ];
    }
    if (Object.keys(postLookupMatch).length > 0) {
      pipeline.push({ $match: postLookupMatch });
    }

    // Get total count
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await SalesAudit.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    // Add sorting, skip, limit
    pipeline.push(
      { $sort: { createdAt: -1 } },
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) }
    );

    // Project the fields
    pipeline.push({
      $project: {
        _id: 1,
        action_type: 1,
        before_data: 1,
        after_data: 1,
        createdAt: 1,
        editor_user: {
          _id: '$editor_user._id',
          firstName: '$editor_user.firstName',
          lastName: '$editor_user.lastName',
          email: '$editor_user.email',
          role: '$editor_user.role'
        },
        sale: {
          _id: '$sale._id',
          receiver_email: '$sale.receiver_email',
          quantity_sold: '$sale.quantity_sold',
          total_amount: '$sale.total_amount'
        }
      }
    });

    const logs = await SalesAudit.aggregate(pipeline);

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error("Error fetching audit logs:", error.message);
    res.status(500).json({ message: "Failed to fetch audit logs" });
  }
};

// export const getRecentActivities = async (req, res) => {
//   try {
//     const limit = parseInt(req.query.limit, 10) || 10;

//     const recent = await SalesAudit.find({})
//       .sort({ createdAt: -1 })
//       .limit(limit)
//       .populate("editor_user_id", "firstName lastName role")
//       .populate("sale_id", "receiver_email quantity_sold total_amount");

//     res.status(200).json(recent);
//   } catch (error) {
//     console.error("Error fetching audit logs:", error);
//     res.status(500).json({ message: "Failed to fetch recent activities" });
//   }
// };



// @desc Get recent audit activities for dashboard
export const getRecentAuditActivities = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 5; // Default to 5 for dashboard

    // Get recent audit logs
    const recentLogs = await SalesAudit.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("editor_user_id", "firstName lastName email role")
      .populate("sale_id", "receiver_email quantity_sold total_amount");

    // Transform to activity format expected by dashboard
    const activities = recentLogs.map(log => ({
      user: log.editor_user_id ?
        `${log.editor_user_id.firstName} ${log.editor_user_id.lastName}` :
        log.editor_user_id?.email || 'System',
      action: getActionDescription(log),
      timestamp: log.createdAt
    }));

    res.status(200).json(activities);
  } catch (error) {
    console.error("🔥 Recent audit activities fetch error:", error.message);
    console.error(error.stack);
    res.status(500).json({
      message: "Failed to fetch recent audit activities",
      error: error.message
    });
  }
};

// Helper function to generate human-readable action descriptions
const getActionDescription = (log) => {
  const actionType = log.action_type;
  const user = log.editor_user_id;

  switch (actionType) {
    case 'CREATE':
      if (log.sale_id) {
        return `Created sale for ${log.sale_id.receiver_email}: ${log.sale_id.quantity_sold} units, $${log.sale_id.total_amount}`;
      }
      return 'Created new record';

    case 'EDIT':
      if (log.sale_id) {
        return `Updated sale for ${log.sale_id.receiver_email}`;
      }
      return 'Updated record';

    case 'DELETE':
      if (log.sale_id) {
        return `Deleted sale for ${log.sale_id.receiver_email}`;
      }
      return 'Deleted record';

    default:
      return `${actionType} action performed`;
  }
};

// EXPORT AUDIT LOGS
export const exportAuditLogs = async (req, res) => {
  try {
    const { format = 'csv' } = req.query;

    const logs = await SalesAudit.find({})
      .populate("sale_id", "receiver_email quantity_sold total_amount")
      .populate("editor_user_id", "firstName lastName email role")
      .sort({ createdAt: -1 });

    const data = logs.map(log => ({
      date: log.createdAt.toISOString(),
      editor: `${log.editor_user_id.firstName} ${log.editor_user_id.lastName}`,
      action: log.action_type,
      saleId: log.sale_id ? log.sale_id._id : '',
      receiver: log.sale_id ? log.sale_id.receiver_email : '',
      quantity: log.sale_id ? log.sale_id.quantity_sold : '',
      amount: log.sale_id ? log.sale_id.total_amount : '',
      beforeData: JSON.stringify(log.before_data),
      afterData: JSON.stringify(log.after_data)
    }));

    if (format === 'csv') {
      const parser = new Parser();
      const csv = parser.parse(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="audit_logs.csv"');
      res.send(csv);
    } else if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Audit Logs');
      worksheet.columns = [
        { header: 'Date', key: 'date' },
        { header: 'Editor', key: 'editor' },
        { header: 'Action', key: 'action' },
        { header: 'Sale ID', key: 'saleId' },
        { header: 'Receiver', key: 'receiver' },
        { header: 'Quantity', key: 'quantity' },
        { header: 'Amount', key: 'amount' },
        { header: 'Before Data', key: 'beforeData' },
        { header: 'After Data', key: 'afterData' }
      ];
      worksheet.addRows(data);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="audit_logs.xlsx"');
      await workbook.xlsx.write(res);
      res.end();
    } else {
      res.status(400).json({ message: 'Invalid format. Use csv or excel.' });
    }
  } catch (error) {
    console.error("Export Audit Logs error:", error);
    res.status(500).json({ message: "Failed to export audit logs" });
  }
};
