import { Request, Response, NextFunction } from 'express';
import { settingService } from '../services/setting.service.js';
import { HttpStatus } from '../constants/http-status.js';

export class SettingController {
  async getPublicSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await settingService.getPublicSettings();
      return res.status(HttpStatus.OK).json(settings);
    } catch (error) {
      next(error);
    }
  }
}

export const settingController = new SettingController();
