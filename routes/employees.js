/**
 * Employee Routes
 * Handles employee management, tasks, and work tracking
 */

const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validateEmployee, validateEmployeeTask, validateTaskActivity } = require('../middleware/security');
const { ResponseFormatter, asyncHandler, createPaginationInfo } = require('../middleware/response');
const { dbManager } = require('../utils/database');
const winston = require('winston');

const router = express.Router();

// Logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'mobile-cover-inventory-employees' },
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ],
});

// Get all employees with pagination and search
router.get('/', asyncHandler(async (req, res) => {
    const { 
        page = 1, 
        limit = 20, 
        search = '', 
        role = '',
        is_active = '',
        sort = 'name',
        order = 'ASC'
    } = req.query;

    try {
        const offset = (page - 1) * limit;
        
        // Build WHERE clause
        let whereClause = 'WHERE 1=1';
        let params = [];
        
        if (search) {
            whereClause += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }
        
        if (role) {
            whereClause += ' AND role = ?';
            params.push(role);
        }
        
        if (is_active !== '') {
            whereClause += ' AND is_active = ?';
            params.push(is_active === 'true' ? 1 : 0);
        }
        
        // Validate sort parameters
        const validSortFields = ['name', 'email', 'role', 'salary', 'performance_rating', 'created_date'];
        const validOrder = ['ASC', 'DESC'];
        const sortField = validSortFields.includes(sort) ? sort : 'name';
        const sortOrder = validOrder.includes(order.toUpperCase()) ? order.toUpperCase() : 'ASC';
        
        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM employees 
            ${whereClause}
        `;
        const countResult = await dbManager.get(countQuery, params);
        
        // Get employees with pagination
        const employeesQuery = `
            SELECT 
                id, name, email, phone, role, salary, performance_rating, 
                is_active, created_date, updated_date,
                (SELECT COUNT(*) FROM employee_tasks WHERE employee_id = employees.id) as total_tasks,
                (SELECT COUNT(*) FROM employee_tasks WHERE employee_id = employees.id AND status = 'completed') as completed_tasks
            FROM employees
            ${whereClause}
            ORDER BY ${sortField} ${sortOrder}
            LIMIT ? OFFSET ?
        `;
        
        const employees = await dbManager.all(employeesQuery, [...params, parseInt(limit), offset]);
        
        // Create pagination info
        const pagination = createPaginationInfo(page, limit, countResult.total);
        
        ResponseFormatter.paginated(res, employees, pagination, 'Employees retrieved successfully');
        
    } catch (error) {
        logger.error('Error fetching employees:', error);
        ResponseFormatter.serverError(res, 'Failed to fetch employees');
    }
}));

// Get employee by ID
router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const employee = await dbManager.get(
        `SELECT * FROM employees WHERE id = ?`, 
        [id]
    );
    
    if (!employee) {
        return ResponseFormatter.notFound(res, 'Employee not found');
    }
    
    // Get additional stats
    const stats = await dbManager.get(`
        SELECT 
            (SELECT COUNT(*) FROM employee_tasks WHERE employee_id = ?) as total_tasks,
            (SELECT COUNT(*) FROM employee_tasks WHERE employee_id = ? AND status = 'completed') as completed_tasks,
            (SELECT SUM(hours_worked) FROM task_activities WHERE employee_id = ?) as total_hours_worked,
            (SELECT AVG(hours_worked) FROM task_activities WHERE employee_id = ?) as avg_hours_per_activity
    `, [id, id, id, id]);
    
    ResponseFormatter.success(res, { ...employee, stats }, 'Employee retrieved successfully');
}));

// Create new employee (admin only)
router.post('/', authenticate, requireAdmin, validateEmployee, asyncHandler(async (req, res) => {
    const { name, email, phone, role, salary, performance_rating } = req.body;
    
    try {
        const result = await dbManager.run(
            `INSERT INTO employees (name, email, phone, role, salary, performance_rating)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [name, email, phone, role, salary, performance_rating]
        );
        
        const newEmployee = await dbManager.get(
            'SELECT * FROM employees WHERE id = ?', 
            [result.lastID]
        );
        
        ResponseFormatter.created(res, newEmployee, 'Employee created successfully');
        
    } catch (error) {
        logger.error('Error creating employee:', error);
        if (error.message.includes('UNIQUE constraint failed')) {
            return ResponseFormatter.conflict(res, 'Employee email already exists');
        }
        ResponseFormatter.serverError(res, 'Failed to create employee');
    }
}));

// Update employee (admin only)
router.put('/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, email, phone, role, salary, performance_rating, is_active } = req.body;
    
    try {
        // Build dynamic update query
        const updateFields = [];
        const updateParams = [];
        
        if (name !== undefined) {
            updateFields.push('name = ?');
            updateParams.push(name);
        }
        
        if (email !== undefined) {
            updateFields.push('email = ?');
            updateParams.push(email);
        }
        
        if (phone !== undefined) {
            updateFields.push('phone = ?');
            updateParams.push(phone);
        }
        
        if (role !== undefined) {
            updateFields.push('role = ?');
            updateParams.push(role);
        }
        
        if (salary !== undefined) {
            updateFields.push('salary = ?');
            updateParams.push(salary);
        }
        
        if (performance_rating !== undefined) {
            updateFields.push('performance_rating = ?');
            updateParams.push(performance_rating);
        }
        
        if (is_active !== undefined) {
            updateFields.push('is_active = ?');
            updateParams.push(is_active ? 1 : 0);
        }
        
        if (updateFields.length === 0) {
            return ResponseFormatter.error(res, 'No fields to update', 'Validation Error', 400);
        }
        
        updateFields.push('updated_date = CURRENT_TIMESTAMP');
        updateParams.push(id);
        
        const updateQuery = `UPDATE employees SET ${updateFields.join(', ')} WHERE id = ?`;
        const result = await dbManager.run(updateQuery, updateParams);
        
        if (result.changes === 0) {
            return ResponseFormatter.notFound(res, 'Employee not found');
        }
        
        ResponseFormatter.success(res, null, 'Employee updated successfully');
        
    } catch (error) {
        logger.error('Error updating employee:', error);
        ResponseFormatter.serverError(res, 'Failed to update employee');
    }
}));

// Delete employee (admin only) - Soft delete
router.delete('/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // Check if employee has active tasks
    const activeTasks = await dbManager.get(
        'SELECT COUNT(*) as count FROM employee_tasks WHERE employee_id = ? AND status != "completed"',
        [id]
    );
    
    if (activeTasks.count > 0) {
        return ResponseFormatter.error(
            res,
            'Cannot delete employee with active tasks',
            'Dependency Error',
            409
        );
    }
    
    const result = await dbManager.run('UPDATE employees SET is_active = 0 WHERE id = ?', [id]);
    
    if (result.changes === 0) {
        return ResponseFormatter.notFound(res, 'Employee not found');
    }
    
    ResponseFormatter.noContent(res, 'Employee deleted successfully');
}));

// Get employee tasks
router.get('/:id/tasks', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { 
        page = 1, 
        limit = 20, 
        status = '',
        platform = '',
        sort = 'created_date',
        order = 'DESC'
    } = req.query;

    try {
        const offset = (page - 1) * limit;
        
        // Build WHERE clause
        let whereClause = 'WHERE et.employee_id = ?';
        let params = [id];
        
        if (status) {
            whereClause += ' AND et.status = ?';
            params.push(status);
        }
        
        if (platform) {
            whereClause += ' AND et.platform = ?';
            params.push(platform);
        }
        
        // Validate sort parameters
        const validSortFields = ['created_date', 'priority', 'status', 'platform', 'estimated_hours'];
        const validOrder = ['ASC', 'DESC'];
        const sortField = validSortFields.includes(sort) ? sort : 'created_date';
        const sortOrder = validOrder.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';
        
        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM employee_tasks et
            ${whereClause}
        `;
        const countResult = await dbManager.get(countQuery, params);
        
        // Get tasks with pagination
        const tasksQuery = `
            SELECT 
                et.*,
                p.name as product_name, p.brand, p.model, p.color,
                COUNT(ta.id) as activity_count,
                SUM(ta.hours_worked) as total_hours_logged
            FROM employee_tasks et
            LEFT JOIN products p ON et.product_id = p.id
            LEFT JOIN task_activities ta ON et.id = ta.task_id
            ${whereClause}
            GROUP BY et.id
            ORDER BY et.${sortField} ${sortOrder}
            LIMIT ? OFFSET ?
        `;
        
        const tasks = await dbManager.all(tasksQuery, [...params, parseInt(limit), offset]);
        
        // Create pagination info
        const pagination = createPaginationInfo(page, limit, countResult.total);
        
        ResponseFormatter.paginated(res, tasks, pagination, 'Employee tasks retrieved successfully');
        
    } catch (error) {
        logger.error('Error fetching employee tasks:', error);
        ResponseFormatter.serverError(res, 'Failed to fetch employee tasks');
    }
}));

// Create employee task
router.post('/:id/tasks', authenticate, requireAdmin, validateEmployeeTask, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { 
        platform, product_id, product_url, color, priority = 'medium', 
        estimated_hours, description 
    } = req.body;
    
    try {
        // Verify employee exists
        const employee = await dbManager.get('SELECT * FROM employees WHERE id = ?', [id]);
        if (!employee) {
            return ResponseFormatter.notFound(res, 'Employee not found');
        }
        
        const result = await dbManager.run(
            `INSERT INTO employee_tasks (employee_id, platform, product_id, product_url, color, priority, estimated_hours, description)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, platform, product_id, product_url, color, priority, estimated_hours, description]
        );
        
        const newTask = await dbManager.get(
            'SELECT * FROM employee_tasks WHERE id = ?', 
            [result.lastID]
        );
        
        ResponseFormatter.created(res, newTask, 'Task created successfully');
        
    } catch (error) {
        logger.error('Error creating employee task:', error);
        ResponseFormatter.serverError(res, 'Failed to create employee task');
    }
}));

// Get all tasks with filtering
router.get('/tasks/all', asyncHandler(async (req, res) => {
    const { 
        page = 1, 
        limit = 20, 
        employee_id = '',
        status = '',
        platform = '',
        priority = '',
        sort = 'created_date',
        order = 'DESC'
    } = req.query;

    try {
        const offset = (page - 1) * limit;
        
        // Build WHERE clause
        let whereClause = 'WHERE 1=1';
        let params = [];
        
        if (employee_id) {
            whereClause += ' AND et.employee_id = ?';
            params.push(employee_id);
        }
        
        if (status) {
            whereClause += ' AND et.status = ?';
            params.push(status);
        }
        
        if (platform) {
            whereClause += ' AND et.platform = ?';
            params.push(platform);
        }
        
        if (priority) {
            whereClause += ' AND et.priority = ?';
            params.push(priority);
        }
        
        // Validate sort parameters
        const validSortFields = ['created_date', 'priority', 'status', 'platform', 'estimated_hours', 'employee_name'];
        const validOrder = ['ASC', 'DESC'];
        const sortField = validSortFields.includes(sort) ? sort : 'created_date';
        const sortOrder = validOrder.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';
        
        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM employee_tasks et
            ${whereClause}
        `;
        const countResult = await dbManager.get(countQuery, params);
        
        // Get tasks with pagination
        const tasksQuery = `
            SELECT 
                et.*,
                e.name as employee_name, e.email as employee_email,
                p.name as product_name, p.brand, p.model, p.color,
                COUNT(ta.id) as activity_count,
                SUM(ta.hours_worked) as total_hours_logged
            FROM employee_tasks et
            JOIN employees e ON et.employee_id = e.id
            LEFT JOIN products p ON et.product_id = p.id
            LEFT JOIN task_activities ta ON et.id = ta.task_id
            ${whereClause}
            GROUP BY et.id
            ORDER BY et.${sortField} ${sortOrder}
            LIMIT ? OFFSET ?
        `;
        
        const tasks = await dbManager.all(tasksQuery, [...params, parseInt(limit), offset]);
        
        // Create pagination info
        const pagination = createPaginationInfo(page, limit, countResult.total);
        
        ResponseFormatter.paginated(res, tasks, pagination, 'Tasks retrieved successfully');
        
    } catch (error) {
        logger.error('Error fetching tasks:', error);
        ResponseFormatter.serverError(res, 'Failed to fetch tasks');
    }
}));

// Get task by ID
router.get('/tasks/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const task = await dbManager.get(
        `SELECT 
            et.*,
            e.name as employee_name, e.email as employee_email,
            p.name as product_name, p.brand, p.model, p.color
         FROM employee_tasks et
         JOIN employees e ON et.employee_id = e.id
         LEFT JOIN products p ON et.product_id = p.id
         WHERE et.id = ?`, 
        [id]
    );
    
    if (!task) {
        return ResponseFormatter.notFound(res, 'Task not found');
    }
    
    // Get task activities
    const activities = await dbManager.all(`
        SELECT * FROM task_activities 
        WHERE task_id = ? 
        ORDER BY activity_date DESC
    `, [id]);
    
    ResponseFormatter.success(res, { ...task, activities }, 'Task retrieved successfully');
}));

// Update task
router.put('/tasks/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { 
        status, priority, estimated_hours, description, platform 
    } = req.body;
    
    try {
        // Build dynamic update query
        const updateFields = [];
        const updateParams = [];
        
        if (status !== undefined) {
            updateFields.push('status = ?');
            updateParams.push(status);
        }
        
        if (priority !== undefined) {
            updateFields.push('priority = ?');
            updateParams.push(priority);
        }
        
        if (estimated_hours !== undefined) {
            updateFields.push('estimated_hours = ?');
            updateParams.push(estimated_hours);
        }
        
        if (description !== undefined) {
            updateFields.push('description = ?');
            updateParams.push(description);
        }
        
        if (platform !== undefined) {
            updateFields.push('platform = ?');
            updateParams.push(platform);
        }
        
        if (updateFields.length === 0) {
            return ResponseFormatter.error(res, 'No fields to update', 'Validation Error', 400);
        }
        
        updateFields.push('updated_date = CURRENT_TIMESTAMP');
        updateParams.push(id);
        
        const updateQuery = `UPDATE employee_tasks SET ${updateFields.join(', ')} WHERE id = ?`;
        const result = await dbManager.run(updateQuery, updateParams);
        
        if (result.changes === 0) {
            return ResponseFormatter.notFound(res, 'Task not found');
        }
        
        ResponseFormatter.success(res, null, 'Task updated successfully');
        
    } catch (error) {
        logger.error('Error updating task:', error);
        ResponseFormatter.serverError(res, 'Failed to update task');
    }
}));

// Delete task
router.delete('/tasks/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    try {
        const result = await dbManager.transaction(async (db) => {
            // First delete related activities
            await db.run('DELETE FROM task_activities WHERE task_id = ?', [id]);
            
            // Then delete related listings
            await db.run('DELETE FROM platform_listings WHERE task_id = ?', [id]);
            
            // Finally delete the task
            const deleteResult = await db.run('DELETE FROM employee_tasks WHERE id = ?', [id]);
            
            return deleteResult.changes > 0;
        });
        
        if (!result) {
            return ResponseFormatter.notFound(res, 'Task not found');
        }
        
        ResponseFormatter.noContent(res, 'Task deleted successfully');
        
    } catch (error) {
        logger.error('Error deleting task:', error);
        ResponseFormatter.serverError(res, 'Failed to delete task');
    }
}));

// Log task activity
router.post('/tasks/:id/activities', authenticate, validateTaskActivity, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { employee_id, description, hours_worked, activity_date } = req.body;
    
    try {
        // Verify task exists
        const task = await dbManager.get('SELECT * FROM employee_tasks WHERE id = ?', [id]);
        if (!task) {
            return ResponseFormatter.notFound(res, 'Task not found');
        }
        
        const result = await dbManager.transaction(async (db) => {
            // Log the activity
            const activityResult = await db.run(
                `INSERT INTO task_activities (task_id, employee_id, description, hours_worked, activity_date)
                 VALUES (?, ?, ?, ?, ?)`,
                [id, employee_id, description, hours_worked, activity_date || new Date().toISOString()]
            );
            
            // Update task completed hours if hours worked is provided
            if (hours_worked && hours_worked > 0) {
                await db.run(
                    'UPDATE employee_tasks SET completed_hours = completed_hours + ? WHERE id = ?',
                    [hours_worked, id]
                );
            }
            
            return activityResult.lastID;
        });
        
        const newActivity = await dbManager.get(
            'SELECT * FROM task_activities WHERE id = ?', 
            [result]
        );
        
        ResponseFormatter.created(res, newActivity, 'Task activity logged successfully');
        
    } catch (error) {
        logger.error('Error logging task activity:', error);
        ResponseFormatter.serverError(res, 'Failed to log task activity');
    }
}));

// Get task activities
router.get('/tasks/:id/activities', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { 
        page = 1, 
        limit = 20, 
        sort = 'activity_date',
        order = 'DESC'
    } = req.query;

    try {
        const offset = (page - 1) * limit;
        
        // Validate sort parameters
        const validSortFields = ['activity_date', 'hours_worked', 'employee_name'];
        const validOrder = ['ASC', 'DESC'];
        const sortField = validSortFields.includes(sort) ? sort : 'activity_date';
        const sortOrder = validOrder.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';
        
        // Get total count
        const countResult = await dbManager.get(
            'SELECT COUNT(*) as total FROM task_activities WHERE task_id = ?', 
            [id]
        );
        
        // Get activities with pagination
        const activitiesQuery = `
            SELECT 
                ta.*,
                e.name as employee_name, e.email as employee_email
            FROM task_activities ta
            JOIN employees e ON ta.employee_id = e.id
            WHERE ta.task_id = ?
            ORDER BY ta.${sortField} ${sortOrder}
            LIMIT ? OFFSET ?
        `;
        
        const activities = await dbManager.all(activitiesQuery, [id, parseInt(limit), offset]);
        
        // Create pagination info
        const pagination = createPaginationInfo(page, limit, countResult.total);
        
        ResponseFormatter.paginated(res, activities, pagination, 'Task activities retrieved successfully');
        
    } catch (error) {
        logger.error('Error fetching task activities:', error);
        ResponseFormatter.serverError(res, 'Failed to fetch task activities');
    }
}));

// Delete task activity
router.delete('/activities/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    try {
        // Get activity details before deletion to update task hours
        const activity = await dbManager.get(
            'SELECT task_id, hours_worked FROM task_activities WHERE id = ?', 
            [id]
        );
        
        if (!activity) {
            return ResponseFormatter.notFound(res, 'Task activity not found');
        }
        
        const result = await dbManager.transaction(async (db) => {
            // Delete the activity
            const deleteResult = await db.run('DELETE FROM task_activities WHERE id = ?', [id]);
            
            // Update task completed hours
            if (activity.hours_worked && activity.hours_worked > 0) {
                await db.run(
                    'UPDATE employee_tasks SET completed_hours = completed_hours - ? WHERE id = ?',
                    [activity.hours_worked, activity.task_id]
                );
            }
            
            return deleteResult.changes > 0;
        });
        
        ResponseFormatter.noContent(res, 'Task activity deleted successfully');
        
    } catch (error) {
        logger.error('Error deleting task activity:', error);
        ResponseFormatter.serverError(res, 'Failed to delete task activity');
    }
}));

// Get employee performance report
router.get('/:id/performance', authenticate, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { period = '30d' } = req.query;
    
    try {
        let dateFilter = '';
        let params = [id];
        
        switch (period) {
            case '7d':
                dateFilter = "AND ta.activity_date >= date('now', '-7 days')";
                break;
            case '30d':
                dateFilter = "AND ta.activity_date >= date('now', '-30 days')";
                break;
            case '90d':
                dateFilter = "AND ta.activity_date >= date('now', '-90 days')";
                break;
            default:
                dateFilter = "AND ta.activity_date >= date('now', '-30 days')";
        }
        
        // Get employee performance metrics
        const performance = await dbManager.get(`
            SELECT 
                COUNT(DISTINCT et.id) as total_tasks,
                COUNT(DISTINCT CASE WHEN et.status = 'completed' THEN et.id END) as completed_tasks,
                SUM(ta.hours_worked) as total_hours_worked,
                AVG(ta.hours_worked) as avg_hours_per_activity,
                COUNT(DISTINCT et.platform) as platforms_worked_on
            FROM employees e
            LEFT JOIN employee_tasks et ON e.id = et.employee_id
            LEFT JOIN task_activities ta ON et.id = ta.task_id
            WHERE e.id = ? ${dateFilter}
        `, params);
        
        // Get task status breakdown
        const statusBreakdown = await dbManager.all(`
            SELECT 
                status,
                COUNT(*) as count,
                SUM(estimated_hours) as total_estimated_hours,
                SUM(completed_hours) as total_completed_hours
            FROM employee_tasks
            WHERE employee_id = ? ${dateFilter}
            GROUP BY status
        `, params);
        
        ResponseFormatter.success(res, {
            performance,
            status_breakdown: statusBreakdown,
            period
        }, 'Employee performance retrieved successfully');
        
    } catch (error) {
        logger.error('Error fetching employee performance:', error);
        ResponseFormatter.serverError(res, 'Failed to fetch employee performance');
    }
}));

module.exports = router;
