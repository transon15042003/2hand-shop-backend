import { Router } from 'express';
import { settingController } from '../controllers/setting.controller.js';

const router = Router();

router.get('/', settingController.getPublicSettings);

export default router;
