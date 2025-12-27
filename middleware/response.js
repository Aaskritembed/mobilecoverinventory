/**
 * Standardized Response Middleware
 * Provides consistent API response formatting across all endpoints
 */

class ResponseFormatter {
    /**
     * Send success response
     * @param {object} res - Express response object
     * @param {any} data - Response data
     * @param {string} message - Success message
     * @param {number} statusCode - HTTP status code (default: 200)
     */
    static success(res, data = null, message = 'Success', statusCode = 200) {
        return res.status(statusCode).json({
            success: true,
            message,
            data,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Send error response
     * @param {object} res - Express response object
     * @param {string} message - Error message
     * @param {string} error - Error details
     * @param {number} statusCode - HTTP status code (default: 400)
     * @param {array} details - Additional error details
     */
    static error(res, message = 'Error', error = null, statusCode = 400, details = null) {
        const errorResponse = {
            success: false,
            message,
            timestamp: new Date().toISOString()
        };

        if (error) {
            errorResponse.error = error;
        }

        if (details) {
            errorResponse.details = details;
        }

        return res.status(statusCode).json(errorResponse);
    }

    /**
     * Send validation error response
     * @param {object} res - Express response object
     * @param {array} validationErrors - Array of validation error details
     */
    static validationError(res, validationErrors) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            timestamp: new Date().toISOString(),
            details: validationErrors
        });
    }

    /**
     * Send pagination response
     * @param {object} res - Express response object
     * @param {array} data - Array of items
     * @param {object} pagination - Pagination information
     * @param {string} message - Success message
     */
    static paginated(res, data, pagination, message = 'Data retrieved successfully') {
        return res.status(200).json({
            success: true,
            message,
            data,
            pagination,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Send created response (201)
     * @param {object} res - Express response object
     * @param {any} data - Created resource data
     * @param {string} message - Success message
     */
    static created(res, data, message = 'Resource created successfully') {
        return res.status(201).json({
            success: true,
            message,
            data,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Send no content response (204)
     * @param {object} res - Express response object
     * @param {string} message - Success message
     */
    static noContent(res, message = 'Resource deleted successfully') {
        return res.status(204).json({
            success: true,
            message,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Send unauthorized response (401)
     * @param {object} res - Express response object
     * @param {string} message - Error message
     */
    static unauthorized(res, message = 'Authentication required') {
        return ResponseFormatter.error(res, message, 'Unauthorized', 401);
    }

    /**
     * Send forbidden response (403)
     * @param {object} res - Express response object
     * @param {string} message - Error message
     */
    static forbidden(res, message = 'Access forbidden') {
        return ResponseFormatter.error(res, message, 'Forbidden', 403);
    }

    /**
     * Send not found response (404)
     * @param {object} res - Express response object
     * @param {string} message - Error message
     */
    static notFound(res, message = 'Resource not found') {
        return ResponseFormatter.error(res, message, 'Not Found', 404);
    }

    /**
     * Send conflict response (409)
     * @param {object} res - Express response object
     * @param {string} message - Error message
     */
    static conflict(res, message = 'Resource conflict') {
        return ResponseFormatter.error(res, message, 'Conflict', 409);
    }

    /**
     * Send server error response (500)
     * @param {object} res - Express response object
     * @param {string} message - Error message
     * @param {boolean} includeStack - Include stack trace in development
     */
    static serverError(res, message = 'Internal server error', includeStack = false) {
        const errorResponse = {
            success: false,
            message,
            timestamp: new Date().toISOString()
        };

        if (includeStack && process.env.NODE_ENV === 'development') {
            errorResponse.stack = new Error().stack;
        }

        return res.status(500).json(errorResponse);
    }
}

/**
 * Wrapper for async route handlers to catch errors
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Create pagination info object
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @param {number} total - Total number of items
 */
const createPaginationInfo = (page, limit, total) => {
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
        hasNext,
        hasPrev,
        nextPage: hasNext ? page + 1 : null,
        prevPage: hasPrev ? page - 1 : null
    };
};

module.exports = {
    ResponseFormatter,
    asyncHandler,
    createPaginationInfo
};
