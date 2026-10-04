import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
export const fieldVariants = cva(
    'data-[invalid=true]:text-destructive gap-2 group/field flex w-full',
    {
        variants: {
            orientation: {
                vertical: 'flex-col *:w-full [&>.sr-only]:w-auto',
                horizontal:
                    'flex-row items-center has-[>[data-slot=field-content]]:items-start *:data-[slot=field-label]:flex-auto has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px',
                responsive:
                    'flex-col *:w-full @md/field-group:flex-row @md/field-group:items-center @md/field-group:*:w-auto @md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:*:data-[slot=field-label]:flex-auto [&>.sr-only]:w-auto @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px',
            },
        },
        defaultVariants: {
            orientation: 'vertical',
        },
    }
);
export type FieldVariants = VariantProps<typeof fieldVariants>;
