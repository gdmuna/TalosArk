import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
export const buttonGroupVariants = cva(
    "flex w-fit items-stretch *:focus-visible:z-10 *:focus-visible:relative [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1 has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-r-md has-[>[data-slot=button-group]]:gap-2",
    {
        variants: {
            orientation: {
                horizontal:
                    '*:not-first:rounded-l-none *:not-first:border-l-0 *:not-last:rounded-r-none',
                vertical:
                    'flex-col *:not-first:rounded-t-none *:not-first:border-t-0 *:not-last:rounded-b-none',
            },
        },
        defaultVariants: {
            orientation: 'horizontal',
        },
    }
);
export type ButtonGroupVariants = VariantProps<typeof buttonGroupVariants>;
