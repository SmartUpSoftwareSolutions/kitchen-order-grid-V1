// controllers/queryController.js
import { asyncHandler } from "../../../utils/errorHandling.js";
import { masterDB } from "../../../../DB/connection.js";
import sql from 'mssql';

// Add connection check middleware
const checkDbConnection = asyncHandler(async (req, res, next) => {
  if (!masterDB) {
    console.error('Database connection pool not initialized');
    return res.status(500).json({ error: 'Database not configured' });
  }
  
  try {
    // Verify connection is alive
    await masterDB.request().query('SELECT 1');
    next();
  } catch (err) {
    console.error('Database connection verification failed:', err);
    try {
      console.log('Attempting to reconnect...');
      await masterDB.connect();
      next();
    } catch (reconnectErr) {
      console.error('Reconnection failed:', reconnectErr);
      res.status(503).json({ 
        error: 'Database unavailable',
        details: reconnectErr.message 
      });
    }
  }
});

export const query = asyncHandler(async (req, res) => {
  const { query: queryString, params } = req.body;

  if (!queryString) {
    return res.status(400).json({ error: 'Query string is required' });
  }

  console.log('Executing query:', queryString);
  if (params) console.log('With parameters:', params);

  const request = masterDB.request();
  
  // Parameter handling
  if (params && Array.isArray(params)) {
    params.forEach((paramValue, index) => {
      if (paramValue === undefined) {
        console.warn(`Parameter ${index} is undefined, skipping`);
        return;
      }
      
      const paramName = `param${index}`;
      let sqlType = inferSqlType(paramValue);
      request.input(paramName, sqlType, paramValue);
    });
  }

  try {
    const result = await request.query(queryString);
    const responseData = formatResult(result);
    res.json(responseData);
  } catch (error) {
    handleQueryError(error, res);
  }
});

// Helper functions
function inferSqlType(value) {
  if (value === null) return sql.NVarChar;
  if (typeof value === 'number') {
    return Number.isInteger(value) ? sql.Int : sql.Float;
  }
  if (typeof value === 'boolean') return sql.Bit;
  if (typeof value === 'string') {
    return /^\d{4}-\d{2}-\d{2}/.test(value) ? sql.DateTime2 : sql.NVarChar;
  }
  if (value instanceof Date) return sql.DateTime2;
  return sql.NVarChar;
}

function formatResult(result) {
  if (result.recordset) {
    return result.recordset;
  }
  if (result.rowsAffected?.[0] > 0) {
    return { 
      rowsAffected: result.rowsAffected[0], 
      success: true 
    };
  }
  return { 
    success: true, 
    message: "Query executed successfully" 
  };
}

function handleQueryError(error, res) {
  console.error('Database error:', error);
  
  const errorInfo = error.originalError?.info || {};
  const response = {
    error: error.message,
    details: {
      sqlMessage: errorInfo.message,
      sqlState: errorInfo.state,
      lineNumber: errorInfo.lineNumber,
      procedure: errorInfo.procName,
      server: errorInfo.serverName
    }
  };

  res.status(500).json(response);
}