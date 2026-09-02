import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private initialized = false;

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
      this.logger.warn(
        'FIREBASE_SERVICE_ACCOUNT_JSON not set — push notifications disabled',
      );
      return;
    }
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      }
      this.initialized = true;
      this.logger.log('Firebase Admin initialized');
    } catch (e) {
      this.logger.error('Failed to initialize Firebase Admin', e);
    }
  }

  // ── Lưu FCM token của user ──────────────────────────────────────────────────
  async saveFcmToken(userId: string, token: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { fcmToken: token },
    });
  }

  // ── Gửi thông báo đến 1 user ────────────────────────────────────────────────
  async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!this.initialized) return;
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { fcmToken: true } });
    if (!user?.fcmToken) return;
    await this.sendToToken(user.fcmToken, title, body, data);
  }

  // ── Gửi thông báo đến danh sách user ────────────────────────────────────────
  async sendToUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!this.initialized || userIds.length === 0) return;
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, fcmToken: { not: null } },
      select: { fcmToken: true },
    });
    const tokens = users.map((u) => u.fcmToken!).filter(Boolean);
    if (tokens.length === 0) return;
    await this.sendMulticast(tokens, title, body, data);
  }

  // ── Gửi đến token cụ thể ────────────────────────────────────────────────────
  private async sendToToken(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    try {
      await admin.messaging().send({
        token,
        notification: { title, body },
        data,
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      });
    } catch (e: any) {
      // Token hết hạn → xóa khỏi DB
      if (e?.errorInfo?.code === 'messaging/registration-token-not-registered') {
        await this.prisma.user.updateMany({
          where: { fcmToken: token },
          data: { fcmToken: null },
        });
      } else {
        this.logger.warn(`FCM send failed: ${e?.message}`);
      }
    }
  }

  // ── Gửi multicast (nhiều token) ──────────────────────────────────────────────
  private async sendMulticast(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    // FCM v1 sendEachForMulticast (thay cho sendMulticast deprecated)
    const chunks: string[][] = [];
    for (let i = 0; i < tokens.length; i += 500) chunks.push(tokens.slice(i, i + 500));

    for (const chunk of chunks) {
      try {
        const response = await admin.messaging().sendEachForMulticast({
          tokens: chunk,
          notification: { title, body },
          data,
          android: { priority: 'high' },
          apns: { payload: { aps: { sound: 'default', badge: 1 } } },
        });
        // Dọn tokens hết hạn
        const expiredTokens: string[] = [];
        response.responses.forEach((r, i) => {
          if (!r.success && r.error?.code === 'messaging/registration-token-not-registered') {
            expiredTokens.push(chunk[i]);
          }
        });
        if (expiredTokens.length > 0) {
          await this.prisma.user.updateMany({
            where: { fcmToken: { in: expiredTokens } },
            data: { fcmToken: null },
          });
        }
      } catch (e: any) {
        this.logger.warn(`FCM multicast failed: ${e?.message}`);
      }
    }
  }
}
