module.exports = class ApiError extends Error {
    status;
    errors;

    constructor(status, message, errors = []) {
        super(message);
        this.status = status;
        this.errors = errors;
    }

    static BadRequest () {
        return new ApiError(403, 'Bad request')
    }

    static LoginOrPassNotMatch () {
        return new ApiError(400, 'Login or password does not match')
    }

    static NotActivated () {
        return new ApiError(401, 'Account not activated')
    }

    static UnauthorizedUser () {
        return new ApiError(401, 'Unauthorized user')
    }
}