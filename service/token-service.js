const jwt = require('jsonwebtoken');
const tokenModel = require('../models/token-model');
const ApiError = require('../exeptions/api-error');
// const userModel = require('../models/user-model');
// const LogInDto = require('../dtos/logIn-dto');
require('dotenv').config();

class TokenService {
    generateTokens(payload) {
        const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {expiresIn: '30s'});
        
        const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {expiresIn: '30d'});

        return {accessToken, refreshToken};
    }

    async saveToken(userId, refreshToken) {
        const tokenData = await tokenModel.findOne({user: userId});

        if (tokenData) {
            tokenData.refreshToken = refreshToken;
            return tokenData.save();
        }

        const token = await tokenModel.create({user: userId, refreshToken});
        return token;
    }

    async removeToken(refreshToken) {
        const result = await tokenModel.deleteOne({refreshToken});
        return result;
    }

    async findToken(refreshToken) {
        return await tokenModel.findOne({refreshToken});
    }

    validateAccessToken(token){
        try {
            const userData = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
            return userData;
        } catch(e) {
            return null;
        }
    }

    validateRefreshToken(token){
        try{
            const userData = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
            return userData;
        } catch(e) {
            return null;
        }
    }

    async refresh(refreshToken){
        if(!refreshToken ){
            console.log('bad refresh token');
            throw ApiError.BadRequest ();
        }

        const tokenData = this.validateRefreshToken(refreshToken);
        const tokenFromDb = await this.findToken(refreshToken);

        if (!tokenData && !tokenFromDb) {
            console.log('token issue, unauthorized user');
            throw ApiError.UnauthorizedUser();
        } else {
            // const user = await userModel.findById(tokenFromDb.user)

            // const logInDto = new LogInDto(user);

            const tokens = this.generateTokens({id: tokenFromDb.user});
            await this.saveToken(tokenFromDb.user, tokens.refreshToken);
            return tokens
        }
    }
}

module.exports = new TokenService();