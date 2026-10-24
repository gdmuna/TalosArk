import addressparser from 'nodemailer/lib/addressparser';
import { z } from 'zod';

const email = z.email();

/** One RFC mailbox, optionally with a display name; not a group or comma-separated list. */
export const mailboxSchema = z
    .string()
    .min(1)
    .max(1024)
    .regex(/^[^\r\n]+$/)
    .refine((value) => {
        const addresses = addressparser(value);
        return (
            addresses.length === 1 &&
            !('group' in addresses[0]) &&
            email.safeParse(addresses[0].address).success
        );
    });
