import { Button, ButtonProps } from '@/components/ui/button'

interface SearchButtonProps extends ButtonProps {
    isLoading?: boolean
}

export function SearchButton({ isLoading = false, children = '検　索', ...props }: SearchButtonProps) {
    return (
        <Button
            type="button"
            {...props}
            disabled={isLoading || props.disabled}
            className={`rounded-none border-none text-lg py-6 px-10 tracking-widest text-white transition-colors ${props.className || ''}`}
            style={{
                backgroundColor: 'var(--brand-navy)',
                fontFamily: 'var(--font-mincho)',
                fontWeight: 500,
                letterSpacing: '0.4em',
                ...(props.style || {}),
            }}
            onMouseEnter={(e) => {
                if (!isLoading && !props.disabled) {
                    e.currentTarget.style.backgroundColor = 'var(--brand-navy-dark)'
                }
                props.onMouseEnter?.(e)
            }}
            onMouseLeave={(e) => {
                if (!isLoading && !props.disabled) {
                    e.currentTarget.style.backgroundColor = 'var(--brand-navy)'
                }
                props.onMouseLeave?.(e)
            }}
        >
            {children}
        </Button>
    )
}
