const {Schema, model} = require('mongoose');

const CollectionItemCommentsSchema = new Schema({
    collectionItemCommentText: {
        type: String,
    },
    collectionItemCommentImage: {
        type: String,
    },
    collectionItemCommentPosition: {
        type: Number,
    },
}); 

const CollectionСategoriesSchema = new Schema({
    label: {
        type: String,
        required: true
    },
    value: {
        type: String,
        required: true
    },
    collectionCategoryColor: {
        type: String,
        required: true
    },
});

const CollectionTagsSchema = new Schema({
    label: {
        type: String,
        required: true
    },
    value: {
        type: String,
        required: true
    },
});

const CollectionDataSchema = new Schema({
    collectionItemTitle: {
        type: String,
        required: true
    },
    collectionItemAnswer: {
        type: String,
        required: true
    },
    collectionItemRepeatedTimeStamp: {
        type: Number,
        required: true
    },
    collectionItemTimesBeenRepeated: {
        type: Number,
        required: true
    },
    collectionItemPenaltyCount: {
        type: Number,
        required: true
    },
    collectionItemInvincibleCount: {
        type: Number,
        required: true
    },
    collectionItemCategory: {
        type: String,
    },
    collectionItemColor: {
        type: String,
    },
    collectionItemPriority: {
        type: Number,
    },
    collectionItemTags: {
        type: [String],
    },
    collectionItemComments: {
        type: [CollectionItemCommentsSchema]
    },
});

const UserCollectionsDataSchema = new Schema({
    collectionColor: {
        type: String,
        required: true
    },
    collectionImage: {
        type: String,
        required: true
    },
    collectionTitle: {
        type: String,
        required: true
    },
    collectionAdminList: {
        type: [String],
        required: true
    },
    collectionСategories: {
        type: [CollectionСategoriesSchema],
    },
    collectionTags: {
        type: [CollectionTagsSchema],
    },
    collectionData: {
        type: [CollectionDataSchema],
        required: true
    },
});

const UserSchema = new Schema({
    email: {
        type: String,
        unique: true,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    userName: {
        type: String,
        required: true
    },
    subscription: {
        type: String,
        required: true
    },
    isActivated: {
        type: Boolean,
        default: false
    },
    activationLink: {
        type: String,
    }, 
    currentToken: {
        type: String,
    },
    currentCollection: {
        type: String,
        required: true
    },
    userCollectionsData: {
        type: [UserCollectionsDataSchema],
        required: true
    },
});

module.exports = model('User', UserSchema);