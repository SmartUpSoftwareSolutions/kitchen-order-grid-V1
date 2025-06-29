/**
 * QueryBuilder class for building SQL Server queries with a Supabase-like API
 */
class QueryBuilder {
  constructor(tableName, client) {
    this.tableName = tableName;
    this.client = client;
    this.resetQuery();
  }

  resetQuery() {
    this._select = '*';
    this._where = [];
    this._whereParams = [];
    this._orderBy = [];
    this._limit = null;
    this._offset = null;
    this._joins = [];
    return this;
  }

  select(columns) {
    this._select = Array.isArray(columns) ? columns.join(', ') : columns;
    return this;
  }

  where(column, operator, value) {
    if (value === undefined) {
      value = operator;
      operator = '=';
    }

    if (operator.toUpperCase() === 'IS' && value === null) {
      this._where.push(`${column} IS NULL`);
    } else {
      const paramIndex = this._whereParams.length;
      this._where.push(`${column} ${operator} @param${paramIndex}`);
      this._whereParams.push(value);
    }
    return this;
  }

  whereNot(column, operator, value) {
    if (value === undefined) {
      value = operator;
      value = operator;
      operator = '=';
    }

    let condition;
    const currentParamIndex = this._whereParams.length;

    if (operator.toUpperCase() === 'IN' && Array.isArray(value)) {
      const placeholders = value.map((_, i) => `@param${currentParamIndex + i}`).join(', ');
      condition = `${column} NOT IN (${placeholders})`;
      this._whereParams.push(...value);
    }
    else if (operator.toUpperCase() === 'IS' && value === null) {
      condition = `${column} IS NOT NULL`;
    }
    else if (operator === '=') {
      condition = `${column} != @param${currentParamIndex}`;
      this._whereParams.push(value);
    }
    else {
      condition = `NOT (${column} ${operator} @param${currentParamIndex})`;
      this._whereParams.push(value);
    }

    this._where.push(condition);
    return this;
  }

  whereIn(column, values) {
    if (!Array.isArray(values) || values.length === 0) {
      this._where.push('1 = 0');
      return this;
    }
    const currentParamIndex = this._whereParams.length;
    const placeholders = values.map((_, i) => `@param${currentParamIndex + i}`).join(', ');
    this._where.push(`${column} IN (${placeholders})`);
    this._whereParams.push(...values);
    return this;
  }

  eq(column, value) {
    return this.where(column, '=', value);
  }

  order(column, direction = 'asc') {
    let dir;
    if (typeof direction === 'string') {
      dir = direction.toUpperCase();
    } else if (typeof direction === 'object' && direction !== null) {
      dir = direction.ascending === true ? 'ASC' : 'DESC';
    } else {
      dir = 'ASC';
    }

    this._orderBy.push(`${column} ${dir}`);
    return this;
  }

  limit(count) {
    this._limit = count;
    return this;
  }

  offset(count) {
    this._offset = count;
    return this;
  }

  join(table, localColumn, foreignColumn, type = 'INNER') {
    this._joins.push(`${type} JOIN ${table} ON ${localColumn} = ${foreignColumn}`);
    return this;
  }

  async _buildAndExecuteQuery(additionalSQL = '') {
    let query = `SELECT ${this._select} FROM ${this.tableName}`;

    if (this._joins.length > 0) {
      query += ' ' + this._joins.join(' ');
    }

    const params = [...this._whereParams];

    if (this._where.length > 0) {
      query += ` WHERE ${this._where.join(' AND ')}`;
    }

    if (this._orderBy.length > 0) {
      query += ` ORDER BY ${this._orderBy.join(', ')}`;
    } else if (this._limit !== null || this._offset !== null) {
      query += ` ORDER BY (SELECT NULL)`;
    }

    if (this._offset !== null) {
      query += ` OFFSET ${this._offset} ROWS`;
    }

    if (this._limit !== null) {
      query += ` FETCH NEXT ${this._limit} ROWS ONLY`;
    }

    query += additionalSQL;

    console.log('QueryBuilder: Generated SQL (SELECT/GET):', query);
    console.log('QueryBuilder: Generated Params (SELECT/GET):', params);

    // DEBUG: Log data and error received from mssqlClient.query()
    const { data, error } = await this.client.query(query, params);
    console.log("QueryBuilder: _buildAndExecuteQuery - Data received from client.query():", data);
    console.log("QueryBuilder: _buildAndExecuteQuery - Error received from client.query():", error);

    this.resetQuery();

    if (error) {
      throw error;
    }
    return data;
  }

  async get() {
    return this._buildAndExecuteQuery();
  }

  async single() {
    const results = await this.limit(1).get();
    return results.length > 0 ? results[0] : null;
  }

  async insert(data) {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, i) => `@param${i}`).join(', ');

    const query = `
      INSERT INTO ${this.tableName} (${columns.join(', ')})
      VALUES (${placeholders});
      SELECT SCOPE_IDENTITY() AS id;
    `;

    const { data: resultData, error } = await this.client.query(query, values);
    if (error) throw error;
    this.resetQuery();
    return { ...data, id: resultData[0]?.id };
  }

  async update(data) {
    if (this._where.length === 0) throw new Error('Update operation requires a where clause');

    const setKeys = Object.keys(data);
    const setValues = Object.values(data);
    
    const setClause = setKeys
      .map((key, i) => `${key} = @param${i}`)
      .join(', ');

    const setParamsCount = setValues.length;
    const adjustedWhereClauses = this._where.map(condition => {
        return condition.replace(/@param(\d+)/g, (match, p1) => {
            return `@param${parseInt(p1) + setParamsCount}`;
        });
    });

    const params = [...setValues, ...this._whereParams];

    const query = `
      UPDATE ${this.tableName}
      SET ${setClause}
      WHERE ${adjustedWhereClauses.join(' AND ')};
    `;

    console.log('QueryBuilder: Debugging Update - setKeys:', setKeys);
    console.log('QueryBuilder: Debugging Update - setValues:', setValues);
    console.log('QueryBuilder: Debugging Update - _where:', this._where);
    console.log('QueryBuilder: Debugging Update - _whereParams:', this._whereParams);
    console.log('QueryBuilder: Debugging Update - setParamsCount:', setParamsCount);
    console.log('QueryBuilder: Debugging Update - adjustedWhereClauses:', adjustedWhereClauses);
    console.log('QueryBuilder: Generated SQL (UPDATE):', query);
    console.log('QueryBuilder: Generated Params (UPDATE):', params);

    const { data: resultData, error } = await this.client.query(query, params);
    if (error) throw error;
    this.resetQuery();
    return { success: true, rowsAffected: resultData?.rowsAffected || 0 };
  }

  async delete() {
    if (this._where.length === 0) throw new Error('Delete operation requires a where clause');

    const query = `
      DELETE FROM ${this.tableName}
      WHERE ${this._where.join(' AND ')};
    `;

    const { data: resultData, error } = await this.client.query(query, this._whereParams);
    if (error) throw error;
    this.resetQuery();
    return { success: true, rowsAffected: resultData?.rowsAffected || 0 };
  }



}

/**
 * MSSQLClient class that mimics Supabase client API
 */
class MSSQLClient {
  constructor(apiUrl) {
    if (!apiUrl) {
      console.warn('API URL not provided to MSSQLClient, using default: http://localhost:3000/api');
    }
    this.apiUrl = apiUrl || 'http://localhost:3000/api';
    this.defaultTimeoutMs = 30000; // <--- Increase this to 30 seconds (or more for testing, e.g., 60000)

  }

  async query(query, params = []) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.defaultTimeoutMs); // Set the timeout

    try {
      console.log('MSSQLClient.query: Sending POST request to:', `${this.apiUrl}/query`);
      console.log('MSSQLClient.query: Request Body:', { query, params });

      const response = await fetch(`${this.apiUrl}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, params }),
        signal: controller.signal, // <--- Pass the signal to the fetch request
      });

      clearTimeout(id); // Clear the timeout if the fetch completes

      console.log('MSSQLClient.query: Response status:', response.status, response.statusText);
      console.log('MSSQLClient.query: Response OK?', response.ok);

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const errorBody = await response.json();
            console.error('Frontend: API Response not OK. Error Body:', errorBody);
            return { data: null, error: new Error(errorBody.error || errorBody.message || 'Query failed (JSON error body)') };
        } else {
            const errorText = await response.text();
            console.error('Frontend: API Response not OK. Non-JSON Error Body:', errorText);
            return { data: null, error: new Error(`Query failed: ${response.statusText} - ${errorText.substring(0, 100)}`) };
        }
      }

      const text = await response.text();
      console.log('MSSQLClient.query: Raw response text:', text);

      if (!text) {
          console.warn('MSSQLClient.query: Received empty response body.');
          return { data: [], error: null };
      }

      let json;
      try {
          json = JSON.parse(text);
          console.log('MSSQLClient.query: Parsed JSON from response:', json);
      } catch (parseError) {
          console.error('MSSQLClient.query: JSON parsing failed:', parseError, 'Raw text:', text);
          return { data: null, error: new Error(`JSON parsing failed: ${parseError.message}`) };
      }

      return { data: json, error: null };
    } catch (error) {
      clearTimeout(id); // Ensure timeout is cleared even on error
      if (error.name === 'AbortError') {
        console.error('MSSQLClient.query: Request timed out.');
        return { data: null, error: new Error('Timeout: Request failed to complete within ' + this.defaultTimeoutMs + 'ms') };
      }
      console.error('MSSQLClient.query: Catch block error during fetch/json parsing:', error);
      return { data: null, error: error };
    }
  }

  table(tableName) {
    return new QueryBuilder(tableName, this);
  }

  from(tableName) {
    return this.table(tableName);
  }
}

const API_URL = 'http://localhost:3000/api';
const mssqlClient = new MSSQLClient(API_URL);

export default mssqlClient;
export { mssqlClient };
