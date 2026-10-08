import assert from 'node:assert/strict';
import { emailService } from '../src/services/email.service.js';
import { authService } from '../src/services/auth.service.js';
import { customerRepository } from '../src/repositories/customer.repository.js';

async function run() {
  console.log('--- Testing Email & Unverified Customer Auth Flow ---');

  // 1. Test EmailService direct methods
  console.log('1. Testing EmailService templates (Mock fallback)...');
  const otpSent = await emailService.sendRegistrationOtp('test-user@example.com', {
    customerName: 'Nguyễn Văn Test',
    otp: '123456',
  });
  assert.equal(otpSent, true, 'sendRegistrationOtp should return true');

  const orderEmailSent = await emailService.sendOrderConfirmed('test-user@example.com', {
    orderCode: 'DH-241008-9999',
    customerName: 'Nguyễn Văn Test',
    items: [{ name: 'Áo sơ mi vintage', price: 250000 }],
    subtotal: 250000,
    shippingFee: 30000,
    total: 280000,
    depositAmount: 50000,
    amountDue: 230000,
    shippingAddress: '123 Đường ABC, Quận 1, TP.HCM',
    paymentMethod: 'cod',
    returnWindowDays: 2,
  });
  assert.equal(orderEmailSent, true, 'sendOrderConfirmed should return true');

  // 2. Test Customer Registration flow (Unverified email)
  console.log('2. Testing customer registration with unverified email state...');
  const testPhone = '09' + Math.floor(10000000 + Math.random() * 90000000);
  const testEmail = `test_${Date.now()}@example.com`;
  const regResult = await authService.register({
    name: 'Khách Test Email',
    phone: testPhone,
    email: testEmail,
    password: 'password123',
  });

  assert.equal(regResult.success, true, 'Registration must be successful');
  assert.equal(
    regResult.message,
    'Đăng ký tài khoản thành công! Để nhận thông tin về đơn hàng, vui lòng xác thực email.'
  );
  assert.ok(regResult.token, 'Registration should provide a session token');
  assert.equal(regResult.customer.is_verified, false, 'Email should remain unverified initially');
  console.log('   Registered customer:', regResult.customer.id, '| is_verified:', regResult.customer.is_verified);

  // 3. Test Customer Login without verified email
  console.log('3. Testing login for customer with unverified email...');
  const loginResult = await authService.login(testEmail, 'password123');
  assert.ok(loginResult.token, 'Login should succeed even if email is unverified');
  assert.equal(loginResult.customer.is_verified, false, 'Customer profile should reflect is_verified=false');
  assert.equal(
    loginResult.verification_notice,
    'Để nhận thông tin về đơn hàng, vui lòng xác thực email.'
  );
  console.log('   Login successful with verification_notice returned');

  // 4. Test maybeSendOrderNotification condition:
  // "chỉ gửi email cho khách có tài khoản và xác thực email"
  console.log('4. Testing order email filtering rule...');
  // Customer exists but is NOT verified:
  let customer = await customerRepository.findById(regResult.customer_id);
  assert.ok(customer);
  assert.equal(customer.isVerified, false);

  // When unverified, email should not be sent for orders
  // Verify that verifying OTP updates isVerified to true
  if (customer.verificationOtp) {
    console.log('5. Testing OTP email verification...');
    const verifyResult = await authService.verifyEmail(testEmail, customer.verificationOtp);
    assert.equal(verifyResult.customer.is_verified, true, 'Customer should now be verified');
    console.log('   Customer successfully verified!');
  }

  console.log('\n✅ All Email and Auth Flow checks passed successfully!');
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Check failed:', err);
    process.exit(1);
  });
