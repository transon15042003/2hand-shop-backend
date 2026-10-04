import { settingRepository } from '../repositories/setting.repository.js';

export class SettingService {
  async getPublicSettings() {
    const s = await settingRepository.getSettings();
    return {
      deposit_amount: s.depositAmount,
      return_fee: s.returnFee,
      return_window_days: s.returnWindowDays,
      order_hold_minutes: s.orderHoldMinutes,
      policy_version: s.policyVersion,
      shop_phone: s.shopPhone,
      shop_zalo: s.shopZalo,
      shop_messenger_url: s.shopMessengerUrl ?? '',
      bank_name: s.bankName,
      bank_account_number: s.bankAccountNumber,
      bank_account_holder: s.bankAccountHolder,
      bank_qr_image_url: s.bankQrImageUrl ?? '',
      shipping_fee_presets: s.shippingFeePresets,
      default_shipping_fee: s.defaultShippingFee,
      freeship_min_items: s.freeshipMinItems,
    };
  }

  async getAllSettings() {
    return await settingRepository.getSettings();
  }

  async updateSettings(data: any) {
    return await settingRepository.updateSettings(data);
  }
}

export const settingService = new SettingService();
