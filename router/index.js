const Router = require('express').Router;
const router = new Router();
const userController = require('../controllers/user-controller'); 
const authMiddleware = require('../middlewares/auth-middleware');

router.post('/sign-in', userController.signIn);
router.post('/sign-up', userController.signUp);
router.post('/new-collection', userController.newCollection);
router.post('/new-card', userController.newCard);

router.delete('/delete-collection/:id/:user', userController.deleteCollection);
router.delete('/delete-card/:cardId/:collectionId/:userId', userController.deleteCard);

router.get('/stock-collection-eng', userController.stockCollectionEng);
router.get('/choose-collection/:id/:user', authMiddleware, userController.chooseCollection);
router.get('/choose-stock-collection/:id/:user', userController.chooseCollection);
router.get('/activate/:link', userController.activate);
router.get('/refresh', userController.refresh);
router.get('/logout', userController.logout);

router.put('/repeat', userController.repeat);
router.put('/edit-collection', userController.editCollection);
router.put('/edit-card', userController.editCard);

module.exports = router;