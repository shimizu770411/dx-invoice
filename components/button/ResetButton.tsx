import { Button, ButtonProps } from '@/components/ui/button'

type ResetButtonProps = ButtonProps

export function ResetButton({ children = 'リセット', ...props }: ResetButtonProps) {
    return (
        <Button
            type="button"
            {...props}
            className={`rounded-none border text-lg py-6 px-10 tracking-widest transition-colors ${props.className || ''}`}
            style={{
                backgroundColor: '#ffffff',
                color: 'var(--brand-navy)',
                borderColor: 'var(--brand-navy)',
                fontFamily: 'var(--font-mincho)',
                fontWeight: 500,
                letterSpacing: '0.3em',
                ...(props.style || {}),
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--brand-ivory)'
                props.onMouseEnter?.(e)
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff'
                props.onMouseLeave?.(e)
            }}
        >
            {children}
        </Button>
    )
}
