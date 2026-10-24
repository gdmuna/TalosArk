import { z } from 'zod';

export const LocalPasswordBounds = Object.freeze({ minCodePoints: 15, maxCodePoints: 128 });

export const LocalPasswordSchema = z
    .string()
    .min(LocalPasswordBounds.minCodePoints)
    .max(LocalPasswordBounds.maxCodePoints * 2)
    .refine((value) => {
        const length = Array.from(value).length;
        return (
            length >= LocalPasswordBounds.minCodePoints &&
            length <= LocalPasswordBounds.maxCodePoints
        );
    }, `Password must contain ${LocalPasswordBounds.minCodePoints} to ${LocalPasswordBounds.maxCodePoints} characters`);
