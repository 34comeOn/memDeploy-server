module.exports = class LogInDto {
    _id;
    email;
    userName;
    subscription;
    currentCollection;
    userCollectionsData;
    activationLink;
    isActivated;

    constructor(model) {
        this._id = model._id;
        this.email = model.email;
        this.userName = model.userName;
        this.subscription = model.subscription;
        this.currentCollection = model.currentCollection;
        this.userCollectionsData = model.userCollectionsData;
        this.activationLink = model.activationLink;
        this.isActivated = model.isActivated;
    }
}
