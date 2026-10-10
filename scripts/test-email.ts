import { emailService } from '../src/services/email.service.js';
import { appConfig } from '../src/configs/app.config.js';
import nodemailer from 'nodemailer';

async function main() {
  console.log('=== EMAIL DIAGNOSTIC TOOL ===');
  console.log('Environment:', appConfig.nodeEnv);
  console.log('EMAIL_FROM:', appConfig.emailFrom || '(not set)');
  console.log('RESEND_API_KEY configured:', Boolean(appConfig.resendApiKey));
  console.log('SMTP_USER configured:', Boolean(appConfig.smtpUser));
  console.log('-----------------------------');

  // 1. Check Resend (Primary)
  if (appConfig.resendApiKey) {
    console.log('\n[1/2] Testing Resend API key (Primary)...');
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${appConfig.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'HK Small Store <onboarding@resend.dev>',
          to: ['delivered@resend.dev'],
          subject: '[Diagnostic] Resend Test',
          text: 'Testing Resend connection',
        }),
      });
      if (res.ok) {
        console.log('✅ Resend API SUCCESS (delivered@resend.dev received test message)!');
        console.log('   Sender: "HK Small Store <onboarding@resend.dev>"');
      } else {
        const text = await res.text();
        console.warn('⚠️ Resend returned non-OK status:', text);
      }
    } catch (err: any) {
      console.error('❌ Resend API test failed:', err.message);
    }
  } else {
    console.log('\n[1/2] Resend API is NOT configured.');
  }

  // 2. Check SMTP (Secondary)
  if (appConfig.smtpUser && appConfig.smtpPass) {
    console.log('\n[2/2] Testing Gmail SMTP connection (Fallback)...');
    const isSecure = appConfig.smtpSecure ?? (appConfig.smtpPort === 465);
    const testTransporter = nodemailer.createTransport({
      host: appConfig.smtpHost || 'smtp.gmail.com',
      port: appConfig.smtpPort || 587,
      secure: isSecure,
      auth: {
        user: appConfig.smtpUser,
        pass: appConfig.smtpPass.replace(/\s+/g, ''),
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
    });

    try {
      await testTransporter.verify();
      console.log('✅ Gmail SMTP connection & credentials SUCCESS!');
    } catch (err: any) {
      console.error('❌ Gmail SMTP verify FAILED:', err.message);
    }
  } else {
    console.log('\n[2/2] SMTP is NOT configured.');
  }

  // 3. Test sending live email if argument provided
  const targetEmail = process.argv[2];
  if (targetEmail) {
    console.log(`\n[3/3] Sending live email via emailService to: ${targetEmail}...`);
    const sent = await emailService.sendEmail({
      to: targetEmail,
      subject: '[HK Small Store] Email Diagnostic Test',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #111;">HK Small Store - Email Test</h2>
          <p>Xin chào,</p>
          <p>Đây là email kiểm tra từ hệ thống HK Small Store Backend.</p>
          <p style="color: #059669; font-weight: bold;">Hệ thống email Resend đang hoạt động bình thường và bảo mật thông tin cá nhân!</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
          <p style="font-size: 12px; color: #888;">Thời gian gửi: ${new Date().toISOString()}</p>
        </div>
      `,
      text: `HK Small Store - Email Test\n\nĐây là email kiểm tra từ hệ thống HK Small Store Backend.\n\nThời gian: ${new Date().toISOString()}`,
    });

    if (sent) {
      console.log(`✅ Live test email successfully sent to ${targetEmail}!`);
    } else {
      console.error(`❌ Failed to send live test email to ${targetEmail}.`);
    }
  } else {
    console.log('\n💡 Tip: To send a real test email, run: pnpm run email:test your-email@example.com');
  }

  console.log('\n=== DIAGNOSTIC FINISHED ===\n');
}

main().catch((err) => {
  console.error('Diagnostic error:', err);
  process.exit(1);
});
