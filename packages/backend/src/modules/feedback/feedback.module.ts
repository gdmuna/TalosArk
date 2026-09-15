import { FeedbackController } from './feedback.controller.js';
import { FeedbackService } from './internal/feedback.service.js';
import { FeedbackRepository } from './internal/feedback.repository.js';

import { DatabaseModule } from '@/infra/database/database.module.js';

import { Module } from '@nestjs/common';

@Module({
    imports: [DatabaseModule],
    controllers: [FeedbackController],
    providers: [FeedbackService, FeedbackRepository],
})
export class FeedbackModule {}
