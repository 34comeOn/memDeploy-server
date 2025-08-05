const {
    validateAllRequestData, 
    validateString,
    validateBoolean,
    validateNumber,
    validateIsArray,
    validateWithRegEx,
    applyPunishmentForCollection,
} = require('../server-modules/serverUtills'); 
const { 
    NAME_REGEX,
    SERVER_PASSWORD_REGEX, 
    TITLE_REGEX,
    TEXT_AREA_REGEX,
    STOCK_DATA_USER_ID,
} = require('../server-modules/serverConstants');
const User = require('../models/user-model');
const bcrypt = require('bcrypt'); 
const uuid = require('uuid');
const mailService = require('../service/mail-service');
const tokenService = require('../service/token-service');
const RegistrationDto = require('../dtos/registration-dto');
const LogInDto = require('../dtos/logIn-dto');
const ApiError = require('../exeptions/api-error');
require('dotenv').config();

class UserController {
    async logIn(req, res, next) {
        let {
            email,
            password,
        } = req.body;
    
        const validationSchema = [
            [email, validateString],
            [password, validateWithRegEx, SERVER_PASSWORD_REGEX],
        ]

        if (!validateAllRequestData(validationSchema)) {
            console.log('request has not passed validation')
            throw ApiError.BadRequest();
        } else {
            try {
                const userData = await User.where({email}).find();
                const isPassEquals = await bcrypt.compare(password, userData[0]?.password || '');

                if (userData[0] && isPassEquals) {
                    if (!userData[0].isActivated){
                        throw ApiError.NotActivated();
                    } else {
                        const logInDto = new LogInDto(userData[0]);

                        const tokens = tokenService.generateTokens({_id: logInDto._id});
                        await tokenService.saveToken(logInDto._id, tokens.refreshToken);
                        logInDto.currentToken = tokens.accessToken;
                        
                        res.cookie('refreshToken', tokens.refreshToken, {maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true});
                        
                        res.json(logInDto);
                    }
                } else {
                    throw ApiError.LoginOrPassNotMatch();
                }

            } catch (e) {
                next(e);
            }
        }
    } 
    async register(req, res, next) {
        const {
            email,
            password,
            userName,
            subscription,
            currentToken,
            currentCollection,
            userCollectionsData
        } = req.body;
        
        const validationSchema = [
            [email, validateString],
            [password, validateWithRegEx, SERVER_PASSWORD_REGEX],
            [userName, validateWithRegEx, NAME_REGEX],
            [subscription, validateString],
            [currentToken, validateString],
            [currentCollection, validateString],
            [userCollectionsData, validateIsArray],
        ];
        
        if (!validateAllRequestData(validationSchema)) {
            res.status(403).end();
            console.log('request has not passed validation')
        } else {
            try {
                const candidate = await User.findOne({email});

                if (candidate) {
                    console.log('user exists');
                    res.status(400).end();
                } else {
                    const hashedPassword = await bcrypt.hash(password, 3); 
                    const activationLink = await uuid.v4();

                    const user = await User.create({
                        email,
                        password: hashedPassword,
                        userName,
                        subscription,
                        activationLink,
                        currentCollection,
                        userCollectionsData
                    })

                    await mailService.sendActivationMail(email, `${process.env.API_URL}/api/activate/${activationLink}`);
                    
                    const userDto = new RegistrationDto(user); 
                    const tokens = tokenService.generateTokens({...userDto });
                    await tokenService.saveToken(userDto.id, tokens.refreshToken);

                    res.cookie('refreshToken', tokens.refreshToken, {maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true});
                    res.json(user.email)
                }
            } catch(e) {
                next(e);
            }
        }
    } 
    async logout(req, res, next) {
        try {
            const {refreshToken} = req.cookies;
            const token = await tokenService.removeToken(refreshToken);
            res.clearCookie('refreshToken');

            return token? res.status(200).end(): res.status(500).end();
        } catch (e) {
            next(e)
        }
    } 
    async newCollection(req, res, next) {
        try{
            let {
                id,
                newUserCollection
            } = req.body;
        
            const validationSchema = [
                [id, validateString],
                [newUserCollection.collectionColor, validateString],
                [newUserCollection.collectionTitle, validateWithRegEx, TITLE_REGEX],
            ];
            const {refreshToken} = req.cookies;
            console.log('req.cookies', refreshToken)
            if (!validateAllRequestData(validationSchema)) {
                res.status(403).end();
                console.log('request has not passed validation')
            } else {
                User.updateOne(
                    { _id: id },
                    { $push: { userCollectionsData: newUserCollection } }
                )
                .then(()=> {
                    User.findById(id)
                    .then(result=> res.send(result.userCollectionsData))
                    .catch(err=> console.log(err))
                })
            }  
        } catch (e) {
            next(e)
        }
    } 
    async newCard(req, res, next) {
        try {
            let {
                userId,
                collectionId,
                creatingNewCategory,
                newCard,
            } = req.body;
        
            const validationSchema = [
                [userId, validateString],
                [collectionId, validateString],
                [creatingNewCategory, validateBoolean], 
                [newCard.collectionItemTitle, validateWithRegEx, TITLE_REGEX],
                [newCard.collectionItemAnswer, validateWithRegEx, TEXT_AREA_REGEX],
                [newCard.collectionItemRepeatedTimeStamp, validateNumber],
                [newCard.collectionItemTimesBeenRepeated, validateNumber],
                [newCard.collectionItemCategory, validateString],
                [newCard.collectionItemColor, validateString],
                [newCard.collectionItemTags, validateString], // for now string, but might be 'object' in future
            ]
        
            if (!validateAllRequestData(validationSchema)) {
                res.status(400).end();
                console.log('request has not passed validation')
            } else {
                let newCollectionCategoryTitle= newCard.collectionItemCategory;
                let newCollectionCategoryColor= newCard.collectionItemColor;
            
                if (newCollectionCategoryTitle && creatingNewCategory) {
                    User.updateOne(
                        {_id: userId, 'userCollectionsData._id': collectionId},
                        {$push: {
                            'userCollectionsData.$.collectionСategories':
                            {
                                label: newCollectionCategoryTitle,
                                value: newCollectionCategoryTitle,
                                collectionCategoryColor: newCollectionCategoryColor,
                            }
                        }}
                    )
                    .catch(err=> console.log(err))
                }
            
                User.updateOne(
                    {_id: userId, 'userCollectionsData._id': collectionId},
                    {$push: {
                        'userCollectionsData.$.collectionData':newCard
                    }}
                )
                .then(()=> {
                    User.findById(userId)
                    .then(result=> res.send(result.userCollectionsData.find(collection => collection._id.toString() === collectionId)))
                })
                .catch(err=> console.log(err))
        
            }
        } catch (e) {
            next(e)
        }
    } 
    async deleteCollection(req, res, next) {
        try {
            let collectionId = req.params.id.slice(1);
            let userId = req.params.user.slice(1);
        
            const validationSchema = [
                [collectionId, validateString],
                [userId, validateString],
            ];
            
            if (!validateAllRequestData(validationSchema)) {
                res.status(403).end();
                console.log('request has not passed validation')
            } else {
                User.updateOne(
                    { _id: userId },
                    { $pull: { userCollectionsData: { _id: collectionId }  } }
                )
                .then(()=> {
                    User.findById(userId)
                    .then(result=> res.send(result.userCollectionsData))
                })
                .catch(err=> console.log(err))
            }
        } catch (e) {
            next(e)
        }
    } 
    async deleteCard(req, res, next) {
        try {
            let cardId = req.params.cardId.slice(1);
            let collectionId = req.params.collectionId.slice(1);
            let userId = req.params.userId.slice(1);
        
            const validationSchema = [
                [cardId, validateString],
                [collectionId, validateString],
                [userId, validateString],
            ];
            
            if (!validateAllRequestData(validationSchema)) {
                res.status(403).end();
                console.log('request has not passed validation')
            } else {
                User.updateOne(
                    { _id: userId,
                        'userCollectionsData': {
                            '$elemMatch': {
                            '_id': collectionId,
                            "collectionData._id": cardId
                            }
                        }
                    },
                    {$pull: 
                        { 
                            'userCollectionsData.$[i].collectionData': { _id: cardId },
                        }
                    },
                    {
                        arrayFilters: [
                            {
                            'i._id': collectionId,
                            },
                        ],
                    },
                )
                .then(()=> {
                    User.findById(userId)
                    .then(result=> res.send(result.userCollectionsData.find(collection => collection._id.toString() === collectionId)))
                })
                .catch(err => console.log(err))
            }  
        } catch (e) {
            next(e)
        }
    } 
    async stockCollectionEng(req, res, next) {
        User.findById(STOCK_DATA_USER_ID)
        .then(result=> res.append('Cache-Control', 'private, max-age=15000').send(result.userCollectionsData))
        .catch(err=> console.log(err))
    } 
    async chooseCollection(req, res, next) {
        try {
            let collectionId = req.params.id.slice(1);
            let currentUserId = req.params.user.slice(1);
        
            const validationSchema = [
                [collectionId, validateString],
                [currentUserId, validateString],
            ];
        
            if (!validateAllRequestData(validationSchema)) {
                res.status(400).end();
                console.log('request has not passed validation')
            } else {
                User.findById(currentUserId)
                .then(allUserData=> {
                    const collectionBeforePunishingForLatePractice = allUserData.userCollectionsData.find(collection => collection._id.toString() === collectionId);
                    
                    User.updateOne(
                        {_id: currentUserId, 
                            'userCollectionsData': {
                                '$elemMatch': {
                                    '_id': collectionId,
                                }
                            }
                        },
                        {$set: 
                            { 
                                'userCollectionsData.$[i].collectionData': applyPunishmentForCollection(collectionBeforePunishingForLatePractice),
                            }
                        },
                        {
                            arrayFilters: [
                                {
                                'i._id': collectionId,
                                },
                            ],
                        },
                    )
                    .then(()=> {
                        User.findById(currentUserId)
                        .then(result=> res.send(result.userCollectionsData.find(collection => collection._id.toString() === collectionId)))
                    })
                    .catch(err => console.log(err))
                })
                .catch(err=> console.log(err))
            } 
        } catch (e) {
            next(e)
        }
    } 
    async chooseSharedCollection(req, res, next) {
        try {
            const { shareLink, currentUserId } = req.params;
    
            if (!validateString(shareLink) || (currentUserId && !validateString(currentUserId))) {
                console.log('request has not passed validation');
                return res.status(400).end();
            }
    
            const shareLinkRegex = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_([0-9a-f]{24})_([0-9a-f]{24})$/i;
            const match = shareLink.match(shareLinkRegex);
    
            if (!match) {
                console.log('Invalid shareLink format');
                return res.status(400).end();
            }
    
            const [, , validUserId, validCollectionId] = match;
    
            const originalUser = await User.findOne(
                {
                    _id: validUserId,
                    userCollectionsData: {
                        $elemMatch: {
                            _id: validCollectionId,
                            collectionShareLink: shareLink,
                        },
                    },
                },
                { 'userCollectionsData.$': 1 }
            );
    
            if (!originalUser || !originalUser.userCollectionsData.length) {
                return res.status(404).send('Collection with this shareLink not found');
            }
    
            const ownerCollection = originalUser.userCollectionsData[0];
    
            const virginOwnerCollectionData = ownerCollection.collectionData.map(item => ({
                _id: item._id,
                collectionItemTitle: item.collectionItemTitle,
                collectionItemAnswer: item.collectionItemAnswer,
                collectionItemCategory: item.collectionItemCategory,
                collectionItemColor: item.collectionItemColor,
                collectionItemTags: item.collectionItemTags,
                collectionItemComments: item.collectionItemComments,
                collectionItemInvincibleCount: 0,
                collectionItemPenaltyCount: 0,
                collectionItemRepeatedTimeStamp: Date.now(),
                collectionItemTimesBeenRepeated: 0,
            }));
    
            ownerCollection.collectionData = virginOwnerCollectionData;
    

            if (!currentUserId) {
                const collectionForGuestUser = {...ownerCollection, collectionData: virginOwnerCollectionData};
                return res.send(collectionForGuestUser);
            }

            const currentUser = await User.findOne(
                {
                    _id: currentUserId,
                    userCollectionsData: {
                        $elemMatch: {
                            _id: validCollectionId,
                            collectionShareLink: shareLink,
                        },
                    },
                },
                { 'userCollectionsData.$': 1 }
            );

            if (!currentUser || !currentUser.userCollectionsData.length) {
                const freshSharedcollection = {...ownerCollection, collectionData: virginOwnerCollectionData};
                res.send(freshSharedcollection);
            } else {
                const currentUserPartOfCollectionData = currentUser.userCollectionsData;

                const currentUserPartOfCollectionDataWithPunishment = applyPunishmentForCollection(currentUserPartOfCollectionData[0]);

                try {
                    const updateResult = await User.updateOne(
                        {_id: currentUserId, 
                            'userCollectionsData': {
                                '$elemMatch': {
                                    '_id': validCollectionId,
                                }
                            }
                        },
                        {$set: 
                            { 
                                'userCollectionsData.$[i].collectionData': currentUserPartOfCollectionDataWithPunishment,
                            }
                        },
                        {
                            arrayFilters: [
                                {
                                'i._id': validCollectionId,
                                },
                            ],
                        },
                    )
    
                    if (updateResult) {
                        virginOwnerCollectionData.forEach((virginOwnerItem) => {
                            const currentUserItem = currentUserPartOfCollectionDataWithPunishment.find(currentUserItem => JSON.stringify(currentUserItem._id) === JSON.stringify(virginOwnerItem._id));

                            if (currentUserItem) {
                                return ({
                                    ...virginOwnerItem,
                                    collectionItemInvincibleCount: currentUserItem.collectionItemInvincibleCount || 0,
                                    collectionItemPenaltyCount: currentUserItem.collectionItemPenaltyCount || 0,
                                    collectionItemRepeatedTimeStamp: currentUserItem.collectionItemRepeatedTimeStamp || Date.now(),
                                    collectionItemTimesBeenRepeated: currentUserItem.collectionItemTimesBeenRepeated || 0,
                                })
                            }

                            return virginOwnerItem;
                        })

                        const oldSharedcollection = {...ownerCollection, collectionData: virginOwnerCollectionData};
                        res.send(oldSharedcollection);
                    } else {
                        res.send(ownerCollection);
                    }
                } catch (e) {
                    console.log(e);
                    res.status(500).send('Internal Server Error');
                }
            }
        } catch (error) {
            next(error);
        }
    }
    async activate(req, res, next) {
        try {
            let link = req.params.link;

            const validationSchema = [
                [link, validateString],
            ]

            if (!validateAllRequestData(validationSchema)) {
                res.status(400).end();
                console.log('request has not passed validation')
            } else {
                const user = await User.findOne({activationLink: link});
               
                if (!user) {
                    throw new Error('Bad activation link');
                }
    
                user.isActivated = true;
                await user.save();
    
                res.redirect(process.env.CLIENT_SIGN_URL);
            }

        } catch (e) {
            console.log(e);
            next(e);
        }
    } 
    async repeat(req, res, next) {
        try {
            let {
                userId, 
                cardId, 
                collectionId,
                collectionItemTimesBeenRepeated,
                collectionItemRepeatedTimeStamp,
                collectionItemPenaltyCount,
                collectionItemInvincibleCount,
            } =req.body;
        
            const validationSchema = [
                [userId, validateString],
                [cardId, validateString],
                [collectionId, validateString],
                [collectionItemTimesBeenRepeated, validateNumber],
                [collectionItemRepeatedTimeStamp, validateNumber],
                [collectionItemPenaltyCount, validateNumber],
                [collectionItemInvincibleCount, validateNumber],
            ]
        
            if (!validateAllRequestData(validationSchema)) {
                res.status(400).end();
                console.log('request has not passed validation')
            } else {
                User.updateOne(
                    {_id: userId, 
                        'userCollectionsData': {
                            '$elemMatch': {
                            '_id': collectionId,
                            "collectionData._id": cardId
                            }
                        }
                    },
                    {$set: 
                        { 
                            'userCollectionsData.$[i].collectionData.$[k].collectionItemTimesBeenRepeated': collectionItemTimesBeenRepeated,
                            'userCollectionsData.$[i].collectionData.$[k].collectionItemRepeatedTimeStamp': collectionItemRepeatedTimeStamp,
                            'userCollectionsData.$[i].collectionData.$[k].collectionItemPenaltyCount': collectionItemPenaltyCount,
                            'userCollectionsData.$[i].collectionData.$[k].collectionItemInvincibleCount': collectionItemInvincibleCount,
                        }
                    },
                    {
                        arrayFilters: [
                            {
                            'i._id': collectionId,
                            },
                            {
                            'k._id': cardId,
                            },
                        ],
                    },
                )
                .then(()=> {
                    User.findById(userId)
                    .then(result=> res.send(result.userCollectionsData.find(collection => collection._id.toString() === collectionId)))
                })
                .catch(err => console.log(err))
            }
        } catch (e) {
            next(e)
        }
    } 
    async editCollection(req, res, next) {
        try {
            let {
                userId, 
                collectionId,
                collectionColor,
                collectionTitle,
            } =req.body;
        
            const validationSchema = [
                [userId, validateString],
                [collectionId, validateString],
                [collectionColor, validateString],
                [collectionTitle, validateWithRegEx, TITLE_REGEX],
            ]
        
            if (!validateAllRequestData(validationSchema)) {
                res.status(400).end();
                console.log('request has not passed validation')
            } else {
                User.updateOne(
                    {_id: userId, 
                        'userCollectionsData': {
                            '$elemMatch': {
                            '_id': collectionId,
                            }
                        }
                    },
                    {$set: 
                        { 
                            'userCollectionsData.$[i].collectionColor': collectionColor,
                            'userCollectionsData.$[i].collectionTitle': collectionTitle,
                        }
                    },
                    {
                        arrayFilters: [
                            {
                            'i._id': collectionId,
                            },
                        ],
                    },
                )
                .then(()=> {
                    User.findById(userId)
                    .then(result=> res.send(result.userCollectionsData))
                })
                .catch(err => console.log(err))
            }  
        } catch (e) {
            next(e)
        }
    }
    async applyShareLink(req, res, next) {
        try {
            let userId = req.params.userId;
            let collectionId = req.params.collectionId;
            let shareLink = req.params.shareLink;
            let currentUserId = req.params.currentUserId;

            const validationSchema = [
                [userId, validateString],
                [collectionId, validateString],
                [shareLink, validateString],
            ];

            if (currentUserId) {
                validationSchema.push([currentUserId, validateString])
            }

            if (!validateAllRequestData(validationSchema)) {
                res.status(400).end();
                console.log('request has not passed validation');
            } else {
                const ownerCollection = await User.findOne(
                    {
                        _id: userId,
                        userCollectionsData: {
                            $elemMatch: {
                                _id: collectionId,
                                collectionShareLink: shareLink,
                            }
                        }
                    },
                    {
                        'userCollectionsData.$': 1
                    }
                )

                if (!currentUserId) {
                    if (!ownerCollection || !ownerCollection.userCollectionsData.length) {
                        return res.status(404).send('Collection with this shareLink not found');
                    }
                    res.append('Cache-Control', 'private, max-age=15000').send(ownerCollection.userCollectionsData[0]);
                } else {
                    try {
                        const currentUserAlreadyHasThisCollection = await User.findOne(
                            {
                                _id: currentUserId,
                                userCollectionsData: {
                                    $elemMatch: {
                                        _id: collectionId,
                                        collectionShareLink: shareLink,
                                    }
                                }
                            },
                            {
                                'userCollectionsData.$': 1
                            }
                        )

                        if (currentUserAlreadyHasThisCollection) {
                            res.status(404).send('Collection already been shared');
                        } else {
                            const currentUserVirginCollectionData = ownerCollection.userCollectionsData[0].collectionData.map(item => ({
                                _id: item._id.toString(),
                                collectionItemTitle: item.collectionItemTitle,
                                collectionItemAnswer: item.collectionItemAnswer,
                                collectionItemCategory: item.collectionItemCategory,
                                collectionItemColor: item.collectionItemColor,
                                collectionItemTags: item.collectionItemTags,
                                collectionItemComments: item.collectionItemComments,
                                collectionItemInvincibleCount: 0,
                                collectionItemPenaltyCount: 0,
                                collectionItemRepeatedTimeStamp: Date.now(),
                                collectionItemTimesBeenRepeated: 0,
                            }));

                            const currentUserNewSharedCollection = {
                                _id: ownerCollection.userCollectionsData[0]._id || '',
                                collectionColor: ownerCollection.userCollectionsData[0].collectionColor || '',
                                collectionImage: ownerCollection.userCollectionsData[0].collectionImage || '',
                                collectionTitle: ownerCollection.userCollectionsData[0].collectionTitle || '',
                                collectionShareLink: ownerCollection.userCollectionsData[0].collectionShareLink || [],
                                collectionAdminList: ownerCollection.userCollectionsData[0].collectionAdminList || [],
                                collectionСategories: ownerCollection.userCollectionsData[0].collectionСategories || [],
                                collectionTags: ownerCollection.userCollectionsData[0].collectionTags || [],
                                collectionData: currentUserVirginCollectionData || [],
                            }

                            const result = await User.updateOne(
                                { _id: currentUserId },
                                { $push: { userCollectionsData: currentUserNewSharedCollection } }
                            )

                            res.send(currentUserNewSharedCollection);
                        }
                    } catch (e) {
                        console.error(e);
                        res.status(500).send('Internal server error');
                    }
                }
            }
        } catch (e) {
            next(e)
        }
    }
    async createShareLink(req, res, next) {
        try {
            let {
                userId,
                collectionId,
            } = req.body;

            const validationSchema = [
                [userId, validateString],
                [collectionId, validateString],
            ];
        
            if (!validateAllRequestData(validationSchema)) {
                res.status(400).end();
                console.log('request has not passed validation');
            } else {
                const uniqueValue = uuid.v4();

                const shareLink = `${uniqueValue}_${userId}_${collectionId}`;

                User.updateOne(
                    {_id: userId, 
                        'userCollectionsData': {
                            '$elemMatch': {
                            '_id': collectionId,
                            }
                        }
                    },
                    {$set: 
                        { 
                            'userCollectionsData.$[i].collectionShareLink': shareLink,
                        }
                    },
                    {
                        arrayFilters: [
                            {
                            'i._id': collectionId,
                            },
                        ],
                    },
                )
                .then(() => {
                    return User.findOne(
                        { _id: userId, 'userCollectionsData._id': collectionId },
                        { 'userCollectionsData.$': 1 }
                    );
                })
                .then(result => {
                    if (!result) return res.status(403).send('User or collection not found');
                    res.send(result.userCollectionsData[0].collectionShareLink);
                })
                .catch(err => console.log(err))
            }
        } catch (e) {
            res.status(500).send('Internal server error');
            next(e)
        }
    }
    async deleteShareLink(req, res, next) {
        try {
            let {
                userId,
                collectionId,
            } = req.body;
console.log('delete')
            const validationSchema = [
                [userId, validateString],
                [collectionId, validateString],
            ];
        
            if (!validateAllRequestData(validationSchema)) {
                res.status(400).end();
                console.log('request has not passed validation');
            } else {
                User.updateOne(
                    { _id: userId, "userCollectionsData._id": collectionId },
                    { $unset: { "userCollectionsData.$.collectionShareLink": "" } }
                  )
                .then(result => {
                    console.error(result);
                    if (!result.modifiedCount) return res.status(403).send('Share Link was not deleted');
                    res.status(200).end();
                })
                .catch(err => {
                    console.error(err);
                    res.status(500).send('Internal server error');
                });
            }
        } catch (e) {
            next(e)
        }
    }
    async editCard(req, res, next) {
        try {
            let {
                userId,
                collectionId,
                cardId,
                creatingNewCategory,
                editedCard,
            } = req.body;
        
            const validationSchema = [
                [userId, validateString],
                [collectionId, validateString],
                [cardId, validateString],
                [creatingNewCategory, validateBoolean],
                [editedCard.collectionItemCategory, validateString],
                [editedCard.collectionItemColor, validateString],
            ]
        
            if (!validateAllRequestData(validationSchema)) {
                res.status(400).end();
                console.log('request has not passed validation')
            } else {
                let newCollectionCategoryTitle= editedCard.collectionItemCategory;
                let newCollectionCategoryColor= editedCard.collectionItemColor;
            
                if (newCollectionCategoryTitle && creatingNewCategory) {
                    User.updateOne(
                        {_id: userId, 'userCollectionsData._id': collectionId},
                        {$push: {
                            'userCollectionsData.$.collectionСategories':
                            {
                                label: newCollectionCategoryTitle,
                                value: newCollectionCategoryTitle,
                                collectionCategoryColor: newCollectionCategoryColor,
                            }
                        }}
                    )
                    .catch(err=> console.log(err))
                }
                
                User.updateOne(
                    {_id: userId, 
                        'userCollectionsData': {
                            '$elemMatch': {
                              '_id': collectionId,
                              "collectionData._id": cardId
                            }
                        }
                    },
                    {$set: 
                        { 
                            'userCollectionsData.$[i].collectionData.$[k].collectionItemTitle': editedCard.collectionItemTitle,
                            'userCollectionsData.$[i].collectionData.$[k].collectionItemAnswer': editedCard.collectionItemAnswer,
                            'userCollectionsData.$[i].collectionData.$[k].collectionItemCategory': editedCard.collectionItemCategory,
                            'userCollectionsData.$[i].collectionData.$[k].collectionItemColor': editedCard.collectionItemColor,
                        }
                    },
                    {
                        arrayFilters: [
                            {
                              'i._id': collectionId,
                            },
                            {
                              'k._id': cardId,
                            },
                        ],
                    },
                )
                .then(()=> {
                    User.findById(userId)
                    .then(result=> res.send(result.userCollectionsData.find(collection => collection._id.toString() === collectionId)))
                })
                .catch(err => console.log(err))
            }
        } catch (e) {
            next(e)
        }
    } 
    async refresh(req, res, next) {
        try {
            const {refreshToken} = req.cookies;

            const tokens = await tokenService.refresh(refreshToken);
            res.cookie('refreshToken', tokens.refreshToken, {maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true});
    
            res.json(tokens.accessToken);
        } catch (e) {
            next(e)
        }
    } 
}

module.exports = new UserController();
