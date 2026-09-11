import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { getCorsOrigin } from './cors-origin';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  // Mặc định của Express chỉ 100kb — bước "Xác nhận import" của ngân hàng câu
  // hỏi gửi nguyên JSON các dòng đã xem/sửa (không phải file), vài trăm câu
  // hỏi kèm đáp án/giải thích đã vượt quá dễ dàng (VD 240 câu ≈ 175kb) và bị
  // chặn 413 trước khi tới được validation. Không liên quan tới giới hạn
  // upload file Excel (Multer, 10MB, xem admin.module.ts).
  app.useBodyParser('json', { limit: '10mb' });
  app.useBodyParser('urlencoded', { limit: '10mb', extended: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: getCorsOrigin() });
  app.useWebSocketAdapter(new IoAdapter(app));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
